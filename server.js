const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const { initSchema } = require('./db');
const app    = require('./app');
const logger = require('./services/logger');
const { startMaintenanceJobs } = require('./services/maintenance');
const PORT   = process.env.PORT || 3001;

initSchema()
  .then(() => {
    startMaintenanceJobs();
    app.listen(PORT, () => logger.info(`Server started on port ${PORT}`));
  })
  .catch(err => { logger.error('DB init failed', { message: err.message, stack: err.stack }); process.exit(1); });

