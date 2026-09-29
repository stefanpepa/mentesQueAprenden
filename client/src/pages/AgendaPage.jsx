import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import { format } from 'date-fns';
import { Plus, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';

const COLORES_ESTADO = {
  programado: '#6366f1',
  confirmado: '#10b981',
  cancelado: '#ef4444',
  ausente: '#f59e0b',
  realizado: '#6b7280'
};

const COLOR_SESION = '#8b5cf6';
const COLOR_OCUPADO = '#9ca3af';

const CONSULTORIOS = [1, 2, 3];

// Referencias estables a nivel de módulo: si estos objetos se recrean en cada
// render (como estaban antes, definidos inline en el JSX), FullCalendar los
// interpreta como un cambio real de configuración y reinicializa el
// calendario, lo que vuelve a disparar datesSet → setRango → re-render →
// props nuevos otra vez, entrando en un loop infinito ("Maximum update depth
// exceeded"). Al vivir fuera del componente, son la misma referencia siempre.
const BUSINESS_HOURS = { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '20:00' };
const EVENT_TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false };

const TIPO_OPTIONS = [
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'evaluacion', label: 'Evaluación' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'reunion_interdisciplinaria', label: 'Reunión interdisciplinaria' }
];

export default function AgendaPage() {
  const { profesional, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const [rango, setRango] = useState({ inicio: null, fin: null });
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [filtroProf, setFiltroProf] = useState(profesional?.id || '');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('09:00');
  const [formData, setFormData] = useState({ paciente_id: '', tipo: 'tratamiento', notas: '', duracion: 50, profesional_id: '', consultorio: 1 });

  const { data: turnos, isLoading: cargandoTurnos } = useQuery({
    queryKey: ['turnos-agenda', rango, filtroProf],
    queryFn: () => {
      if (!rango.inicio) return [];
      return api.get('/turnos', {
        params: {
          fecha_inicio: rango.inicio,
          fecha_fin: rango.fin,
          profesional_id: filtroProf || undefined
        }
      }).then(r => r.data);
    },
    enabled: !!rango.inicio
  });

  const { data: profesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => api.get('/profesionales').then(r => r.data)
  });

  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-select'],
    queryFn: () => api.get('/pacientes', { params: { limit: 200 } }).then(r => r.data?.data || [])
  });

  const crearMutation = useMutation({
    mutationFn: (data) => api.post('/turnos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('turno') });
      setModalNuevo(false);
      setFormData({ paciente_id: '', tipo: 'tratamiento', notas: '', duracion: 50, profesional_id: '', consultorio: 1 });
      toast.success('Turno creado');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al crear el turno')
  });

  const actualizarMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/turnos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('turno') });
      setModalDetalle(null);
      toast.success('Turno actualizado');
    },
    onError: () => toast.error('Error al actualizar el turno')
  });

  const eventos = useMemo(() => (turnos || []).map(t => {
    const color = t.ocupado ? COLOR_OCUPADO : t.es_sesion ? COLOR_SESION : (COLORES_ESTADO[t.estado] || '#6366f1');
    return {
      id: t.id,
      title: t.ocupado
        ? `Consultorio ${t.consultorio} ocupado`
        : t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : '(Sin paciente)',
      start: t.fecha_inicio,
      end: t.fecha_fin,
      backgroundColor: color,
      borderColor: color,
      extendedProps: t
    };
  }), [turnos]);

  // Consultorios ocupados AHORA MISMO, para el semáforo de disponibilidad.
  const ahora = Date.now();
  const consultoriosOcupadosAhora = new Set(
    (turnos || [])
      .filter(t => t.estado !== 'cancelado' && new Date(t.fecha_inicio).getTime() <= ahora && new Date(t.fecha_fin).getTime() > ahora)
      .map(t => t.consultorio)
  );

  const handleDateSelect = (info) => {
    setNuevaFecha(format(info.start, 'yyyy-MM-dd'));
    setNuevaHora(format(info.start, 'HH:mm'));
    setFormData(p => ({ ...p, profesional_id: filtroProf || profesional.id }));
    setModalNuevo(true);
  };

  const handleEventClick = (info) => {
    const item = info.event.extendedProps;
    // Una sesión sin turno no tiene estado de turno que cambiar: se abre la sesión.
    if (item.es_sesion) navigate(`/sesiones/${item.sesion.id}`);
    else setModalDetalle(item);
  };

  const handleSubmitNuevo = (e) => {
    e.preventDefault();
    const inicio = new Date(`${nuevaFecha}T${nuevaHora}`);
    const fin = new Date(inicio.getTime() + (formData.duracion || 50) * 60000);
    crearMutation.mutate({
      fecha_inicio: inicio.toISOString(),
      fecha_fin: fin.toISOString(),
      profesional_id: formData.profesional_id || filtroProf || profesional.id,
      paciente_id: formData.paciente_id || undefined,
      tipo: formData.tipo,
      notas: formData.notas,
      consultorio: Number(formData.consultorio)
    });
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin() && (
            <select
              value={filtroProf}
              onChange={(e) => setFiltroProf(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos los profesionales</option>
              {profesionales?.map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setNuevaFecha(format(new Date(), 'yyyy-MM-dd'));
              setFormData(p => ({ ...p, profesional_id: filtroProf || profesional.id }));
              setModalNuevo(true);
            }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus size={16} /> Nuevo turno
          </button>
        </div>
      </div>

      {/* Semáforo de consultorios (disponibilidad ahora mismo) */}
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
          <DoorOpen size={14} /> Consultorios ahora:
        </span>
        {CONSULTORIOS.map(n => {
          const ocupado = consultoriosOcupadosAhora.has(n);
          return (
            <span
              key={n}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                ocupado ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${ocupado ? 'bg-red-500' : 'bg-green-500'}`} />
              Consultorio {n} — {ocupado ? 'ocupado' : 'libre'}
            </span>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(COLORES_ESTADO).map(([estado, color]) => (
          <div key={estado} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_SESION }} />
          Sesión registrada
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_OCUPADO }} />
          Ocupado (otro profesional)
        </div>
      </div>

      {/* Calendario */}
      {cargandoTurnos ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-1/3 mb-4" />
          <div className="h-96 bg-gray-50 rounded" />
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="timeGridWeek"
          locales={[esLocale]}
          locale="es"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
          }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          events={eventos}
          selectable
          selectMirror
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={(info) => setRango(prev =>
            (prev.inicio === info.startStr && prev.fin === info.endStr)
              ? prev
              : { inicio: info.startStr, fin: info.endStr }
          )}
          height="auto"
          aspectRatio={1.8}
          nowIndicator
          businessHours={BUSINESS_HOURS}
          eventTimeFormat={EVENT_TIME_FORMAT}
        />
      </div>
      )}

      {/* Modal: Nuevo turno */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo turno">
        <form onSubmit={handleSubmitNuevo} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha *</label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Hora *</label>
              <input
                type="time"
                value={nuevaHora}
                onChange={(e) => setNuevaHora(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Duración (minutos)</label>
              <input
                type="number"
                value={formData.duracion}
                onChange={(e) => setFormData(p => ({ ...p, duracion: e.target.value }))}
                min={15} max={480} step={5}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Consultorio *</label>
              <select
                value={formData.consultorio}
                onChange={(e) => setFormData(p => ({ ...p, consultorio: e.target.value }))}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CONSULTORIOS.map(n => <option key={n} value={n}>Consultorio {n}</option>)}
              </select>
            </div>
          </div>

          {isAdmin() && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Profesional *</label>
              <select
                value={formData.profesional_id}
                onChange={(e) => setFormData(p => ({ ...p, profesional_id: e.target.value }))}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Seleccionar profesional...</option>
                {profesionales?.map(p => (
                  <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Paciente</label>
            <select
              value={formData.paciente_id}
              onChange={(e) => setFormData(p => ({ ...p, paciente_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sin paciente asignado</option>
              {pacientes?.map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — DNI {p.dni}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de sesión</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(p => ({ ...p, tipo: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData(p => ({ ...p, notas: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {crearMutation.isError && (
            <p className="text-sm text-red-600">{crearMutation.error?.response?.data?.error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalNuevo(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
            <button type="submit" disabled={crearMutation.isPending} className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium">
              {crearMutation.isPending ? 'Guardando...' : 'Crear turno'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalle turno */}
      <Modal open={!!modalDetalle} onClose={() => setModalDetalle(null)} title="Detalle del turno">
        {modalDetalle && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              {modalDetalle.ocupado ? (
                <p><span className="text-gray-500">Consultorio {modalDetalle.consultorio}:</span> <span className="font-medium">Ocupado por otro profesional en este horario</span></p>
              ) : (
                <>
                  <p><span className="text-gray-500">Paciente:</span> <span className="font-medium">{modalDetalle.paciente ? `${modalDetalle.paciente.apellido}, ${modalDetalle.paciente.nombre}` : 'Sin paciente'}</span></p>
                  <p><span className="text-gray-500">Fecha:</span> <span className="font-medium">{format(new Date(modalDetalle.fecha_inicio), "d/MM/yyyy 'a las' HH:mm")}</span></p>
                  <p><span className="text-gray-500">Profesional:</span> <span className="font-medium">{modalDetalle.profesional?.apellido}</span></p>
                  <p><span className="text-gray-500">Consultorio:</span> <span className="font-medium">{modalDetalle.consultorio}</span></p>
                  <p><span className="text-gray-500">Tipo:</span> <span className="font-medium">{TIPO_OPTIONS.find(t => t.value === modalDetalle.tipo)?.label}</span></p>
                  {modalDetalle.notas && <p><span className="text-gray-500">Notas:</span> {modalDetalle.notas}</p>}
                </>
              )}
            </div>

            {!modalDetalle.ocupado && (
              <>
                {/* Cambiar estado */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Estado</label>
                  <div className="flex flex-wrap gap-2">
                    {['programado', 'confirmado', 'cancelado', 'ausente', 'realizado'].map(estado => (
                      <button
                        key={estado}
                        onClick={() => actualizarMutation.mutate({ id: modalDetalle.id, estado })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                          modalDetalle.estado === estado
                            ? 'text-white border-transparent'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                        style={modalDetalle.estado === estado ? { backgroundColor: COLORES_ESTADO[estado] } : {}}
                      >
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Acciones */}
                {modalDetalle.paciente_id && (
                  <div className="flex gap-2 pt-2">
                    {modalDetalle.sesion?.id ? (
                      <a
                        href={`/sesiones/${modalDetalle.sesion.id}`}
                        className="flex-1 text-center py-2.5 border border-primary-200 text-primary-700 hover:bg-primary-50 rounded-xl text-sm font-medium"
                      >
                        Ver sesión registrada
                      </a>
                    ) : (
                      <a
                        href={`/sesiones/nueva?${new URLSearchParams({
                          paciente_id: modalDetalle.paciente_id,
                          turno_id: modalDetalle.id,
                          fecha: modalDetalle.fecha_inicio,
                          tipo: modalDetalle.tipo || 'tratamiento',
                          consultorio: String(modalDetalle.consultorio || 1),
                          duracion: String(Math.round((new Date(modalDetalle.fecha_fin) - new Date(modalDetalle.fecha_inicio)) / 60000))
                        })}`}
                        className="flex-1 text-center py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium"
                      >
                        Registrar sesión
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
