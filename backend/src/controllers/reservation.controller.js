const { Op } = require('sequelize');
const { Reservation, Asset, User } = require('../models');

const APPROVED_STATES = ['pendiente', 'aprobada'];
const CALENDAR_STATES = ['pendiente', 'aprobada'];

exports.create = async (req, res, next) => {
  try {
    const { asset_id, fecha_inicio, fecha_fin } = req.body || {};
    const user_id = req.user.id;

    if (!asset_id || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        message: 'Los campos asset_id, fecha_inicio y fecha_fin son requeridos.'
      });
    }

    const start = new Date(fecha_inicio);
    const end = new Date(fecha_fin);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      return res.status(400).json({ message: 'Rango de fechas inválido (fecha_fin debe ser posterior a fecha_inicio).' });
    }

    const asset = await Asset.findByPk(asset_id);
    if (!asset) {
      return res.status(404).json({ message: 'Activo no encontrado.' });
    }

    const conflict = await Reservation.findOne({
      where: {
        asset_id,
        estado_aprobacion: { [Op.in]: APPROVED_STATES },
        [Op.or]: [
          { fecha_inicio: { [Op.lt]: end }, fecha_fin: { [Op.gt]: start } }
        ]
      }
    });

    if (conflict) {
      return res.status(409).json({ message: 'El activo ya está reservado en ese rango de fechas.' });
    }

    const reservation = await Reservation.create({
      asset_id,
      user_id,
      fecha_inicio: start,
      fecha_fin: end,
      estado_aprobacion: 'pendiente'
    });

    return res.status(201).json({ message: 'Reserva creada correctamente (pendiente de aprobación).', reservation });
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const where = {};

    if (req.query.todos === '1') {
      // Historial completo (uso interno del admin): incluye reservas pasadas.
    } else if (req.query.mine) {
      where.user_id = req.user.id;
    } else if (req.query.estado) {
      where.estado_aprobacion = req.query.estado;
    } else {
      where.estado_aprobacion = { [Op.in]: CALENDAR_STATES };
    }

    if (req.query.asset_id) where.asset_id = req.query.asset_id;

    if (req.query.todos !== '1') {
      // Solo "próximas" reservas: descarta las que ya terminaron.
      where.fecha_fin = { [Op.gte]: new Date() };
    }

    const reservations = await Reservation.findAll({
      where,
      include: [
        { model: Asset, as: 'asset', attributes: ['id', 'nombre', 'tipo'] },
        { model: User, as: 'user', attributes: ['id', 'nombre'] }
      ],
      order: [['fecha_inicio', 'ASC']]
    });

    return res.json({ data: reservations });
  } catch (err) {
    next(err);
  }
};

exports.updateState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado_aprobacion } = req.body || {};

    const validStates = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];
    if (!validStates.includes(estado_aprobacion)) {
      return res.status(400).json({ message: 'Estado de aprobación inválido.' });
    }

    const reservation = await Reservation.findByPk(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    reservation.estado_aprobacion = estado_aprobacion;
    await reservation.save();

    return res.json({ message: 'Estado de la reserva actualizado.', reservation });
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findByPk(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && reservation.user_id !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permiso para cancelar esta reserva.' });
    }

    if (!['pendiente', 'aprobada'].includes(reservation.estado_aprobacion)) {
      return res.status(409).json({ message: 'Solo se pueden cancelar reservas pendientes o aprobadas.' });
    }

    if (new Date(reservation.fecha_inicio).getTime() <= Date.now()) {
      return res.status(409).json({ message: 'No se puede cancelar una reserva que ya inició.' });
    }

    reservation.estado_aprobacion = 'cancelada';
    await reservation.save();

    return res.json({ message: 'Reserva cancelada correctamente.', reservation });
  } catch (err) {
    next(err);
  }
};