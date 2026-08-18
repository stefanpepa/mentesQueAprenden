import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, addMonths, subMonths, format, getDay,
  isToday as isTodayFns, startOfDay, endOfDay, parseISO
} from 'date-fns';
import api from '../services/api';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

const ESTADO_ESTILOS = {
  activo: { label: 'Activo', bg: '#e8f5f0', color: '#2f8f6e' },
  derivado: { label: 'Derivado', bg: '#fdece0', color: '#c76a2e' },
  alta: { label: 'Alta', bg: '#eaf1fa', color: '#3a6ea5' },
  inactivo: { label: 'Inactivo', bg: '#f0f0f0', color: '#767676' }
};

function avatarGradient(seed) {
  const gradientes = [
    'linear-gradient(135deg, #f5c55e 0%, #fdd89b 100%)',
    'linear-gradient(135deg, #e97979 0%, #f5a4a4 100%)',
    'linear-gradient(135deg, #7ba9d6 0%, #b0d4f1 100%)',
    'linear-gradient(135deg, #9b5de5 0%, #c5a3f0 100%)',
    'linear-gradient(135deg, #fda769 0%, #fcc5a0 100%)'
  ];
  const idx = (seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % gradientes.length;
  return gradientes[idx];
}

/* ---------- Card: Agenda ---------- */
function AgendaCard({ grow, expanded, onToggle, turnosHoy, onOpenTurno }) {
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
    (turnosMes || []).forEach(t => {
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

  const stop = (e) => e.stopPropagation();

  return (
    <div
      onClick={onToggle}
      style={{ flexGrow: grow }}
      className="flex-1 min-w-[260px] flex flex-col bg-white border border-primary-100 rounded-lg overflow-hidden shadow-sm cursor-pointer transition-[flex-grow] duration-300"
    >
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Agenda de hoy</h2>
        <span className="text-xs font-semibold text-primary-500">{expanded ? 'Cerrar ✕' : 'Ver calendario →'}</span>
      </div>

      {!expanded && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {(!turnosHoy || turnosHoy.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">Sin turnos para hoy.</p>
          )}
          {turnosHoy?.map((t, i) => {
            const colores = [
              { bg: '#fdf6e6', border: '#f5c55e' },
              { bg: '#fbeaea', border: '#e97979' },
              { bg: '#eaf1fa', border: '#7ba9d6' }
            ][i % 3];
            return (
              <div
                key={t.id}
                onClick={(e) => { stop(e); onOpenTurno(t); }}
                style={{ background: colores.bg, borderLeftColor: colores.border }}
                className="flex gap-2.5 px-3 py-2.5 rounded border-l-4 cursor-pointer hover:brightness-95 transition-all"
              >
                <div className="flex-shrink-0">
                  <div className="text-[13px] font-semibold text-primary-500">{format(parseISO(t.fecha_inicio), 'HH:mm')}</div>
                  <div className="text-[10px] text-gray-400">
                    {Math.round((parseISO(t.fecha_fin) - parseISO(t.fecha_inicio)) / 60000)} min
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 truncate">
                    {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : 'Sin paciente'}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{t.tipo}</p>
                </div>
              </div>
            );
          })}
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
            <h1 className="text-lg font-bold text-primary-700 min-w-[160px] text-center">
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
              return (
                <div
                  key={dia.key}
                  onClick={(e) => { stop(e); setDiaSeleccionado(dia); }}
                  className={`border-[1.5px] rounded-lg p-1 cursor-pointer transition-all overflow-hidden ${
                    seleccionado ? 'border-primary-500 bg-primary-50' : dia.esHoy ? 'border-teal-400 bg-teal-50' : 'border-[#ece4d4] bg-[#fdfbf6] hover:border-primary-300'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${dia.esHoy ? 'text-teal-600' : dia.esDomingo ? 'text-orange-400' : 'text-gray-900'}`}>
                    {dia.dia}
                  </div>
                  {dia.turnos.length > 0 && (
                    <div className="text-[8px] text-gray-500 mt-0.5 flex flex-col gap-0.5">
                      <div className="px-1 bg-gray-100 rounded truncate">
                        {dia.turnos[0].paciente ? dia.turnos[0].paciente.apellido : '—'}
                      </div>
                      {dia.turnos.length > 1 && (
                        <div className="text-gray-400 font-semibold">+{dia.turnos.length - 1}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {diaSeleccionado && (
            <div className="mt-2 px-5 pb-1 pt-4 border-t-2 border-gray-100 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary-700 mb-1">
                Turnos del {diaSeleccionado.dia} de {MESES[mesActual.getMonth()]}
              </h3>
              {turnosDelDiaSeleccionado.length === 0 && (
                <p className="text-xs text-gray-400">Sin turnos ese día.</p>
              )}
              {turnosDelDiaSeleccionado.map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpenTurno(t)}
                  className="bg-[#fdfbf6] border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-all"
                >
                  <div className="text-[13px] font-semibold text-primary-500">{format(parseISO(t.fecha_inicio), 'HH:mm')}</div>
                  <div className="text-xs font-medium text-gray-900 mt-0.5">
                    {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : 'Sin paciente'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{t.tipo}</div>
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

  const { data } = useQuery({
    queryKey: ['pacientes-inicio', busqueda],
    queryFn: () => api.get('/pacientes', { params: { limit: 50, busqueda: busqueda || undefined } }).then(r => r.data?.data || [])
  });

  const stop = (e) => e.stopPropagation();

  return (
    <div
      onClick={onToggle}
      style={{ flexGrow: grow }}
      className="flex-1 min-w-[260px] flex flex-col bg-white border border-primary-100 rounded-lg overflow-hidden shadow-sm cursor-pointer transition-[flex-grow] duration-300"
    >
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Tus pacientes</h2>
        <Link
          to="/pacientes/nuevo"
          onClick={stop}
          className="bg-primary-500 hover:bg-primary-600 text-white rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors"
        >
          + Nuevo
        </Link>
      </div>

      <div className="px-5 pb-3" onClick={stop}>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="w-full border border-primary-100 rounded-md px-2.5 py-2 text-xs bg-primary-50/40 focus:outline-none focus:border-primary-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-2">
          {(data || []).map(p => {
            const estadoEstilo = ESTADO_ESTILOS[p.estado] || ESTADO_ESTILOS.inactivo;
            return (
              <div
                key={p.id}
                onClick={(e) => { stop(e); onOpenPaciente(p.id); }}
                className="bg-primary-50/40 border border-primary-100 rounded-md px-3 py-2.5 cursor-pointer hover:bg-primary-50 transition-all"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: avatarGradient(p.nombre + p.apellido) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{p.apellido}, {p.nombre}</p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{p.motivo_consulta || p.obra_social?.nombre || '—'}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">DNI {p.dni}</p>
                    {expanded && (
                      <span
                        className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: estadoEstilo.bg, color: estadoEstilo.color }}
                      >
                        {estadoEstilo.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {(!data || data.length === 0) && (
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
        turnosHoy={turnosHoy}
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
