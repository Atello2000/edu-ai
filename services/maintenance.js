const logger = require('./logger');
const { pool } = require('../db');

/**
 * Exécute une tâche si elle n'a pas déjà été exécutée au cours de l'intervalle défini.
 * Utilise la table app_config pour synchroniser plusieurs instances (Render).
 */
async function runOnce(key, intervalMs, taskFn) {
  try {
    const now = new Date();
    const row = await pool.query('SELECT value FROM app_config WHERE key = $1', [key]);
    const lastRunStr = row.rows[0]?.value;

    if (lastRunStr) {
      const lastRun = new Date(lastRunStr);
      if (now - lastRun < intervalMs) {
        return; // Déjà exécuté récemment
      }
    }

    // Upsert de la date de dernière exécution
    await pool.query(
      'INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, now.toISOString()]
    );

    // Exécution de la tâche
    await taskFn();
  } catch (err) {
    logger.warn(`Failed to execute runOnce task for ${key}`, { error: err.message });
  }
}

function startMaintenanceJobs() {
  logger.info('Starting background maintenance jobs');

  // Purge périodique des contenus partagés expirés (toutes les 6 heures)
  const runSharedContentPurge = async () => {
    await runOnce('maintenance_purge_shared_content', 6 * 3600 * 1000, async () => {
      const result = await pool.query('DELETE FROM shared_content WHERE expires_at < NOW()');
      if (result.rowCount > 0) {
        logger.info(`Purged ${result.rowCount} expired shared content(s)`);
      }
    });
  };

  // Purge périodique du cache de l'IA expiré (toutes les 6 heures)
  const runAiCachePurge = async () => {
    await runOnce('maintenance_purge_ai_cache', 6 * 3600 * 1000, async () => {
      const result = await pool.query('DELETE FROM ai_cache WHERE expires_at < NOW()');
      if (result.rowCount > 0) {
        logger.info(`Purged ${result.rowCount} expired AI cache entries`);
      }
    });
  };

  // Purge des données historiques anciennes (une fois par jour)
  const runHistoricalDataPurge = async () => {
    await runOnce('maintenance_purge_historical_data', 24 * 3600 * 1000, async () => {
      const [tx, quota, pendingPayments, refreshTokens] = await Promise.all([
        pool.query("DELETE FROM jeton_transactions WHERE created_at < NOW() - INTERVAL '6 months'"),
        pool.query("DELETE FROM user_quota WHERE date < to_char(NOW() - INTERVAL '3 months', 'YYYY-MM-DD')"),
        // Checkouts jamais aboutis (abandonnés avant paiement) — l'IPN PayTech
        // arrive en minutes, 7 jours laissent une marge très large.
        pool.query("DELETE FROM payments WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days'"),
        // Les tokens tournés sont gardés jusqu'à expiration (détection de réutilisation)
        pool.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()'),
      ]);
      if (tx.rowCount > 0)    logger.info(`Purged ${tx.rowCount} old jeton transactions`);
      if (quota.rowCount > 0) logger.info(`Purged ${quota.rowCount} old user quota rows`);
      if (pendingPayments.rowCount > 0) logger.info(`Purged ${pendingPayments.rowCount} abandoned pending payments`);
      if (refreshTokens.rowCount > 0) logger.info(`Purged ${refreshTokens.rowCount} expired refresh tokens`);
    });
  };

  // Exécution immédiate au démarrage
  runSharedContentPurge().catch(err => logger.error('Initial shared content purge failed', err));
  runAiCachePurge().catch(err => logger.error('Initial AI cache purge failed', err));
  runHistoricalDataPurge().catch(err => logger.error('Initial historical data purge failed', err));

  // Planification des intervalles réguliers
  setInterval(() => {
    runSharedContentPurge().catch(err => logger.error('Periodic shared content purge failed', err));
    runAiCachePurge().catch(err => logger.error('Periodic AI cache purge failed', err));
  }, 1 * 3600 * 1000).unref(); // Vérifie toutes les heures

  setInterval(() => {
    runHistoricalDataPurge().catch(err => logger.error('Periodic historical data purge failed', err));
  }, 4 * 3600 * 1000).unref(); // Vérifie toutes les 4 heures
}

module.exports = { startMaintenanceJobs };
