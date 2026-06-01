/**
 * routes/payment.js — Gestion des paiements avec PayTech (Sénégal)
 * Expose deux routeurs :
 * - publicRouter : accessible sans authentification ni protection CSRF (pour le webhook IPN)
 * - protectedRouter : sécurisé (pour l'initiation du checkout)
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../services/logger');

const publicRouter = express.Router();
const protectedRouter = express.Router();

const PAYTECH_CHECKOUT_URL = 'https://paytech.sn/api/payment/request-payment';

// Tarification et quotas alloués en Francs CFA (XOF)
const PLAN_CONFIG = {
  pro: { name: 'Abonnement Pro', price: 2500, jetons: 150 },
  max: { name: 'Abonnement Max', price: 5000, jetons: 400 }
};

/**
 * ── Routeur Protégé (Checkout) ───────────────────────────────────────────────
 */
protectedRouter.post('/checkout', async (req, res) => {
  const { plan } = req.body || {};

  if (!plan || !PLAN_CONFIG[plan]) {
    return res.status(400).json({ error: 'Plan d\'abonnement invalide ou manquant.' });
  }

  const config = PLAN_CONFIG[plan];
  const userId = req.user.id;
  const userEmail = req.user.email;

  // Référence unique de transaction : PAYTECH_sub_{userId}_{plan}_{timestamp}
  const refCommand = `PAYTECH_sub_${userId}_${plan}_${Date.now()}`;

  const ipnUrl = `${process.env.BACKEND_URL}/api/payment/ipn`;
  const successUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?plan=${plan}`;
  const cancelUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/app?payment=cancel`;

  try {
    const paytechApiKey = process.env.PAYTECH_API_KEY;
    const paytechApiSecret = process.env.PAYTECH_API_SECRET;

    if (!paytechApiKey || !paytechApiSecret) {
      logger.error('Configuration PayTech manquante dans les variables d\'environnement');
      return res.status(500).json({ error: 'La passerelle de paiement n\'est pas configurée.' });
    }

    const payload = {
      item_name: `Jangalai ${plan.toUpperCase()}`,
      item_price: String(config.price),
      currency: 'XOF',
      ref_command: refCommand,
      command_name: `Abonnement mensuel ${plan.toUpperCase()} pour ${userEmail}`,
      env: process.env.PAYTECH_ENV || 'test',
      ipn_url: ipnUrl,
      success_url: successUrl,
      cancel_url: cancelUrl
    };

    const response = await fetch(PAYTECH_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'API_KEY': paytechApiKey,
        'API_SECRET': paytechApiSecret
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success !== 1) {
      logger.error('Erreur retournée par PayTech lors de la création du paiement', { data });
      return res.status(400).json({ error: data.message || 'Impossible de créer la session de paiement.' });
    }

    res.json({ redirectUrl: data.redirect_url });

  } catch (err) {
    logger.error('Erreur lors de l\'initiation du checkout PayTech', { userId, plan, message: err.message });
    res.status(500).json({ error: 'Erreur interne lors de l\'initiation du paiement.' });
  }
});

/**
 * ── Routeur Public (Webhook IPN) ──────────────────────────────────────────────
 */
publicRouter.post('/', async (req, res) => {
  const payload = { ...(req.query || {}), ...(req.body || {}) };
  const { api_key_sha256, api_secret_sha256, ref_command, item_price, type_event } = payload;

  logger.info('IPN Payload parsed:', { payload });

  // 1. Validation de l'authenticité de la requête IPN (Hashes SHA256)
  if (!api_key_sha256 || !api_secret_sha256 || !ref_command) {
    logger.warn('IPN suspect reçu sans paramètres obligatoires', { payload });
    return res.status(400).send('Bad Request');
  }

  const paytechApiKey = process.env.PAYTECH_API_KEY || '';
  const paytechApiSecret = process.env.PAYTECH_API_SECRET || '';

  const localKeyHash = crypto.createHash('sha256').update(paytechApiKey).digest('hex');
  const localSecretHash = crypto.createHash('sha256').update(paytechApiSecret).digest('hex');

  if (api_key_sha256 !== localKeyHash || api_secret_sha256 !== localSecretHash) {
    logger.error('Signature IPN invalide : échec de l\'authentification des clés');
    return res.status(403).send('Forbidden');
  }

  logger.info('Notification IPN PayTech reçue et validée avec succès', { ref_command, item_price, type_event });

  // 2. Traitement de la commande et crédit de l'utilisateur
  // Référence attendue : PAYTECH_sub_{userId}_{plan}_{timestamp}
  const parts = ref_command.split('_');
  if (parts.length < 4 || parts[0] !== 'PAYTECH' || parts[1] !== 'sub') {
    logger.error('Format de ref_command PayTech invalide', { ref_command });
    return res.status(400).send('Invalid Reference');
  }

  const userId = parseInt(parts[2], 10);
  const plan = parts[3];

  if (isNaN(userId) || !PLAN_CONFIG[plan]) {
    logger.error('Données de ref_command PayTech invalides ou corrompues', { userId, plan });
    return res.status(400).send('Invalid Data');
  }

  const config = PLAN_CONFIG[plan];

  // MED-04 : Vérifier que le montant payé correspond au prix attendu
  const receivedPrice = Number(item_price);
  if (!receivedPrice || receivedPrice < config.price) {
    logger.error('IPN price mismatch — montant insuffisant', {
      ref_command,
      expected: config.price,
      received: item_price,
    });
    return res.status(400).send('Price Mismatch');
  }

  try {
    // Idempotency — si ref_command déjà traitée, ignorer silencieusement
    try {
      await db.prepare(
        'INSERT INTO payments (ref_command, user_id, plan, amount) VALUES (?, ?, ?, ?)'
      ).run(ref_command, userId, plan, config.price);
    } catch (err) {
      if (err.code === '23505') {
        logger.warn('IPN duplicate ignoré', { ref_command });
        return res.status(200).send('OK');
      }
      throw err;
    }

    // Vérifier si l'utilisateur existe
    const user = await db.prepare('SELECT id, plan FROM users WHERE id = ?').get(userId);
    if (!user) {
      logger.error('Utilisateur non trouvé pour le crédit IPN', { userId });
      return res.status(404).send('User Not Found');
    }

    // Effectuer l'écriture atomique : Mettre à jour le plan et AJOUTER le quota de jetons
    const row = await db.prepare(`
      UPDATE users
      SET plan = ?, jetons = jetons + ?
      WHERE id = ?
      RETURNING jetons AS balance
    `).get(plan, config.jetons, userId);

    if (row) {
      // Enregistrer la transaction d'ajout de jetons
      await db.prepare(`
        INSERT INTO jeton_transactions (user_id, action, amount, balance_after, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        `payment_success:${plan}`,
        config.jetons,
        row.balance,
        `Abonnement PayTech ${plan.toUpperCase()} (+${config.jetons} jetons)`
      );

      logger.info(`Plan utilisateur promu avec succès et jetons crédités`, {
        userId,
        oldPlan: user.plan,
        newPlan: plan,
        creditedTokens: config.jetons,
        newBalance: row.balance
      });
    }

    // Répondre 200 OK immédiatement à PayTech
    res.status(200).send('OK');

  } catch (err) {
    logger.error('Erreur lors du traitement en base de données de l\'IPN PayTech', {
      ref_command,
      userId,
      plan,
      message: err.message
    });
    res.status(500).send('Internal Server Error');
  }
});

module.exports = {
  publicRouter,
  protectedRouter
};
