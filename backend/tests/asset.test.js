const request = require('supertest');
const app = require('../src/app');
const { resetDatabase } = require('./dbHelpers');

const adminData = { nombre: 'Admin Activos', email: 'admin.act@synapse.com', password: 'Clave123!', role: 'admin' };
const userData = { nombre: 'Usuario Reserva', email: 'user.act@synapse.com', password: 'Clave123!' };

async function register(data) {
  const res = await request(app).post('/api/auth/register').send(data);
  return res.body.user;
}

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

describe('Activos: en_uso_ahora y log automático de mantenimiento', () => {
  let adminToken;
  let userToken;

  beforeEach(async () => {
    await resetDatabase();
    await register(adminData);
    await register(userData);
    adminToken = await login(adminData.email, adminData.password);
    userToken = await login(userData.email, userData.password);
  });

  it('crea un log de mantenimiento al crear un activo en estado mantenimiento', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Pantalla Averiada', tipo: 'Pantalla', estado: 'mantenimiento' });
    expect(res.status).toBe(201);

    const logs = await request(app)
      .get('/api/maintenance')
      .set('Authorization', `Bearer ${userToken}`);
    expect(logs.status).toBe(200);
    expect(logs.body.data).toHaveLength(1);
    expect(logs.body.data[0].asset_id).toBe(res.body.asset.id);
    expect(logs.body.data[0].estado_reparacion).toBe('reportado');
  });

  it('crea un log de mantenimiento al editar un activo a estado mantenimiento', async () => {
    const creado = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Proyector', tipo: 'Proyector' });

    const res = await request(app)
      .patch(`/api/assets/${creado.body.asset.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'mantenimiento' });
    expect(res.status).toBe(200);

    const logs = await request(app)
      .get('/api/maintenance')
      .set('Authorization', `Bearer ${userToken}`);
    expect(logs.body.data).toHaveLength(1);
    expect(logs.body.data[0].asset_id).toBe(creado.body.asset.id);
  });

  it('no duplica log si ya existe uno abierto', async () => {
    const creado = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Laptop', tipo: 'Laptop' });

    await request(app)
      .patch(`/api/assets/${creado.body.asset.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'mantenimiento' });
    await request(app)
      .patch(`/api/assets/${creado.body.asset.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'disponible' });
    await request(app)
      .patch(`/api/assets/${creado.body.asset.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'mantenimiento' });

    const logs = await request(app)
      .get('/api/maintenance')
      .set('Authorization', `Bearer ${userToken}`);
    expect(logs.body.data).toHaveLength(1);
  });

  it('marca en_uso_ahora=true cuando hay una reserva aprobada vigente', async () => {
    const creado = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Camioneta', tipo: 'Vehículo' });
    const assetId = creado.body.asset.id;

    const now = Date.now();
    const resCreated = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        asset_id: assetId,
        fecha_inicio: new Date(now - 60 * 60 * 1000).toISOString(),
        fecha_fin: new Date(now + 60 * 60 * 1000).toISOString()
      });
    expect(resCreated.status).toBe(201);

    await request(app)
      .patch(`/api/reservations/${resCreated.body.reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado_aprobacion: 'aprobada' });

    const assets = await request(app)
      .get('/api/assets?limit=100')
      .set('Authorization', `Bearer ${userToken}`);
    const target = assets.body.data.find((a) => a.id === assetId);
    expect(target.en_uso_ahora).toBe(true);
  });

  it('marca en_uso_ahora=false sin reserva vigente', async () => {
    const creado = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Proyector 2', tipo: 'Proyector' });

    const assets = await request(app)
      .get('/api/assets?limit=100')
      .set('Authorization', `Bearer ${userToken}`);
    const target = assets.body.data.find((a) => a.id === creado.body.asset.id);
    expect(target.en_uso_ahora).toBe(false);
  });
});