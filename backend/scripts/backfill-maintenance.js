const { Op } = require('sequelize');
const { sequelize, Asset, MaintenanceLog } = require('../src/models');

async function main() {
  await sequelize.authenticate();
  console.log('[BACKFILL] Conectado a la base de datos.');

  const assets = await Asset.findAll({
    where: { estado: 'mantenimiento' },
    attributes: ['id', 'nombre']
  });

  let creados = 0;
  let omitidos = 0;

  for (const asset of assets) {
    const abierto = await MaintenanceLog.findOne({
      where: { asset_id: asset.id, estado_reparacion: { [Op.ne]: 'completado' } }
    });
    if (abierto) {
      omitidos += 1;
      continue;
    }
    await MaintenanceLog.create({
      asset_id: asset.id,
      descripcion: '[Backfill] Recurso encontrado en mantenimiento sin registro. Se crea el historial pendiente de completar.',
      estado_reparacion: 'reportado'
    });
    creados += 1;
    console.log(`[BACKFILL] Log creado para: ${asset.nombre}`);
  }

  console.log(`[BACKFILL] Completado. Logs creados: ${creados}, omitidos (ya tienen log abierto): ${omitidos}.`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('[BACKFILL] Error:', err.message);
  await sequelize.close();
  process.exit(1);
});