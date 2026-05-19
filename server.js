const { initSchema } = require('./db');
const app  = require('./app');
const PORT = process.env.PORT || 3001;

initSchema()
  .then(() => app.listen(PORT, () => console.log(`Jangalai démarré sur http://localhost:${PORT}`)))
  .catch(err => { console.error('[DB] Init failed:', err); process.exit(1); });
