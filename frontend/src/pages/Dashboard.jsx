import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Dashboard() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [assetsRes, resRes, pendingRes] = await Promise.all([
          api.get('/assets', { params: { limit: 100 } }),
          api.get('/reservations', { params: { mine: 1 } }),
          api.get('/reservations', { params: { estado: 'pendiente' } })
        ]);
        if (!active) return;
        setAssets(assetsRes.data.data);
        setReservations(resRes.data.data);
        setPendientes(pendingRes.data.data.length);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'No se pudieron cargar los datos.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const disponibles = assets.filter((a) => a.estado === 'disponible').length;
  const enUso = assets.filter((a) => a.estado === 'en_uso' || a.en_uso_ahora).length;
  const mantenimiento = assets.filter((a) => a.estado === 'mantenimiento').length;

  const puedeCancelar = (r) =>
    (r.estado_aprobacion === 'pendiente' || r.estado_aprobacion === 'aprobada') &&
    new Date(r.fecha_inicio).getTime() > Date.now();

  const cancelReservation = async (id) => {
    if (!window.confirm('¿Cancelar esta reservación?')) return;
    try {
      await api.post(`/reservations/${id}/cancel`);
      setError('');
      const res = await api.get('/reservations', { params: { mine: 1 } });
      setReservations(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cancelar la reserva.');
    }
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">Hola, {user?.nombre} 👋</h2>
          <p className="card-subtitle">
            Resumen general de los recursos de la organización
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-4">
        <div className="card stat-card">
          <div className="stat-value">{assets.length}</div>
          <div className="stat-label">Total de recursos</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#059669' }}>{disponibles}</div>
          <div className="stat-label">Disponibles</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#2563eb' }}>{enUso}</div>
          <div className="stat-label">En uso</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#d97706' }}>{mantenimiento}</div>
          <div className="stat-label">En mantenimiento</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Acciones rápidas</h3>
          </div>
          <div className="flex" style={{ gap: 12, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/recursos">Ver catálogo de recursos</Link>
            <Link className="btn btn-outline" to="/calendario">Consultar disponibilidad</Link>
            <Link className="btn btn-secondary" to="/mantenimiento">Reportar una falla</Link>
            {user?.role === 'admin' && (
              <Link className="btn btn-secondary" to="/admin">Panel de administración</Link>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Mis reservas</h3>
            <p className="card-subtitle">Tus solicitudes y su estado</p>
          </div>
          {loading ? (
            <p className="text-muted">Cargando…</p>
          ) : reservations.length === 0 ? (
            <p className="text-muted">Aún no has realizado reservas.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Inicio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reservations.slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <td>{r.asset?.nombre || `Activo #${r.asset_id}`}</td>
                    <td>{new Date(r.fecha_inicio).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.estado_aprobacion === 'aprobada'
                            ? 'badge-success'
                            : r.estado_aprobacion === 'pendiente'
                              ? 'badge-warning'
                              : r.estado_aprobacion === 'rechazada'
                                ? 'badge-danger'
                                : 'badge-neutral'
                        }`}
                      >
                        {r.estado_aprobacion}
                      </span>
                    </td>
                    <td>
                      {puedeCancelar(r) && (
                        <button className="btn btn-danger btn-sm" onClick={() => cancelReservation(r.id)}>
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pendientes > 0 && user?.role === 'admin' && (
        <div className="alert alert-info">
          Hay {pendientes} reserva(s) pendiente(s) de aprobación.
        </div>
      )}
    </div>
  );
}