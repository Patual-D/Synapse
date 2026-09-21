function notFound(req, res) {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }
  const status = err.status || 500;
  res.status(status).json({ message: 'Error interno del servidor.' });
}

module.exports = { notFound, errorHandler };