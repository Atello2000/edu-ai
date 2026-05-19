const { initSchema } = require('./db');
const app    = require('./app');
const logger = require('./services/logger');
const PORT   = process.env.PORT || 3001;

initSchema()
  .then(() => app.listen(PORT, () => logger.info(`Server started on port ${PORT}`)))
  .catch(err => { logger.error('DB init failed', { message: err.message, stack: err.stack }); process.exit(1); });
