import { useEffect, useMemo, useState, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api/client';

const localizer = momentLocalizer(moment);

export default function CalendarPage() {
  const [reservations, setReservations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ asset_id: '', fecha_inicio: '', fecha_fin: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resRes, assetsRes] = await Promise.all([
        api.get('/reservations'),
        api.get('/assets', { params: { limit: 100 } })
      ]);
      setReservations(resRes.data.data);
      setAssets(assetsRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el calendario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const events = useMemo(
    () =>
      reservations.map((r) => ({
        id: r.id,
        title: r.asset?.nombre || `Recurso #${r.asset_id}`,
        start: new Date(r.fecha_inicio),
        end: new Date(r.fecha_fin),
        estado: r.estado_aprobacion
      })),
    [reservations]
  );

  const eventPropGetter = useCallback((event) => ({
    className: event.estado === 'pendiente' ? 'event-pendiente' : ''
  }), []);

  const handleSelectSlot = useCallback(({ start, end }) => {
    setSelectedSlot({ start, end });
    setForm({
      asset_id: '',
      fecha_inicio: moment(start).format('YYYY-MM-DDTHH:mm'),
      fecha_fin: moment(end).format('YYYY-MM-DDTHH:mm')
    });
    setMsg({ type: '', text: '' });
  }, []);

  const submitReserve = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      await api.post('/reservations', {
        asset_id: Number(form.asset_id),
        fecha_inicio: new Date(form.fecha_inicio).toISOString(),
        fecha_fin: new Date(form.fecha_fin).toISOString()
      });
      setMsg({ type: 'success', text: 'Reserva creada. Quedó pendiente de aprobación.' });
      setSelectedSlot(null);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'No se pudo crear la reserva.' });
    }
  };

  const disponibles = assets.filter((a) => a.estado === 'disponible');

  const formats = {
    dateFormat: 'DD',
    dayFormat: 'ddd DD/MM',
    timeGutterFormat: 'HH:mm'
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">Calendario de Disponibilidad</h2>
          <p className="card-subtitle">
            Visualiza y aparta los recursos compartidos sin generar cruces de horarios
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
        <div className="card">
          {loading ? (
            <p className="text-muted">Cargando calendario…</p>
          ) : (
            <div className="calendar-wrapper">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                formats={formats}
                selectable
                onSelectSlot={handleSelectSlot}
                eventPropGetter={eventPropGetter}
                defaultView="month"
                views={['month', 'week', 'day']}
                messages={{
                  date: 'Fecha',
                  time: 'Hora',
                  event: 'Reserva',
                  allDay: 'Todo el día',
                  week: 'Semana',
                  work_week: 'Semana laboral',
                  day: 'Día',
                  month: 'Mes',
                  previous: 'Atrás',
                  next: 'Adelante',
                  today: 'Hoy',
                  agenda: 'Agenda',
                  noEventsInRange: 'No hay reservas en este rango.'
                }}
              />
            </div>
          )}
        </div>

        <div>
          {selectedSlot ? (
            <div className="card">
              <h3 className="card-title">Nueva reserva</h3>
              <p className="card-subtitle">
                {moment(selectedSlot.start).format('DD/MM/YYYY HH:mm')} → {moment(selectedSlot.end).format('DD/MM/YYYY HH:mm')}
              </p>
              <form className="mt-4" onSubmit={submitReserve}>
                <div className="form-group">
                  <label className="label">Recurso</label>
                  <select
                    className="select"
                    value={form.asset_id}
                    onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                    required
                  >
                    <option value="">Selecciona un recurso…</option>
                    {disponibles.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Inicio</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Fin</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.fecha_fin}
                    onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                    required
                  />
                </div>
                {msg.type && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                <div className="flex" style={{ gap: 8 }}>
                  <button type="submit" className="btn btn-primary">Reservar</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedSlot(null)}>Cancelar</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card">
              <h3 className="card-title">Próximas reservas</h3>
              {reservations.length === 0 ? (
                <p className="text-muted">Aún no hay reservas. Selecciona un rango de fechas en el calendario para crear una.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {reservations.slice(0, 8).map((r) => (
                    <li key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <strong>{r.asset?.nombre || `Recurso #${r.asset_id}`}</strong>
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        {moment(r.fecha_inicio).format('DD/MM/YYYY HH:mm')} → {moment(r.fecha_fin).format('DD/MM/YYYY HH:mm')}
                      </div>
                      <span className={`badge badge-${r.estado_aprobacion === 'aprobada' ? 'success' : r.estado_aprobacion === 'pendiente' ? 'warning' : 'neutral'}`}>
                        {r.estado_aprobacion}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}