import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Maintenance() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ asset_id: '', descripcion: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [assetsRes, logsRes] = await Promise.all([
        api.get('/assets', { params: { limit: 100 } }),
        api.get('/maintenance')
      ]);
      setAssets(assetsRes.data.data);
      setLogs(logsRes.data.data);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudieron cargar los datos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitReport = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      await api.post('/maintenance', {
        asset_id: Number(form.asset_id),
        descripcion: form.descripcion
      });
      setMsg({ type: 'success', text: 'Falla reportada. Se generó una alerta automática al personal de soporte.' });
      setForm({ asset_id: '', descripcion: '' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudo reportar la falla.' });
    }
  };

  const updateEstado = async (log, estado) => {
    try {
      await api.patch(`/maintenance/${log.id}`, { estado_reparacion: estado });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudo actualizar el estado.' });
    }
  };

  const estadoBadge = (estado) =>
    estado === 'completado' ? 'badge-success' : estado === 'en_proceso' ? 'badge-info' : 'badge-warning';

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">Mantenimiento y Soporte</h2>
          <p className="card-subtitle">Reporta fallas de equipo; el sistema alerta automáticamente al personal de soporte</p>
        </div>
      </div>

      {msg.type && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Reportar una falla</h3>
          <form className="mt-4" onSubmit={submitReport}>
            <div className="form-group">
              <label className="label">Equipo / recurso</label>
              <select
                className="select"
                value={form.asset_id}
                onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                required
              >
                <option value="">Selecciona un recurso…</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Descripción de la falla</label>
              <textarea
                className="textarea"
                placeholder="Describe qué le pasa al equipo, desde cuándo, etc."
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-danger">Reportar falla</button>
          </form>
        </div>

        <div className="card">
          <h3 className="card-title">Historial de mantenimiento</h3>
          {loading ? (
            <p className="text-muted">Cargando…</p>
          ) : logs.length === 0 ? (
            <p className="text-muted">No hay reportes de mantenimiento.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Descripción</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  {user?.role === 'admin' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.asset?.nombre || `Activo #${log.asset_id}`}</td>
                    <td style={{ maxWidth: 220 }}>{log.descripcion}</td>
                    <td>
                      {new Date(log.fecha_reporte).toLocaleDateString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <span className={`badge ${estadoBadge(log.estado_reparacion)}`}>{log.estado_reparacion}</span>
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        {log.estado_reparacion !== 'completado' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => updateEstado(log, 'completado')}
                          >
                            Marcar completada
                          </button>
                        )}
                      </td>
                    )}
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