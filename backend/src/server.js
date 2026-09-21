const app = require('./app');
const config = require('./config/env');
const { sequelize } = require('./models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Conexión a MySQL establecida.');

    await sequelize.sync();
    console.log('[DB] Esquema sincronizado con el ORM (Sequelize).');

    app.listen(config.PORT, () => {
      console.log(`[SERVER] Backend Synapse escuchando en http://localhost:${config.PORT}`);
    });
  } catch (err) {
    console.error(`[ERROR] No se pudo iniciar el backend: ${err.message}`);
    process.exit(1);
  }
}

main();