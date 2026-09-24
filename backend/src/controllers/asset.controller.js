const { Op } = require('sequelize');
const { Asset, Reservation, MaintenanceLog } = require('../models');

async function crearLogMantenimientoSiAplica(assetId) {
  const abierto = await MaintenanceLog.findOne({
    where: { asset_id: assetId, estado_reparacion: { [Op.ne]: 'completado' } }
  });
  if (!abierto) {
    await MaintenanceLog.create({
      asset_id: assetId,
      descripcion: 'Marcado como en mantenimiento desde el panel de administración.',
      estado_reparacion: 'reportado'
    });
  }
}

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.tipo) where.tipo = req.query.tipo;
    if (req.query.estado) where.estado = req.query.estado;

    const { rows, count } = await Asset.findAndCountAll({
      where,
      limit,
      offset,
      order: [['id', 'ASC']]
    });

    const now = new Date();
    const activos = await Reservation.findAll({
      where: {
        estado_aprobacion: 'aprobada',
        fecha_inicio: { [Op.lte]: now },
        fecha_fin: { [Op.gte]: now }
      },
      attributes: ['asset_id']
    });
    const enUsoIds = new Set(activos.map((r) => r.asset_id));

    const data = rows.map((a) => ({
      ...a.toJSON(),
      en_uso_ahora: enUsoIds.has(a.id)
    }));

    return res.json({ data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, tipo, estado, ubicacion, responsable_id } = req.body || {};

    if (!nombre || !tipo) {
      return res.status(400).json({ message: 'Los campos nombre y tipo son requeridos.' });
    }

    const validStates = ['disponible', 'en_uso', 'mantenimiento'];
    const normalizedEstado = validStates.includes(estado) ? estado : 'disponible';

    const asset = await Asset.create({
      nombre,
      tipo,
      estado: normalizedEstado,
      ubicacion: ubicacion || '',
      responsable_id: responsable_id || null
    });

    if (normalizedEstado === 'mantenimiento') {
      await crearLogMantenimientoSiAplica(asset.id);
    }

    return res.status(201).json({ message: 'Activo creado correctamente.', asset });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, estado, ubicacion, responsable_id } = req.body || {};

    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Activo no encontrado.' });
    }

    const validStates = ['disponible', 'en_uso', 'mantenimiento'];
    if (estado !== undefined && !validStates.includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido.' });
    }

    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (tipo !== undefined) updates.tipo = tipo;
    if (estado !== undefined) updates.estado = estado;
    if (ubicacion !== undefined) updates.ubicacion = ubicacion;
    if (responsable_id !== undefined) updates.responsable_id = responsable_id || null;

    await asset.update(updates);

    if (updates.estado === 'mantenimiento') {
      await crearLogMantenimientoSiAplica(asset.id);
    }

    return res.json({ message: 'Activo actualizado correctamente.', asset });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Activo no encontrado.' });
    }

    await asset.destroy();

    return res.status(200).json({ message: `Activo "${asset.nombre}" eliminado correctamente.` });
  } catch (err) {
    next(err);
  }
};