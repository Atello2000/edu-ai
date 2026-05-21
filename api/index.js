const { initSchema } = require('../db');
const app = require('../app');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    await initSchema();
    initialized = true;
  }
  return app(req, res);
};
