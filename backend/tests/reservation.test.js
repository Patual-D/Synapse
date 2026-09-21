const request = require('supertest');
const app = require('../src/app');
const { resetDatabase } = require('./dbHelpers');

const userData = { nombre: 'Cliente Uno', email: 'cliente.uno@synapse.com', password: 'Clave123!' };
const otroUserData = { nombre: 'Cliente Dos', email: 'cliente.dos@synapse.com', password: 'Clave123!' };
const adminData = { nombre: 'Admin Pruebas', email: 'admin.res@synapse.com', password: 'Clave123!', role: 'admin' };

async function register(data) {
  const res = await request(app).post('/api/auth/register').send(data);
  return res.body.user;
}

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

async function crearActivo(token, nombre) {
  const res = await request(app)
    .post('/api/assets')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre, tipo: 'Proyector' });
  return res.body.asset;
}

function diasDesdeHoy(deltaInicio, deltaFin) {
  const now = Date.now();
  return {
    fecha_inicio: new Date(now + deltaInicio * 24 * 60 * 60 * 1000).toISOString(),
    fecha_fin: new Date(now + deltaFin * 24 * 60 * 60 * 1000).toISOString()
  };
}

describe('Reservaciones: cancelado y filtro de fechas', () => {
  let adminToken;
  let userToken;
  let otroUserToken;

  beforeEach(async () => {
    await resetDatabase();
    await register(adminData);
    await register(userData);
    await register(otroUserData);
    adminToken = await login(adminData.email, adminData.password);
    userToken = await login(userData.email, userData.password);
    otroUserToken = await login(otroUserData.email, otroUserData.password);
  });

  async function crearReserva(token, tokenAdmin, inicio, fin, estado = 'pendiente') {
    const asset = await crearActivo(tokenAdmin, `Activo ${Math.random()}`);
    const creada = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ asset_id: asset.id, fecha_inicio: inicio, fecha_fin: fin });
    const reserva = creada.body.reservation;
    if (estado !== 'pendiente') {
      await request(app)
        .patch(`/api/reservations/${reserva.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado_aprobacion: estado });
    }
    return reserva;
  }

  describe('POST /api/reservations/:id/cancel', () => {
    it('cancela una reserva pendiente propia -> 200', async () => {
      const { fecha_inicio, fecha_fin } = diasDesdeHoy(1, 2);
      const reserva = await crearReserva(userToken, adminToken, fecha_inicio, fecha_fin);

      const res = await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.reservation.estado_aprobacion).toBe('cancelada');
    });

    it('cancela una reserva aprobada propia -> 200', async () => {
      const { fecha_inicio, fecha_fin } = diasDesdeHoy(1, 2);
      const reserva = await crearReserva(userToken, adminToken, fecha_inicio, fecha_fin, 'aprobada');

      const res = await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.reservation.estado_aprobacion).toBe('cancelada');
    });

    it('niega cancelar una reserva de otro usuario -> 403', async () => {
      const { fecha_inicio, fecha_fin } = diasDesdeHoy(1, 2);
      const reserva = await crearReserva(otroUserToken, adminToken, fecha_inicio, fecha_fin);

      const res = await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('permite al admin cancelar una reserva de otro usuario -> 200', async () => {
      const { fecha_inicio, fecha_fin } = diasDesdeHoy(1, 2);
      const reserva = await crearReserva(userToken, adminToken, fecha_inicio, fecha_fin, 'aprobada');

      const res = await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.reservation.estado_aprobacion).toBe('cancelada');
    });

    it('no permite cancelar una reserva que ya inició -> 409', async () => {
      const { fecha_inicio, fecha_fin } = diasDesdeHoy(-1, 2);
      const reserva = await crearReserva(userToken, adminToken, fecha_inicio, fecha_fin);

      const res = await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(409);
    });

    it('no permite cancelar dos veces -> 409', async () => {
      const { fecha_inicio, fecha_fin } = diasDesdeHoy(1, 2);
      const reserva = await crearReserva(userToken, adminToken, fecha_inicio, fecha_fin);

      await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);
      const res = await request(app)
        .post(`/api/reservations/${reserva.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/reservations (filtro "próximas" vs historial)', () => {
    it('excluye reservas ya pasadas por defecto', async () => {
      const futura = await crearReserva(userToken, adminToken, ...Object.values(diasDesdeHoy(1, 2)));
      await crearReserva(userToken, adminToken, ...Object.values(diasDesdeHoy(-5, -4)));

      const res = await request(app)
        .get('/api/reservations?mine=1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(futura.id);
    });

    it('con ?todos=1 devuelve también el historial (el admin puede verlas)', async () => {
      await crearReserva(userToken, adminToken, ...Object.values(diasDesdeHoy(1, 2)));
      await crearReserva(userToken, adminToken, ...Object.values(diasDesdeHoy(-5, -4)));

      const res = await request(app)
        .get('/api/reservations?todos=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('incluye el nombre del solicitante en la respuesta', async () => {
      await crearReserva(userToken, adminToken, ...Object.values(diasDesdeHoy(1, 2)));

      const res = await request(app)
        .get('/api/reservations?todos=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.data[0].user.nombre).toBe(userData.nombre);
    });
  });
});