const { Op } = require('sequelize');
const { sequelize, Reservation } = require('../src/models');

async function main() {
  await sequelize.authenticate();
  console.log('[MIGRATE] Conectado a la base de datos.');

  await sequelize.query(
    `ALTER TABLE reservations
     MODIFY COLUMN estado_aprobacion ENUM('pendiente','aprobada','rechazada','cancelada','realizada')
     NOT NULL DEFAULT 'pendiente'`
  );
  console.log('[MIGRATE] Columna estado_aprobacion actualizada (ENUM incluye "realizada").');

  const [updated] = await Reservation.update(
    { estado_aprobacion: 'realizada' },
    {
      where: {
        estado_aprobacion: 'aprobada',
        fecha_fin: { [Op.lt]: new Date() }
      }
    }
  );
  console.log(`[MIGRATE] Reservas aprobadas vencidas marcadas como "realizada": ${updated}.`);

  await sequelize.close();
  console.log('[MIGRATE] Migración completada.');
}

main().catch(async (err) => {
  console.error('[MIGRATE] Error:', err.message);
  await sequelize.close();
  process.exit(1);
});