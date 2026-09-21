const request = require('supertest');
const app = require('../src/app');
const { resetDatabase } = require('./dbHelpers');

const validUser = { nombre: 'Diego Ávila', email: 'diego@synapse.com', password: 'Clave123!' };
const adminUser = { ...validUser, email: 'admin.tests@synapse.com', role: 'admin' };

describe('Módulo base: Autenticación (Usuarios/Roles)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('registra un usuario correctamente y devuelve 201', async () => {
      const res = await request(app).post('/api/auth/register').send(validUser);
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.role).toBe('user');
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('registra un usuario con rol admin si se solicita', async () => {
      const res = await request(app).post('/api/auth/register').send(adminUser);
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('admin');
    });

    it('rechaza el registro sin campos requeridos -> 400', async () => {
      const res = await request(app).post('/api/auth/register').send({ nombre: 'Incompleto' });
      expect(res.status).toBe(400);
    });

    it('rechaza un email inválido -> 400', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'correo-invalido' });
      expect(res.status).toBe(400);
    });

    it('rechaza contraseñas menores a 6 caracteres -> 400', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validUser, password: '123' });
      expect(res.status).toBe(400);
    });

    it('rechaza un email ya registrado -> 409', async () => {
      await request(app).post('/api/auth/register').send(validUser);
      const res = await request(app).post('/api/auth/register').send(validUser);
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
    });

    it('inicia sesión exitosamente y devuelve un JWT', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('user');
    });

    it('rechaza login con contraseña incorrecta -> 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: 'ContraseñaErronea!'
      });
      expect(res.status).toBe(401);
    });

    it('rechaza login con email inexistente -> 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'noexiste@synapse.com',
        password: validUser.password
      });
      expect(res.status).toBe(401);
    });

    it('rechaza login sin credenciales -> 400', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('devuelve el usuario autenticado -> 200', async () => {
      await request(app).post('/api/auth/register').send(validUser);
      const login = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password
      });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(validUser.email);
    });
  });

  describe('Protección de rutas (verifyToken / isAdmin)', () => {
    let userToken;
    let adminToken;

    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
      await request(app).post('/api/auth/register').send(adminUser);

      const userLogin = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password
      });
      const adminLogin = await request(app).post('/api/auth/login').send({
        email: adminUser.email,
        password: adminUser.password
      });
      userToken = userLogin.body.token;
      adminToken = adminLogin.body.token;
    });

    it('deniega acceso sin token -> 401', async () => {
      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(401);
    });

    it('deniega acceso con token inválido -> 401', async () => {
      const res = await request(app)
        .get('/api/assets')
        .set('Authorization', 'Bearer token-invalido');
      expect(res.status).toBe(401);
    });

    it('deniega creación de activos a rol user -> 403', async () => {
      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nombre: 'Activo Prohibido', tipo: 'Prueba' });
      expect(res.status).toBe(403);
    });

    it('permite creación de activos a rol admin -> 201', async () => {
      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Proyector EPSON', tipo: 'Proyector' });
      expect(res.status).toBe(201);
    });

    it('permite listar activos a usuario autenticado -> 200', async () => {
      const res = await request(app)
        .get('/api/assets?estado=disponible&page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeDefined();
    });

    it('devuelve 404 para rutas inexistentes', async () => {
      const res = await request(app).get('/api/ruta-que-no-existe');
      expect(res.status).toBe(404);
    });
  });
});