const { Sequelize } = require('sequelize');
const config = require('./env');

const database = config.IS_TEST ? config.DB_NAME_TEST : config.DB_NAME;

const sequelize = new Sequelize(database, config.DB_USER, config.DB_PASS, {
  host: config.DB_HOST,
  port: config.DB_PORT,
  dialect: 'mysql',
  logging: false,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;