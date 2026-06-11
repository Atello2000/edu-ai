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
const { sendAdminAlert } = require('../services/email');

// Un IPN rejeté peut être un vrai paiement client perdu : l'admin doit le
// savoir tout de suite, pas en relisant les logs. Fire-and-forget.
function alertPaymentRejected(reason, details) {
  sendAdminAlert(`Paiement PayTech rejeté — ${reason}`, details)
    .catch(() => {}); // sendAdminAlert ne lève pas, ceinture + bretelles
}

const publicRouter = express.Router();
const protectedRouter = express.Router();

const PAYTECH_CHECKOUT_URL = 'https://paytech.sn/api/payment/request-payment';
const PAYMENTS_LOCKED = process.env.PAYMENTS_LOCKED !== 'false';
const PAYMENTS_LOCKED_MESSAGE =
  'Les paiements sont temporairement verrouilles pendant la stabilisation de Jangalai.';

// Tarification et quotas alloués en Francs CFA (XOF)
const PLAN_CONFIG = {
  pro:   { name: 'Abonnement Pro',  price: 2500, jetons: 150, isTopup: false },
  max:   { name: 'Abonnement Max',  price: 5000, jetons: 400, isTopup: false },
  topup: { name: 'Recharge jetons', price: 1000, jetons:  50, isTopup: true  },
};

/**
 * ── Routeur Protégé (Checkout) ───────────────────────────────────────────────
 */
