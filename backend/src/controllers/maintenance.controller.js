const notifier = require('../services/notifier');
const { MaintenanceLog, Asset } = require('../models');

exports.report = async (req, res, next) => {
  try {
    const { asset_id, descripcion } = req.body || {};

    if (!asset_id || !descripcion) {
      return res.status(400).json({ message: 'Los campos asset_id y descripcion son requeridos.' });
    }

    const asset = await Asset.findByPk(asset_id);
    if (!asset) {
      return res.status(404).json({ message: 'Activo no encontrado.' });
    }

    const log = await MaintenanceLog.create({
      asset_id,
      descripcion,
      estado_reparacion: 'reportado'
    });

    await asset.update({ estado: 'mantenimiento' });

    notifier.emit('maintenance:reportada', {
      assetId: asset.id,
      assetName: asset.nombre,
      assetType: asset.tipo,
      descripcion,
      fecha: log.fecha_reporte
    });

    return res.status(201).json({
      message: 'Falla reportada. Se generó una alerta automática al personal de soporte.',
      log
    });
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const logs = await MaintenanceLog.findAll({
      include: [{ model: Asset, as: 'asset', attributes: ['id', 'nombre', 'tipo'] }],
      order: [['fecha_reporte', 'DESC']]
    });
    return res.json({ data: logs });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado_reparacion } = req.body || {};

    const validStates = ['reportado', 'en_proceso', 'completado'];
    if (!validStates.includes(estado_reparacion)) {
      return res.status(400).json({ message: 'Estado de reparación inválido.' });
    }

    const log = await MaintenanceLog.findByPk(id, {
      include: [{ model: Asset, as: 'asset', attributes: ['id', 'nombre'] }]
    });
    if (!log) {
      return res.status(404).json({ message: 'Registro de mantenimiento no encontrado.' });
    }

    log.estado_reparacion = estado_reparacion;
    await log.save();

    if (estado_reparacion === 'completado' && log.asset) {
      await log.asset.update({ estado: 'disponible' });
      notifier.emit('maintenance:completada', { assetName: log.asset.nombre });
    }

    return res.json({ message: 'Estado de reparación actualizado.', log });
  } catch (err) {
    next(err);
  }
};