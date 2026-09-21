import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import api from '../api/client';

const ESTADO_COLORS = {
  disponible: '#059669',
  en_uso: '#2563eb',
  mantenimiento: '#d97706'
};

export default function AdminPanel() {
  const [assets, setAssets] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newAsset, setNewAsset] = useState({ nombre: '', tipo: '', ubicacion: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [assetsRes, resRes, logsRes] = await Promise.all([
        api.get('/assets', { params: { limit: 100 } }),
        api.get('/reservations'),
        api.get('/maintenance')
      ]);
      setAssets(assetsRes.data.data);
      setReservations(resRes.data.data);
      setLogs(logsRes.data.data);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudieron cargar los indicadores.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byEstado = [
    { name: 'Disponibles', value: assets.filter((a) => a.estado === 'disponible').length },
    { name: 'En uso', value: assets.filter((a) => a.estado === 'en_uso').length },
    { name: 'Mantenimiento', value: assets.filter((a) => a.estado === 'mantenimiento').length }
  ].filter((d) => d.value > 0);

  const usageByAsset = assets.map((a) => {
    const count = reservations.filter((r) => r.asset_id === a.id).length;
    return { name: a.nombre.length > 18 ? `${a.nombre.slice(0, 18)}…` : a.nombre, reservas: count };
  });

  const enReparacion = logs.filter((l) => l.estado_reparacion !== 'completado').length;

  const submitAsset = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      await api.post('/assets', newAsset);
      setMsg({ type: 'success', text: 'Recurso creado correctamente.' });
      setNewAsset({ nombre: '', tipo: '', ubicacion: '' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudo crear el recurso.' });
    }
  };

  const updateState = async (id, estado) => {
    try {
      await api.patch(`/reservations/${id}`, { estado_aprobacion: estado });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudo actualizar la reserva.' });
    }
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">Panel de Administración</h2>
          <p className="card-subtitle">Indicadores de uso, mantenimiento y disponibilidad de los recursos</p>
        </div>
      </div>

      {msg.type && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="grid grid-4">
        <div className="card stat-card">
          <div className="stat-value">{assets.length}</div>
          <div className="stat-label">Recursos totales</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#059669' }}>{assets.filter((a) => a.estado === 'disponible').length}</div>
          <div className="stat-label">Disponibles</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#2563eb' }}>{reservations.length}</div>
          <div className="stat-label">Reservas registradas</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#d97706' }}>{enReparacion}</div>
          <div className="stat-label">Equipos en reparación</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Activos por estado</h3>
          <div style={{ height: 280, marginTop: 12 }}>
            {loading || byEstado.length === 0 ? (
              <p className="text-muted">Sin datos para graficar.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byEstado}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {byEstado.map((entry) => (
                      <Cell key={entry.name} fill={ESTADO_COLORS[entry.name.toLowerCase()]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Índice de uso por recurso</h3>
          <div style={{ height: 280, marginTop: 12 }}>
            {loading || usageByAsset.length === 0 ? (
              <p className="text-muted">Sin datos para graficar.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageByAsset}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="reservas" name="Reservas" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Crear nuevo recurso</h3>
          <form className="mt-4" onSubmit={submitAsset}>
            <div className="form-group">
              <label className="label">Nombre</label>
              <input
                type="text"
                className="input"
                value={newAsset.nombre}
                onChange={(e) => setNewAsset({ ...newAsset, nombre: e.target.value })}
                placeholder="Ej. Proyector Epson"
                required
              />
            </div>
            <div className="form-group">
              <label className="label">Tipo</label>
              <input
                type="text"
                className="input"
                value={newAsset.tipo}
                onChange={(e) => setNewAsset({ ...newAsset, tipo: e.target.value })}
                placeholder="Ej. Proyector, Laptop, Sala, Vehículo"
                required
              />
            </div>
            <div className="form-group">
              <label className="label">Ubicación</label>
              <input
                type="text"
                className="input"
                value={newAsset.ubicacion}
                onChange={(e) => setNewAsset({ ...newAsset, ubicacion: e.target.value })}
                placeholder="Ej. Sala A, Oficina 203"
              />
            </div>
            <button type="submit" className="btn btn-primary">Crear recurso</button>
          </form>
        </div>

        <div className="card">
          <h3 className="card-title">Reservas pendientes de aprobación</h3>
          {loading ? (
            <p className="text-muted">Cargando…</p>
          ) : reservations.filter((r) => r.estado_aprobacion === 'pendiente').length === 0 ? (
            <p className="text-muted">No hay reservas pendientes.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Inicio</th>
                  <th>Solicitante</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reservations
                  .filter((r) => r.estado_aprobacion === 'pendiente')
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.asset?.nombre || `Activo #${r.asset_id}`}</td>
                      <td>{new Date(r.fecha_inicio).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{r.user_id}</td>
                      <td>
                        <div className="flex" style={{ gap: 6 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => updateState(r.id, 'aprobada')}>
                            Aprobar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => updateState(r.id, 'rechazada')}>
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}