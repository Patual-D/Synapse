const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('../src/config/env');

async function main() {
  const connection = await mysql.createConnection({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASS,
    multipleStatements: true
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME_TEST}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`[DB] Bases creadas/verificadas: ${config.DB_NAME} y ${config.DB_NAME_TEST}`);

  const schemaPath = path.join(__dirname, '..', '..', 'database', 'synapse.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(`USE \`${config.DB_NAME}\``);
    await connection.query(schema);
    console.log('[DB] Esquema aplicado desde database/synapse.sql');
  } else {
    console.warn('[DB] No se encontró database/synapse.sql; solo se crearon las bases.');
  }

  await connection.end();
  console.log('[DB] Inicialización de base de datos completada.');
}

main().catch((err) => {
  console.error('[ERROR] Falló la inicialización de la BD:', err.message);
  process.exit(1);
});