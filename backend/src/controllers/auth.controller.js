const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

const validateEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

exports.register = async (req, res, next) => {
  try {
    const { nombre, email, password, role } = req.body || {};

    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Los campos nombre, email y password son requeridos.' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Debe proporcionar un email válido.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'user';

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un usuario registrado con ese email.' });
    }

    const password_hash = await bcrypt.hash(String(password), SALT_ROUNDS);
    const user = await User.create({ nombre, email, password_hash, role: normalizedRole });

    return res.status(201).json({
      message: 'Usuario registrado correctamente.',
      user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Los campos email y password son requeridos.' });
    }

    const user = await User.scope(null).findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = signToken({ id: user.id, role: user.role, nombre: user.nombre });

    return res.json({
      message: 'Login exitoso.',
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    res.json({ user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};