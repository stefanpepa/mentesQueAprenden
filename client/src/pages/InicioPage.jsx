import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search, ArrowLeftRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, addMonths, subMonths, format, getDay,
  isToday as isTodayFns, startOfDay, endOfDay, parseISO
} from 'date-fns';
import api from '../services/api';
import { useDebounce } from '../hooks/useDebounce';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

const ESTADO_BADGE = {
  activo: 'bg-green-100 text-green-700',
  derivado: 'bg-amber-100 text-amber-700',
  alta: 'bg-blue-100 text-blue-700',
  inactivo: 'bg-gray-100 text-gray-600'
};

const ESTADO_LABEL = {
  activo: 'Activo',
  derivado: 'Derivado',
  alta: 'Alta',
  inactivo: 'Inactivo'
};

const AVATAR_GRADIENTES = [
  'linear-gradient(135deg, #f5c55e 0%, #fdd89b 100%)',
  'linear-gradient(135deg, #e97979 0%, #f5a4a4 100%)',
  'linear-gradient(135deg, #7ba9d6 0%, #b0d4f1 100%)',
  'linear-gradient(135deg, #9b5de5 0%, #c5a3f0 100%)',
  'linear-gradient(135deg, #fda769 0%, #fcc5a0 100%)'
];

function avatarGradient(seed) {
  const idx = (seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTES.length;
  return AVATAR_GRADIENTES[idx];
}

const TURNO_BORDES = ['border-l-amber-400 bg-amber-50', 'border-l-red-400 bg-red-50', 'border-l-blue-400 bg-blue-50'];

// Fade in/out con CSS puro (sin motion) — el tooltip anterior con motion.div
// tenía un transform propio que competía con el posicionamiento manual y
// hacía que apareciera en lugares erráticos. Este monta en opacity-0 y pasa
// a opacity-100 un frame después para que la transición se dispare.
function TooltipConsultorio({ hover }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [hover.x, hover.y, hover.texto]);

  return (
    <div
      style={{ position: 'fixed', left: hover.x, top: hover.y - 8, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
      className="pointer-events-none"
    >
      <div
        className={`px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg relative transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {hover.texto}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

/* ---------- Card: Agenda ---------- */
const CONSULTORIOS = [1, 2, 3];
const HORA_INICIO_FRANJA = 7;
const HORA_FIN_FRANJA = 21;

// Barras horizontales 07:00–21:00 por consultorio, en rojo donde hay un turno
// (propio o ajeno) ocupándolo hoy. Evita listar cada turno ajeno como fila —
// solo importa saber, de un vistazo, cuándo hay lugar en cada consultorio.
function DisponibilidadConsultorios({ turnos }) {
  const totalMin = (HORA_FIN_FRANJA - HORA_INICIO_FRANJA) * 60;
  const [hover, setHover] = useState(null); // { texto, x, y } | null

  const segmentosPorConsultorio = useMemo(() => {
    const map = { sin: [] };
    CONSULTORIOS.forEach(n => { map[n] = []; });
    (turnos || []).forEach(t => {
      if (t.estado === 'cancelado') return;
      // Sesiones sin consultorio asignado: no ocupan sala, pero se muestran en
      // una fila aparte para que no parezca un día vacío.
      const fila = CONSULTORIOS.includes(t.consultorio) ? t.consultorio : (t.es_sesion ? 'sin' : null);
      if (!fila) return;
      const inicio = parseISO(t.fecha_inicio);
      const fin = parseISO(t.fecha_fin);
      const minInicio = Math.max(0, (inicio.getHours() * 60 + inicio.getMinutes()) - HORA_INICIO_FRANJA * 60);
      const minFin = Math.min(totalMin, (fin.getHours() * 60 + fin.getMinutes()) - HORA_INICIO_FRANJA * 60);
      if (minFin <= minInicio) return;
      map[fila].push({
        left: (minInicio / totalMin) * 100,
        width: ((minFin - minInicio) / totalMin) * 100,
        etiqueta: `${format(inicio, 'HH:mm')} a ${format(fin, 'HH:mm')}`
      });
    });
    return map;
  }, [turnos, totalMin]);

  const filas = segmentosPorConsultorio.sin.length ? [...CONSULTORIOS, 'sin'] : CONSULTORIOS;

  return (
    <div className="flex flex-col gap-2">
      {filas.map(n => {
        const sinConsultorio = n === 'sin';
        return (
          <div key={n} className="flex items-center gap-2.5">
            <span className={`text-[10px] font-semibold w-14 flex-shrink-0 ${sinConsultorio ? 'text-amber-600' : 'text-gray-500'}`}>
              {sinConsultorio ? 'Sin consult.' : `Consult. ${n}`}
            </span>
            <div className={`relative flex-1 h-3 rounded-full overflow-hidden shadow-inner ${sinConsultorio ? 'bg-amber-50' : 'bg-green-100'}`}>
              {segmentosPorConsultorio[n].map((seg, i) => (
                <div
                  key={i}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const margen = sinConsultorio ? 180 : 95;
                    const x = Math.min(Math.max(rect.left + rect.width / 2, margen), window.innerWidth - margen);
                    const texto = sinConsultorio
                      ? `Sesión sin consultorio · ${seg.etiqueta} · editala para asignarle uno`
                      : `Consultorio ${n} · ${seg.etiqueta}`;
                    setHover({ texto, x, y: rect.top });
                  }}
                  onMouseLeave={() => setHover(null)}
                  className={`absolute top-0 bottom-0 bg-gradient-to-r cursor-help shadow-sm hover:brightness-110 transition-[filter,transform] duration-150 origin-left animate-[crecer_0.35s_ease-out] ${
                    sinConsultorio ? 'from-amber-300 to-amber-400' : 'from-red-400 to-red-500'
                  }`}
                  style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {hover && <TooltipConsultorio hover={hover} />}
    </div>
  );
}

function AgendaCard({ grow, expanded, onToggle, turnosHoy, consultoriosHoy, onOpenTurno }) {
  const [mesActual, setMesActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const inicioMes = startOfMonth(mesActual);
  const finMes = endOfMonth(mesActual);

  const { data: turnosMes } = useQuery({
    queryKey: ['turnos-mes', format(inicioMes, 'yyyy-MM')],
    queryFn: () => api.get('/turnos', {
      params: { fecha_inicio: inicioMes.toISOString(), fecha_fin: finMes.toISOString() }
    }).then(r => r.data),
    enabled: expanded
  });

  const turnosPorDia = useMemo(() => {
    const map = {};
    // Los turnos ajenos ("ocupado") no se listan acá — solo indican disponibilidad
    // de consultorio, no forman parte de la agenda personal del profesional.
    (turnosMes || []).filter(t => !t.ocupado).forEach(t => {
      const key = format(parseISO(t.fecha_inicio), 'yyyy-MM-dd');
      (map[key] = map[key] || []).push(t);
    });
    return map;
  }, [turnosMes]);

  const diasDelMes = useMemo(() => {
    const total = finMes.getDate();
    const offset = (getDay(inicioMes) + 6) % 7;
    const dias = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) {
      const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), d);
      const key = format(fecha, 'yyyy-MM-dd');
      dias.push({
        dia: d,
        fecha,
        key,
        esHoy: isTodayFns(fecha),
        esDomingo: getDay(fecha) === 0,
        turnos: turnosPorDia[key] || []
      });
    }
    return dias;
  }, [mesActual, turnosPorDia]);

  const turnosDelDiaSeleccionado = diaSeleccionado ? (turnosPorDia[diaSeleccionado.key] || []) : [];

  // Incluye los turnos "ocupado" (ajenos) — a diferencia de turnosPorDia,
  // esta lista alimenta el widget de disponibilidad por consultorio.
  const consultoriosDelDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return [];
    return (turnosMes || []).filter(t => format(parseISO(t.fecha_inicio), 'yyyy-MM-dd') === diaSeleccionado.key);
  }, [turnosMes, diaSeleccionado]);

  const stop = (e) => e.stopPropagation();

  return (
    <div
      onClick={onToggle}
      style={{ flexGrow: grow }}
      className="flex-1 min-w-[260px] flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-[flex-grow] duration-300"
    >
      <div className="px-5 py-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Agenda de hoy</h2>
        <span className="text-xs font-semibold text-primary-600">{expanded ? 'Cerrar ✕' : 'Ver calendario →'}</span>
      </div>

      {!expanded && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          <div className="pb-1">
            <DisponibilidadConsultorios turnos={consultoriosHoy} />
          </div>
          {(!turnosHoy || turnosHoy.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">Sin turnos para hoy.</p>
          )}
          {turnosHoy?.map((t, i) => (
            <div
              key={t.id}
              onClick={(e) => { stop(e); onOpenTurno(t); }}
              className={`flex gap-2.5 px-3 py-2.5 rounded-xl border-l-4 cursor-pointer hover:brightness-95 transition-all ${TURNO_BORDES[i % 3]}`}
            >
              <div className="flex-shrink-0">
                <div className="text-sm font-semibold text-primary-600">{format(parseISO(t.fecha_inicio), 'HH:mm')}</div>
                <div className="text-xs text-gray-400">
                  {Math.round((parseISO(t.fecha_fin) - parseISO(t.fecha_inicio)) / 60000)} min
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : 'Sin paciente'}
                </p>
                <p className="text-xs text-gray-500 truncate">{t.tipo} · {t.es_sesion ? 'Sesión registrada' : `Consultorio ${t.consultorio}`}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="flex-1 overflow-y-auto pt-3 flex flex-col" onClick={stop}>
          <div className="flex items-center justify-center gap-3.5 mb-2.5 px-5 flex-shrink-0">
            <button
              onClick={() => setMesActual(m => subMonths(m, 1))}
              className="w-7 h-7 rounded-full border border-gray-200 hover:bg-primary-50 hover:border-primary-500 flex items-center justify-center text-gray-600 transition-all"
            >
              <ChevronLeft size={15} />
            </button>
            <h1 className="text-lg font-bold text-gray-900 min-w-[160px] text-center">
              {MESES[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h1>
            <button
              onClick={() => setMesActual(m => addMonths(m, 1))}
              className="w-7 h-7 rounded-full border border-gray-200 hover:bg-primary-50 hover:border-primary-500 flex items-center justify-center text-gray-600 transition-all"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center px-5 flex-shrink-0">
            {DIAS.map(d => (
              <div key={d} className={`text-[10px] font-bold uppercase ${d === 'DOM' ? 'text-orange-400' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr gap-1.5 px-5 pb-4 min-h-[280px]">
            {diasDelMes.map((dia, i) => {
              if (!dia) return <div key={`empty-${i}`} />;
              const seleccionado = diaSeleccionado?.key === dia.key;
              const tieneTurnos = dia.turnos.length > 0;
              return (
                <div
                  key={dia.key}
                  onClick={(e) => { stop(e); setDiaSeleccionado(dia); }}
                  className={`border rounded-lg p-1 cursor-pointer transition-all overflow-hidden ${
                    seleccionado ? 'border-primary-500 bg-primary-100 ring-2 ring-primary-200'
                      : dia.esHoy ? 'border-teal-400 bg-teal-50'
                      : tieneTurnos ? 'border-primary-300 bg-primary-50 hover:border-primary-500'
                      : 'border-gray-200 bg-gray-50 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className={`text-xs font-semibold ${dia.esHoy ? 'text-teal-600' : dia.esDomingo ? 'text-orange-400' : 'text-gray-900'}`}>
                      {dia.dia}
                    </div>
                    {tieneTurnos && (
                      <span
                        title={`${dia.turnos.length} ${dia.turnos.length === 1 ? 'sesión' : 'sesiones'}`}
                        className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-primary-600 text-white text-[9px] font-bold flex items-center justify-center"
                      >
                        {dia.turnos.length}
                      </span>
                    )}
                  </div>
                  {tieneTurnos && (
                    <div className="text-[10px] mt-0.5 flex flex-col gap-0.5">
                      <div className="px-1 bg-primary-100 text-primary-800 font-medium rounded truncate">
                        {dia.turnos[0].paciente ? dia.turnos[0].paciente.apellido : '—'}
                      </div>
                      {dia.turnos.length > 1 && (
                        <div className="text-primary-500 font-semibold">+{dia.turnos.length - 1}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {diaSeleccionado && (
            <div className="mt-2 px-5 pb-1 pt-4 border-t border-gray-100 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Turnos del {diaSeleccionado.dia} de {MESES[mesActual.getMonth()]}
              </h3>
              <DisponibilidadConsultorios turnos={consultoriosDelDiaSeleccionado} />
              {turnosDelDiaSeleccionado.length === 0 && (
                <p className="text-xs text-gray-400">Sin turnos ese día.</p>
              )}
              {turnosDelDiaSeleccionado.map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpenTurno(t)}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-gray-100 transition-all"
                >
                  <div className="text-sm font-semibold text-primary-600">{format(parseISO(t.fecha_inicio), 'HH:mm')}</div>
                  <div className="text-xs font-medium text-gray-900 mt-0.5">
                    {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : 'Sin paciente'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.tipo} · {t.es_sesion ? 'Sesión registrada' : `Consultorio ${t.consultorio}`}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Card: Pacientes ---------- */
function PacientesCard({ grow, expanded, onToggle, onOpenPaciente }) {
  const [busqueda, setBusqueda] = useState('');
  const debouncedBusqueda = useDebounce(busqueda);

  const { data, isLoading } = useQuery({
    queryKey: ['pacientes-inicio', debouncedBusqueda],
    queryFn: () => api.get('/pacientes', { params: { limit: 50, busqueda: debouncedBusqueda || undefined } }).then(r => r.data?.data || [])
  });

  const stop = (e) => e.stopPropagation();

  return (
    <div
      onClick={onToggle}
      style={{ flexGrow: grow }}
      className="flex-1 min-w-[260px] flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-[flex-grow] duration-300"
    >
      <div className="px-5 py-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Tus pacientes</h2>
        <Link
          to="/pacientes/nuevo"
          onClick={stop}
          className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Plus size={12} /> Nuevo
        </Link>
      </div>

      <div className="px-5 pb-3" onClick={stop}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar..."
            className="w-full border border-gray-300 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-2">
          {isLoading && (
            <div className="space-y-2 px-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
            </div>
          )}
          {!isLoading && (data || []).map(p => (
            <div
              key={p.id}
              onClick={(e) => { stop(e); onOpenPaciente(p.id); }}
              className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-primary-50 hover:border-primary-100 transition-all"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: avatarGradient(p.nombre + p.apellido) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                    <span className="truncate">{p.apellido}, {p.nombre}</span>
                    {p.derivado && (
                      <ArrowLeftRight size={12} className="text-primary-500 flex-shrink-0" title="Paciente derivado" />
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{p.motivo_consulta || p.obra_social?.nombre || '—'}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">DNI {p.dni}</p>
                  {expanded && (
                    <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[p.estado] || ESTADO_BADGE.inactivo}`}>
                      {ESTADO_LABEL[p.estado] || ESTADO_LABEL.inactivo}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isLoading && (!data || data.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">Sin pacientes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Página principal ---------- */
export default function InicioPage() {
  const navigate = useNavigate();
  const [expandedBlock, setExpandedBlock] = useState(null);

  const hoy = new Date();
  const { data: turnosHoy } = useQuery({
    queryKey: ['turnos-hoy-inicio'],
    queryFn: () => api.get('/turnos', {
      params: { fecha_inicio: startOfDay(hoy).toISOString(), fecha_fin: endOfDay(hoy).toISOString() }
    }).then(r => r.data)
  });

  const agendaGrow = expandedBlock === 'agenda' ? 75 : expandedBlock === 'pacientes' ? 20 : 40;
  const pacientesGrow = expandedBlock === 'pacientes' ? 75 : expandedBlock === 'agenda' ? 20 : 60;

  // Un turno puede ya tener una sesión clínica vinculada (sesion_id) o todavía no.
  const irATurno = (t) => {
    if (t.sesion?.id) navigate(`/sesiones/${t.sesion.id}`);
    else if (t.paciente) navigate(`/pacientes/${t.paciente.id}`);
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-4 md:p-8">
      <AgendaCard
        grow={agendaGrow}
        expanded={expandedBlock === 'agenda'}
        onToggle={() => setExpandedBlock(b => b === 'agenda' ? null : 'agenda')}
        turnosHoy={(turnosHoy || []).filter(t => !t.ocupado)}
        consultoriosHoy={turnosHoy}
        onOpenTurno={irATurno}
      />
      <PacientesCard
        grow={pacientesGrow}
        expanded={expandedBlock === 'pacientes'}
        onToggle={() => setExpandedBlock(b => b === 'pacientes' ? null : 'pacientes')}
        onOpenPaciente={(id) => navigate(`/pacientes/${id}`)}
      />
    </div>
  );
}
