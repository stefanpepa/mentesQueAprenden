import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import { format } from 'date-fns';
import { Plus, X, Send } from 'lucide-react';
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

const TIPO_OPTIONS = [
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'evaluacion', label: 'Evaluación' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'reunion_interdisciplinaria', label: 'Reunión interdisciplinaria' }
];

export default function AgendaPage() {
  const { profesional, isAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const [rango, setRango] = useState({ inicio: null, fin: null });
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [filtroProf, setFiltroProf] = useState(profesional?.id || '');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('09:00');
  const [formData, setFormData] = useState({ paciente_id: '', tipo: 'tratamiento', notas: '', duracion: 50 });

  const { data: turnos } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['turnos-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['turnos-hoy'] });
      setModalNuevo(false);
      setFormData({ paciente_id: '', tipo: 'tratamiento', notas: '', duracion: 50 });
      toast.success('Turno creado');
    },
    onError: () => toast.error('Error al crear el turno')
  });

  const actualizarMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/turnos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos-agenda'] });
      setModalDetalle(null);
      toast.success('Turno actualizado');
    },
    onError: () => toast.error('Error al actualizar el turno')
  });

  const recordatorioMutation = useMutation({
    mutationFn: (id) => api.post(`/turnos/${id}/recordatorio`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos-agenda'] });
      toast.success('Recordatorio enviado');
    },
    onError: () => toast.error('Error al enviar el recordatorio')
  });

  const eventos = (turnos || []).map(t => ({
    id: t.id,
    title: t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : '(Sin paciente)',
    start: t.fecha_inicio,
    end: t.fecha_fin,
    backgroundColor: COLORES_ESTADO[t.estado] || '#6366f1',
    borderColor: COLORES_ESTADO[t.estado] || '#6366f1',
    extendedProps: t
  }));

  const handleDateSelect = (info) => {
    setNuevaFecha(format(info.start, 'yyyy-MM-dd'));
    setNuevaHora(format(info.start, 'HH:mm'));
    setModalNuevo(true);
  };

  const handleEventClick = (info) => {
    setModalDetalle(info.event.extendedProps);
  };

  const handleSubmitNuevo = (e) => {
    e.preventDefault();
    const inicio = new Date(`${nuevaFecha}T${nuevaHora}`);
    const fin = new Date(inicio.getTime() + (formData.duracion || 50) * 60000);
    crearMutation.mutate({
      fecha_inicio: inicio.toISOString(),
      fecha_fin: fin.toISOString(),
      profesional_id: filtroProf || profesional.id,
      paciente_id: formData.paciente_id || undefined,
      tipo: formData.tipo,
      notas: formData.notas
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
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos los profesionales</option>
              {profesionales?.map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => { setNuevaFecha(format(new Date(), 'yyyy-MM-dd')); setModalNuevo(true); }}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus size={16} /> Nuevo turno
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(COLORES_ESTADO).map(([estado, color]) => (
          <div key={estado} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </div>
        ))}
      </div>

      {/* Calendario */}
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
          datesSet={(info) => setRango({ inicio: info.startStr, fin: info.endStr })}
          height="auto"
          aspectRatio={1.8}
          nowIndicator
          businessHours={{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '20:00' }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </div>

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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Hora *</label>
              <input
                type="time"
                value={nuevaHora}
                onChange={(e) => setNuevaHora(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Duración (minutos)</label>
            <input
              type="number"
              value={formData.duracion}
              onChange={(e) => setFormData(p => ({ ...p, duracion: e.target.value }))}
              min={15} max={480} step={5}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Paciente</label>
            <select
              value={formData.paciente_id}
              onChange={(e) => setFormData(p => ({ ...p, paciente_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {crearMutation.isError && (
            <p className="text-sm text-red-600">{crearMutation.error?.response?.data?.error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalNuevo(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
            <button type="submit" disabled={crearMutation.isPending} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium">
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
              <p><span className="text-gray-500">Paciente:</span> <span className="font-medium">{modalDetalle.paciente ? `${modalDetalle.paciente.apellido}, ${modalDetalle.paciente.nombre}` : 'Sin paciente'}</span></p>
              <p><span className="text-gray-500">Fecha:</span> <span className="font-medium">{format(new Date(modalDetalle.fecha_inicio), "d/MM/yyyy 'a las' HH:mm")}</span></p>
              <p><span className="text-gray-500">Profesional:</span> <span className="font-medium">{modalDetalle.profesional?.apellido}</span></p>
              <p><span className="text-gray-500">Tipo:</span> <span className="font-medium">{TIPO_OPTIONS.find(t => t.value === modalDetalle.tipo)?.label}</span></p>
              {modalDetalle.notas && <p><span className="text-gray-500">Notas:</span> {modalDetalle.notas}</p>}
            </div>

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
            <div className="flex gap-2 pt-2">
              {modalDetalle.paciente?.telefono && (
                <button
                  onClick={() => recordatorioMutation.mutate(modalDetalle.id)}
                  disabled={recordatorioMutation.isPending || modalDetalle.recordatorio_enviado}
                  className="flex items-center gap-2 flex-1 justify-center py-2.5 border border-teal-200 text-teal-600 hover:bg-teal-50 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  <Send size={14} />
                  {modalDetalle.recordatorio_enviado ? 'Recordatorio enviado' : 'Enviar recordatorio'}
                </button>
              )}
              {modalDetalle.paciente_id && (
                <a
                  href={`/sesiones/nueva?paciente_id=${modalDetalle.paciente_id}&turno_id=${modalDetalle.id}`}
                  className="flex-1 text-center py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium"
                >
                  Registrar sesión
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
