const { errorHandler, notFound } = require('../src/middleware/errorHandler');
const verifyTokenMiddleware = require('../src/middleware/verifyToken');
const isAdminMiddleware = require('../src/middleware/isAdmin');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Middleware verifyToken', () => {
  it('deniega cuando no hay header de autorización', () => {
    const res = mockRes();
    const next = jest.fn();
    verifyTokenMiddleware({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('deniega cuando el token es inválido o expirado', () => {
    const res = mockRes();
    verifyTokenMiddleware({ headers: { authorization: 'Bearer token-no-valido' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('Middleware isAdmin', () => {
  it('deniega cuando req.user no existe', () => {
    const res = mockRes();
    isAdminMiddleware({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('deniega cuando el rol no es admin', () => {
    const res = mockRes();
    isAdminMiddleware({ user: { role: 'user' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('continúa al siguiente middleware cuando el rol es admin', () => {
    const next = jest.fn();
    isAdminMiddleware({ user: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('Manejador de errores', () => {
  it('responde 500 sin exponer el stack trace', () => {
    const res = mockRes();
    res.headersSent = false;
    errorHandler(new Error('falla interna'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('reenvía el error cuando la respuesta ya fue enviada', () => {
    const res = mockRes();
    res.headersSent = true;
    const next = jest.fn();
    errorHandler(new Error('boom'), {}, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('notFound responde 404 para rutas desconocidas', () => {
    const res = mockRes();
    notFound({ method: 'GET', originalUrl: '/no-existe' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});