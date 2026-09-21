const { Asset } = require('../models');

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

    return res.json({ data: rows, total: count, page, limit });
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

    return res.status(201).json({ message: 'Activo creado correctamente.', asset });
  } catch (err) {
    next(err);
  }
};