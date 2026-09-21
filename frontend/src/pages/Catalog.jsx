import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const ESTADOS = ['disponible', 'en_uso', 'mantenimiento'];

export default function Catalog() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [tipos, setTipos] = useState([]);
  const [filters, setFilters] = useState({ tipo: '', estado: '' });
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reserving, setReserving] = useState(null);
  const [reserveForm, setReserveForm] = useState({ fecha_inicio: '', fecha_fin: '' });
  const [reserveMsg, setReserveMsg] = useState({ type: '', text: '' });

  const loadAssets = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.estado) params.estado = filters.estado;
      const res = await api.get('/assets', { params });
      setAssets(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los recursos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.tipo, filters.estado]);

  useEffect(() => {
    api.get('/assets', { params: { limit: 100 } })
      .then((res) => {
        setTipos([...new Set(res.data.data.map((a) => a.tipo))].sort());
      })
      .catch(() => {});
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const openReserve = (asset) => {
    setReserving(asset);
    setReserveForm({ fecha_inicio: '', fecha_fin: '' });
    setReserveMsg({ type: '', text: '' });
  };

  const submitReserve = async (e) => {
    e.preventDefault();
    setReserveMsg({ type: '', text: '' });
    try {
      await api.post('/reservations', {
        asset_id: reserving.id,
        fecha_inicio: new Date(reserveForm.fecha_inicio).toISOString(),
        fecha_fin: new Date(reserveForm.fecha_fin).toISOString()
      });
      setReserveMsg({ type: 'success', text: 'Reserva creada correctamente. Quedó pendiente de aprobación.' });
      setReserving(null);
      setMessage('Reserva solicitada correctamente.');
      loadAssets();
    } catch (err) {
      setReserveMsg({ type: 'error', text: err.response?.data?.message || 'No se pudo crear la reserva.' });
    }
  };

  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const badgeClass = (estado) =>
    estado === 'disponible' ? 'badge-success' : estado === 'en_uso' ? 'badge-info' : 'badge-warning';

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">Catálogo de Recursos</h2>
          <p className="card-subtitle">Consulta y reserva los recursos de la organización</p>
        </div>
      </div>

      {message && (
        <div className="alert alert-success">
          {message}
          <span style={{ float: 'right' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setMessage('')}>Cerrar</button>
          </span>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="filters">
          <div className="form-group">
            <label className="label" htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" className="select" value={filters.tipo} onChange={handleFilterChange}>
              <option value="">Todos los tipos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="estado">Estado</label>
            <select id="estado" name="estado" className="select" value={filters.estado} onChange={handleFilterChange}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        {loading ? (
          <p className="text-muted">Cargando recursos…</p>
        ) : assets.length === 0 ? (
          <div className="empty-state">No se encontraron recursos con los filtros seleccionados.</div>
        ) : (
          assets.map((asset) => (
            <div className="card" key={asset.id}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{asset.nombre}</h3>
                <span className={`badge ${badgeClass(asset.estado)}`}>{asset.estado}</span>
              </div>
              <p className="text-muted" style={{ margin: 0 }}>
                <strong>Tipo:</strong> {asset.tipo}
              </p>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>
                <strong>Ubicación:</strong> {asset.ubicacion || '—'}
              </p>

              {asset.estado === 'disponible' ? (
                reserving?.id === asset.id ? (
                  <form className="mt-4" onSubmit={submitReserve}>
                    <div className="form-group">
                      <label className="label">Inicio</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={reserveForm.fecha_inicio}
                        onChange={(e) => setReserveForm({ ...reserveForm, fecha_inicio: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Fin</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={reserveForm.fecha_fin}
                        onChange={(e) => setReserveForm({ ...reserveForm, fecha_fin: e.target.value })}
                        required
                      />
                    </div>
                    {reserveMsg.type && (
                      <div className={`alert alert-${reserveMsg.type}`}>{reserveMsg.text}</div>
                    )}
                    <div className="flex" style={{ gap: 8 }}>
                      <button type="submit" className="btn btn-primary btn-sm">Confirmar reserva</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReserving(null)}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn btn-primary btn-sm mt-4" onClick={() => openReserve(asset)}>
                    Reservar
                  </button>
                )
              ) : (
                <p className="text-muted mt-4" style={{ fontSize: 13 }}>
                  No disponible para reserva.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex-between mt-8">
          <span className="text-muted" style={{ fontSize: 14 }}>
            Página {page} de {totalPages} · {total} recurso(s)
          </span>
          <div className="flex" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Anterior
            </button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="alert alert-info mt-8">
          Como administrador puedes crear nuevos recursos desde el Panel Admin.
        </div>
      )}
    </div>
  );
}