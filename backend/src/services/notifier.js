const { EventEmitter } = require('events');

/**
 * Sistema de eventos (singleton) para generar alertas automáticas.
 * Cuando se reporta una falla de equipo, se emite el evento
 * 'maintenance:reportada' y los listeners simulados notifican al
 * personal de soporte técnico.
 */
const notifier = new EventEmitter();
notifier.setMaxListeners(20);

notifier.on('maintenance:reportada', (payload) => {
  console.log(
    `[ALERTA SOPORTE] Falla reportada en "${payload.assetName}" (${payload.assetType}): "${payload.descripcion}". ` +
      `Fecha de reporte: ${payload.fecha ? payload.fecha.toISOString() : 'desconocida'}.`
  );
});

notifier.on('maintenance:completada', (payload) => {
  console.log(`[MANTENIMIENTO] Reparación completada para el activo "${payload.assetName}".`);
});

module.exports = notifier;