protectedRouter.post('/checkout', async (req, res) => {
  const { plan } = req.body || {};

  if (PAYMENTS_LOCKED) {
    logger.warn('Checkout PayTech bloque: paiements temporairement verrouilles', {
      userId: req.user?.id,
      plan,
    });
    return res.status(503).json({
      error: PAYMENTS_LOCKED_MESSAGE,
      paymentsLocked: true,
    });
  }

  if (!plan || !PLAN_CONFIG[plan]) {
    return res.status(400).json({ error: 'Plan d\'abonnement invalide ou manquant.' });
  }

  const config = PLAN_CONFIG[plan];
  const userId = req.user.id;
  const userEmail = req.user.email;

  // Référence unique : PAYTECH_sub_* pour abonnements, PAYTECH_topup_* pour recharges
  const txType = config.isTopup ? 'topup' : 'sub';
  const refCommand = `PAYTECH_${txType}_${userId}_${plan}_${Date.now()}`;

  const ipnUrl = `${process.env.BACKEND_URL}/api/payment/ipn`;
  const successUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?plan=${plan}`;
  const cancelUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/app?payment=cancel`;

  try {
    const rawApiKey = process.env.PAYTECH_API_KEY || '';
    const rawApiSecret = process.env.PAYTECH_API_SECRET || '';
    const paytechApiKey = rawApiKey.replace(/^["']|["']$/g, '').trim();
    const paytechApiSecret = rawApiSecret.replace(/^["']|["']$/g, '').trim();

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

    // Enregistre la transaction en attente : l'IPN ne créditera que les
    // ref_command créées ici. Sans ça, quiconque connaît les hashes IPN
    // pourrait forger des références et se créditer des plans/jetons.
    await db.prepare(
      "INSERT INTO payments (ref_command, user_id, plan, amount, status) VALUES (?, ?, ?, ?, 'pending')"
    ).run(refCommand, userId, plan, config.price);

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

  // Ne pas logger les hashes — ils sont des dérivés de clés API et ne doivent pas apparaître en clair dans les logs
  logger.info('IPN PayTech reçu', { ref_command, type_event, item_price });

  // 1. Validation de l'authenticité de la requête IPN (Hashes SHA256)
  if (!api_key_sha256 || !api_secret_sha256 || !ref_command) {
    logger.warn('IPN suspect reçu sans paramètres obligatoires', { ref_command, type_event });
    return res.status(400).send('Bad Request');
  }

  // Valider le type d'événement : ignorer les IPN qui ne correspondent pas à un paiement abouti.
  // La valeur 'sale_complete' est confirmée par la documentation PayTech et les tests d'intégration.
  const VALID_EVENTS = ['sale_complete'];
  if (type_event && !VALID_EVENTS.includes(type_event)) {
    logger.warn('IPN ignoré — type_event non reconnu comme succès de paiement', { type_event, ref_command });
    return res.status(200).send('OK'); // 200 pour éviter les retries PayTech
  }

  const rawApiKey = process.env.PAYTECH_API_KEY || '';
  const rawApiSecret = process.env.PAYTECH_API_SECRET || '';
  const paytechApiKey = rawApiKey.replace(/^["']|["']$/g, '').trim();
  const paytechApiSecret = rawApiSecret.replace(/^["']|["']$/g, '').trim();

  const localKeyHash = crypto.createHash('sha256').update(paytechApiKey).digest('hex');
  const localSecretHash = crypto.createHash('sha256').update(paytechApiSecret).digest('hex');

  function safeCompareHex(a, b) {
    try {
      if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch { return false; }
  }

  if (!safeCompareHex(api_key_sha256, localKeyHash) || !safeCompareHex(api_secret_sha256, localSecretHash)) {
    logger.error('Signature IPN invalide : échec de l\'authentification des clés');
    alertPaymentRejected('signature invalide', { ref_command, type_event, item_price });
    return res.status(403).send('Forbidden');
  }

  logger.info('Notification IPN PayTech reçue et validée avec succès', { ref_command, item_price, type_event });

  // 2. Traitement de la commande et crédit de l'utilisateur
  // Référence attendue : PAYTECH_{sub|topup}_{userId}_{plan}_{timestamp}
  const parts = ref_command.split('_');
  if (parts.length < 4 || parts[0] !== 'PAYTECH' || !['sub', 'topup'].includes(parts[1])) {
    logger.error('Format de ref_command PayTech invalide', { ref_command });
    return res.status(400).send('Invalid Reference');
  }

  const txType = parts[1]; // 'sub' ou 'topup'
  const userId = parseInt(parts[2], 10);
  const plan   = parts[3];

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
    alertPaymentRejected('montant insuffisant', { ref_command, attendu: `${config.price} XOF`, reçu: `${item_price} XOF`, userId, plan });
    return res.status(400).send('Price Mismatch');
  }

  try {
    // La ref_command DOIT correspondre à un checkout initié par ce serveur.
    // Un IPN forgé (hashes volés + référence inventée) est rejeté ici.
    const pending = await db.prepare(
      'SELECT user_id, plan, amount, status FROM payments WHERE ref_command = ?'
    ).get(ref_command);
    if (!pending) {
      logger.error('IPN rejeté — ref_command inconnue (aucun checkout correspondant)', { ref_command });
      alertPaymentRejected('référence inconnue', { ref_command, userId, plan, item_price });
      return res.status(400).send('Unknown Reference');
    }
    if (pending.user_id !== userId || pending.plan !== plan) {
      logger.error('IPN rejeté — ref_command incohérente avec le checkout enregistré', {
        ref_command, userId, plan, expectedUser: pending.user_id, expectedPlan: pending.plan,
      });
      alertPaymentRejected('référence incohérente', { ref_command, userId, plan, checkout_user: pending.user_id, checkout_plan: pending.plan });
      return res.status(400).send('Reference Mismatch');
    }

    // Idempotency — passage atomique pending → paid : si une IPN concurrente
    // ou un retry PayTech a déjà gagné la course, on ignore silencieusement.
    const claimed = await db.prepare(
      "UPDATE payments SET status = 'paid', paid_at = NOW() WHERE ref_command = ? AND status = 'pending' RETURNING id"
    ).get(ref_command);
    if (!claimed) {
      logger.warn('IPN duplicate ignoré', { ref_command });
      return res.status(200).send('OK');
    }

    // Vérifier si l'utilisateur existe
    const user = await db.prepare('SELECT id, plan FROM users WHERE id = ?').get(userId);
    if (!user) {
      logger.error('Utilisateur non trouvé pour le crédit IPN', { userId });
      alertPaymentRejected('utilisateur introuvable (paiement reçu mais non crédité !)', { ref_command, userId, plan, item_price });
      return res.status(404).send('User Not Found');
    }

    // Écriture atomique : topup = jetons seuls, sub = plan + jetons + expiration
    const updateSql = txType === 'topup'
      ? `UPDATE users SET jetons = jetons + ? WHERE id = ? RETURNING jetons AS balance`
      : `UPDATE users SET plan = ?, jetons = jetons + ?, plan_expires_at = NOW() + INTERVAL '31 days' WHERE id = ? RETURNING jetons AS balance`;

    const updateParams = txType === 'topup'
      ? [config.jetons, userId]
      : [plan, config.jetons, userId];

    const row = await db.prepare(updateSql).get(...updateParams);

    if (row) {
      const note = txType === 'topup'
        ? `Recharge PayTech (+${config.jetons} jetons)`
        : `Abonnement PayTech ${plan.toUpperCase()} (+${config.jetons} jetons)`;

      await db.prepare(`
        INSERT INTO jeton_transactions (user_id, action, amount, balance_after, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, `payment_success:${plan}`, config.jetons, row.balance, note);

      logger.info(`Paiement traité — ${txType}`, {
        userId, plan, txType,
        creditedTokens: config.jetons,
        newBalance: row.balance,
        ...(txType === 'sub' ? { oldPlan: user.plan, newPlan: plan } : {}),
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
    alertPaymentRejected('erreur interne pendant le crédit (PayTech va retenter)', { ref_command, userId, plan, erreur: err.message });
    res.status(500).send('Internal Server Error');
  }
});

module.exports = {
  publicRouter,
  protectedRouter,
  PAYMENTS_LOCKED,
  PAYMENTS_LOCKED_MESSAGE,
};
