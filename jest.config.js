/**
 * Configuration Jest.
 *
 * testTimeout relevé à 30 s : le premier test qui hache un mot de passe (bcrypt
 * cost 12) dépassait régulièrement le défaut de 5 s au démarrage à froid, ce qui
 * rendait la suite instable sur machines lentes / CI.
 */
module.exports = {
  testTimeout: 30000,
};
