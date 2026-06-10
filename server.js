const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const { initSchema } = require('./db');
const app    = require('./app');
const logger = require('./services/logger');
const { startMaintenanceJobs } = require('./services/maintenance');
const PORT   = process.env.PORT || 3001;

// Neon en autosuspend se réveille en 5-10 s : on retente avant d'abandonner,
// sinon le deploy Render échoue au premier timeout de connexion.
async function initSchemaWithRetry(attempts = 4, delayMs = 5000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await initSchema();
    } catch (err) {
      if (i === attempts) throw err;
      logger.warn(`DB init attempt ${i}/${attempts} failed — retry in ${delayMs / 1000}s`, { message: err.message });
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

initSchemaWithRetry()
  .then(() => {
    startMaintenanceJobs();
    app.listen(PORT, () => logger.info(`Server started on port ${PORT}`));
  })
  .catch(err => { logger.error('DB init failed', { message: err.message, stack: err.stack }); process.exit(1); });

