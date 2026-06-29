import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar, Users, ArrowLeftRight, Plus, Clock,
  AlertCircle, DollarSign, Search, ChevronRight,
  CheckCircle, XCircle, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';

const TIPO_LABEL = {
  evaluacion: 'Evaluación', tratamiento: 'Tratamiento',
  seguimiento: 'Seguimiento', devolucion: 'Devolución',
  reunion_interdisciplinaria: 'Reunión'
};

const ESTADO_COLOR = {
  programado: 'bg-teal-100 text-teal-700',
  confirmado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
  ausente: 'bg-amber-100 text-amber-700',
  realizado: 'bg-gray-100 text-gray-600'
};

// Calendario semanal compacto para agenda expandida
function CalendarioSemanal({ turnos }) {
  const hoy = new Date();
  const lunesDeEstaSemana = startOfWeek(hoy, { weekStartsOn: 1 });
  const dias = Array.from({ length: 6 }, (_, i) => addDays(lunesDeEstaSemana, i));
  const horas = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  const turnoEnSlot = (dia, hora) =>
    (turnos || []).filter(t => {
      const ft = new Date(t.fecha_inicio);
      return isSameDay(ft, dia) && ft.getHours() === hora;
    });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header días */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          <div className="text-xs text-gray-400 text-center py-2" />
          {dias.map(dia => (
            <div key={dia.toISOString()} className={`text-center py-2 rounded-lg text-xs font-medium ${isSameDay(dia, hoy) ? 'bg-teal-600 text-white' : 'text-gray-600'}`}>
              <div>{format(dia, 'EEE', { locale: es })}</div>
              <div className="text-sm font-bold">{format(dia, 'd')}</div>
            </div>
          ))}
        </div>
        {/* Grilla de horas */}
        <div className="space-y-1">
          {horas.map(hora => (
            <div key={hora} className="grid grid-cols-7 gap-1">
              <div className="text-xs text-gray-400 text-right pr-2 py-1.5 leading-none">{hora}:00</div>
              {dias.map(dia => {
                const slots = turnoEnSlot(dia, hora);
                return (
                  <div key={dia.toISOString()} className={`rounded-lg min-h-[32px] text-xs p-1 ${isSameDay(dia, hoy) ? 'bg-teal-50' : 'bg-gray-50'}`}>
                    {slots.map(t => (
                      <div key={t.id} className="bg-teal-600 text-white rounded px-1 py-0.5 truncate text-[10px] mb-0.5">
                        {t.paciente ? `${t.paciente.apellido}` : 'Turno'}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profesional, isAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const semanaFin = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const [busqueda, setBusqueda] = useState('');
  const [modalDer, setModalDer] = useState(null);
  const [obsRespuesta, setObsRespuesta] = useState('');
  const [expanded, setExpanded] = useState(null); // 'agenda' | 'derivaciones' | 'pacientes'

  const toggle = (card) => setExpanded(prev => prev === card ? null : card);

  const { data: turnosHoy } = useQuery({
    queryKey: ['turnos-hoy'],
    queryFn: () => api.get('/turnos', { params: { fecha_inicio: `${hoy}T00:00:00`, fecha_fin: `${hoy}T23:59:59` } }).then(r => r.data)
  });

  const { data: turnosSemana } = useQuery({
    queryKey: ['turnos-semana'],
    queryFn: () => api.get('/turnos', { params: { fecha_inicio: `${hoy}T00:00:00`, fecha_fin: `${semanaFin}T23:59:59` } }).then(r => r.data),
    enabled: expanded === 'agenda'
  });

  const { data: turnosProximos } = useQuery({
    queryKey: ['turnos-proximos'],
    queryFn: () => api.get('/turnos', { params: { fecha_inicio: `${hoy}T00:00:00`, fecha_fin: `${semanaFin}T23:59:59` } }).then(r => r.data)
  });

  const { data: derivacionesPendientes } = useQuery({
    queryKey: ['derivaciones-pendientes'],
    queryFn: () => api.get('/derivaciones/pendientes').then(r => r.data)
  });

  const { data: derivacionesTodas } = useQuery({
    queryKey: ['derivaciones-todas'],
    queryFn: () => api.get('/derivaciones').then(r => r.data),
    enabled: expanded === 'derivaciones'
  });

  const { data: pacientesRecientes } = useQuery({
    queryKey: ['pacientes-recientes'],
    queryFn: () => api.get('/pacientes', { params: { limit: 6, page: 1 } }).then(r => r.data?.data || [])
  });

  const { data: todosPacientes } = useQuery({
    queryKey: ['pacientes-todos'],
    queryFn: () => api.get('/pacientes', { params: { limit: 50, page: 1 } }).then(r => r.data?.data || []),
    enabled: expanded === 'pacientes'
  });

  const { data: pagosPendientes } = useQuery({
    queryKey: ['sesiones-pendientes'],
    queryFn: () => api.get('/pagos/sesiones-pendientes').then(r => r.data)
  });

  const { data: busquedaResultados } = useQuery({
    queryKey: ['busqueda-dashboard', busqueda],
    queryFn: () => api.get('/pacientes', { params: { busqueda, limit: 5 } }).then(r => r.data?.data || []),
    enabled: busqueda.length > 1
  });

  const responderMutation = useMutation({
    mutationFn: ({ id, estado, observaciones }) =>
      api.patch(`/derivaciones/${id}/responder`, { estado, observaciones }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['derivaciones-pendientes'] });
      setModalDer(null);
      setObsRespuesta('');
      toast.success(vars.estado === 'aceptada' ? 'Derivación aceptada' : 'Derivación rechazada');
    },
    onError: () => toast.error('Error al responder')
  });

  const actualizarTurnoMutation = useMutation({
    mutationFn: ({ id, estado }) => api.patch(`/turnos/${id}`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos-hoy'] });
      toast.success('Turno actualizado');
    }
  });

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  const isAgenda = expanded === 'agenda';
  const isDer = expanded === 'derivaciones';
  const isPac = expanded === 'pacientes';

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">

      {/* Header + búsqueda */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saludo}, {profesional?.nombre}</h1>
          <p className="text-gray-500 capitalize">{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar paciente..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
          {busqueda.length > 1 && busquedaResultados && (
            <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {!busquedaResultados.length ? (
                <p className="px-4 py-3 text-sm text-gray-400">Sin resultados</p>
              ) : busquedaResultados.map(p => (
                <Link key={p.id} to={`/pacientes/${p.id}`} onClick={() => setBusqueda('')}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.apellido}, {p.nombre}</p>
                    <p className="text-xs text-gray-500">DNI {p.dni}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
              ))}
              <Link to="/pacientes" onClick={() => setBusqueda('')} className="flex px-4 py-2.5 text-sm text-teal-600 bg-teal-50 font-medium">
                Ver todos →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Turnos hoy" value={turnosHoy?.length ?? '—'} icon={Calendar} color="teal" href="/agenda" />
        <StatCard label="Esta semana" value={turnosProximos?.length ?? '—'} icon={Clock} color="blue" href="/agenda" />
        <StatCard label="Cobros pendientes" value={pagosPendientes?.length ?? '—'} icon={DollarSign} color={pagosPendientes?.length ? 'amber' : 'gray'} href="/pagos" alert={pagosPendientes?.length > 0} />
        <StatCard label="Derivaciones" value={derivacionesPendientes?.length ?? '—'} icon={ArrowLeftRight} color={derivacionesPendientes?.length ? 'red' : 'gray'} href="/derivaciones" alert={derivacionesPendientes?.length > 0} />
      </div>

      {/* Cards expandibles — fila principal */}
      <div className={`grid gap-4 transition-all duration-300 ${isAgenda || isDer ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>

        {/* AGENDA */}
        <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 ${isAgenda ? 'lg:col-span-2' : ''}`}>
          <button
            onClick={() => toggle('agenda')}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={16} className="text-teal-600" />
              Agenda de hoy
              {turnosHoy?.length > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{turnosHoy.length}</span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {!isAgenda && <Link to="/agenda" onClick={e => e.stopPropagation()} className="text-xs text-teal-600 font-medium hover:underline">Ver agenda</Link>}
              <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isAgenda ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Lista compacta (siempre visible) */}
          <div className={`divide-y divide-gray-50 transition-all duration-300 overflow-hidden ${isAgenda ? '' : 'max-h-64'} overflow-y-auto`}>
            {!turnosHoy?.length ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                <Calendar size={28} className="mx-auto mb-1 text-gray-200" />
                Sin turnos para hoy
              </div>
            ) : turnosHoy.map(turno => (
              <div key={turno.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-xs font-mono text-teal-600 w-11 flex-shrink-0">{format(new Date(turno.fecha_inicio), 'HH:mm')}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {turno.paciente ? `${turno.paciente.apellido}, ${turno.paciente.nombre}` : 'Sin paciente'}
                  </p>
                  <p className="text-xs text-gray-400">{TIPO_LABEL[turno.tipo] || turno.tipo}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[turno.estado] || 'bg-gray-100 text-gray-600'}`}>{turno.estado}</span>
                  {turno.estado === 'programado' && (
                    <button onClick={() => actualizarTurnoMutation.mutate({ id: turno.id, estado: 'realizado' })}
                      className="text-green-600 hover:text-green-700 text-xs font-bold" title="Marcar realizado">✓</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Calendario expandido */}
          <div className={`transition-all duration-300 overflow-hidden ${isAgenda ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="border-t border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vista semanal</p>
              <CalendarioSemanal turnos={turnosSemana} />
              <div className="mt-3 flex justify-end">
                <Link to="/agenda" className="text-sm text-teal-600 font-medium hover:underline flex items-center gap-1">
                  Abrir agenda completa <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* DERIVACIONES */}
        <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 ${isDer ? 'lg:col-span-2' : ''}`}>
          <button
            onClick={() => toggle('derivaciones')}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-teal-600" />
              Derivaciones pendientes
              {derivacionesPendientes?.length > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{derivacionesPendientes.length}</span>
              )}
            </h2>
            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isDer ? 'rotate-180' : ''}`} />
          </button>

          <div className={`transition-all duration-300 overflow-hidden ${isDer ? '' : 'max-h-64'} overflow-y-auto divide-y divide-gray-50`}>
            {!derivacionesPendientes?.length ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                <ArrowLeftRight size={28} className="mx-auto mb-1 text-gray-200" />
                Sin derivaciones pendientes
              </div>
            ) : derivacionesPendientes.map(der => (
              <div key={der.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{der.paciente?.apellido}, {der.paciente?.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">De {der.origen?.apellido} · {der.motivo?.slice(0, 60)}{der.motivo?.length > 60 ? '…' : ''}</p>
                  </div>
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalDer({ ...der, respuesta: 'aceptada' })}
                    className="flex items-center gap-1 flex-1 justify-center py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium">
                    <CheckCircle size={12} /> Aceptar
                  </button>
                  <button onClick={() => setModalDer({ ...der, respuesta: 'rechazada' })}
                    className="flex items-center gap-1 flex-1 justify-center py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium">
                    <XCircle size={12} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Todas las derivaciones expandido */}
          <div className={`transition-all duration-300 overflow-hidden ${isDer ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="border-t border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Historial completo</p>
              <div className="space-y-2 overflow-y-auto max-h-72">
                {!derivacionesTodas?.length ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sin derivaciones registradas</p>
                ) : derivacionesTodas.map(der => (
                  <div key={der.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{der.paciente?.apellido}, {der.paciente?.nombre}</p>
                      <p className="text-xs text-gray-500">{der.origen?.apellido} → {der.destino?.apellido} · {format(new Date(der.created_at), 'd/MM/yy')}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                      der.estado === 'aceptada' ? 'bg-green-100 text-green-700' :
                      der.estado === 'rechazada' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'}`}>
                      {der.estado}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Link to="/derivaciones" className="text-sm text-teal-600 font-medium hover:underline flex items-center gap-1">
                  Ver en detalle <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PACIENTES — fila completa, expande hacia abajo */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300">
        <button
          onClick={() => toggle('pacientes')}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users size={16} className="text-teal-600" />
            Pacientes
          </h2>
          <div className="flex items-center gap-2">
            <Link to="/pacientes/nuevo" onClick={e => e.stopPropagation()}
              className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
              <Plus size={11} /> Nuevo
            </Link>
            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isPac ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Vista compacta (6 pacientes) */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-300 overflow-hidden ${isPac ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'}`}>
          {!pacientesRecientes?.length ? (
            <div className="col-span-3 px-4 py-6 text-center text-gray-400 text-sm">
              <Users size={28} className="mx-auto mb-1 text-gray-200" />
              Sin pacientes registrados
            </div>
          ) : pacientesRecientes.map(p => (
            <Link key={p.id} to={`/pacientes/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 sm:border-b-0">
              <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-teal-700 font-semibold text-xs">{p.nombre[0]}{p.apellido[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.apellido}, {p.nombre}</p>
                <p className="text-xs text-gray-500">DNI {p.dni}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>

        {/* Vista expandida (todos) */}
        <div className={`transition-all duration-500 overflow-hidden ${isPac ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="divide-y divide-gray-50 overflow-y-auto max-h-[600px]">
            {!todosPacientes?.length ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin pacientes</div>
            ) : todosPacientes.map(p => (
              <Link key={p.id} to={`/pacientes/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-700 font-semibold text-xs">{p.nombre[0]}{p.apellido[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.apellido}, {p.nombre}</p>
                  <p className="text-xs text-gray-500">DNI {p.dni} · {p.estado}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
            <Link to="/pacientes" className="text-sm text-teal-600 font-medium hover:underline flex items-center gap-1">
              Ver todos con filtros <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>


      {/* Modal responder derivación */}
      <Modal open={!!modalDer} onClose={() => { setModalDer(null); setObsRespuesta(''); }}
        title={modalDer?.respuesta === 'aceptada' ? 'Aceptar derivación' : 'Rechazar derivación'}>
        {modalDer && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-medium">{modalDer.paciente?.apellido}, {modalDer.paciente?.nombre}</p>
              <p className="text-gray-500 mt-1">{modalDer.motivo}</p>
            </div>
            <textarea value={obsRespuesta} onChange={e => setObsRespuesta(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Observaciones (opcional)..." />
            <div className="flex gap-3">
              <button onClick={() => setModalDer(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium">Cancelar</button>
              <button
                onClick={() => responderMutation.mutate({ id: modalDer.id, estado: modalDer.respuesta, observaciones: obsRespuesta })}
                disabled={responderMutation.isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 ${modalDer.respuesta === 'aceptada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {responderMutation.isPending ? 'Guardando...' : modalDer.respuesta === 'aceptada' ? 'Confirmar' : 'Rechazar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, href, alert }) {
  const colors = {
    teal: 'bg-teal-50 text-teal-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600', gray: 'bg-gray-50 text-gray-500'
  };
  return (
    <Link to={href} className={`bg-white rounded-2xl border p-4 block hover:shadow-md transition-shadow ${alert ? 'border-red-200' : 'border-gray-100'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Link>
  );
}
