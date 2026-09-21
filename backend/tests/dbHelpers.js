const { sequelize } = require('../src/models');

const TABLES = ['maintenance_logs', 'reservations', 'assets', 'users'];

async function resetDatabase() {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of TABLES) {
    await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
}

module.exports = { resetDatabase };