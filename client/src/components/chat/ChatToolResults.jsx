import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import api from '../../services/api';

export function PacienteFormCard({ prefill = {} }) {
  const [form, setForm] = useState({
    nombre: prefill.nombre || '',
    apellido: prefill.apellido || '',
    dni: prefill.dni || '',
    fecha_nacimiento: prefill.fecha_nacimiento || '',
    telefono: prefill.telefono || '',
    email: prefill.email || '',
    motivo_consulta: prefill.motivo_consulta || '',
  });
  const [saving, setSaving] = useState(false);
  const [paciente, setPaciente] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.apellido || !form.dni || !form.fecha_nacimiento) {
      toast.error('Nombre, apellido, DNI y fecha de nacimiento son obligatorios');
      return;
    }
    if (!/^\d{7,8}$/.test(form.dni)) {
      toast.error('El DNI debe tener 7 u 8 dígitos numéricos');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/pacientes', form);
      setPaciente(data);
      toast.success(`Paciente ${data.apellido}, ${data.nombre} registrado`);
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.errors?.length) {
        const msgs = respData.errors.map(e => `${e.path}: ${e.msg}`).join(', ');
        toast.error(`Error de validación: ${msgs}`);
      } else {
        toast.error(respData?.error || 'Error al guardar el paciente');
      }
    } finally {
      setSaving(false);
    }
  };

  if (paciente) {
    return (
      <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-3 text-sm flex items-center gap-3">
        <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-green-800">Paciente registrado</p>
          <Link to={`/pacientes/${paciente.id}`} className="text-green-700 text-xs underline">
            Ver ficha de {paciente.apellido}, {paciente.nombre} →
          </Link>
        </div>
      </div>
    );
  }

  const input = (label, key, type = 'text', required = false) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={form[key]}
        onChange={set(key)}
        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );

  return (
    <form onSubmit={guardar} className="mt-2 bg-white border border-gray-200 rounded-xl p-4 space-y-3 w-full">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nuevo paciente</p>
      <div className="grid grid-cols-2 gap-2">
        {input('Nombre', 'nombre', 'text', true)}
        {input('Apellido', 'apellido', 'text', true)}
        {input('DNI', 'dni', 'text', true)}
        {input('Fecha de nacimiento', 'fecha_nacimiento', 'date', true)}
        {input('Teléfono', 'telefono')}
        {input('Email', 'email', 'email')}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Motivo de consulta</label>
        <textarea
          value={form.motivo_consulta}
          onChange={set('motivo_consulta')}
          rows={2}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? 'Guardando...' : 'Guardar paciente'}
      </button>
    </form>
  );
}

export function TurnoFormCard({ prefill = {} }) {
  const hoy = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    paciente_id: prefill.paciente_id || '',
    paciente_busqueda: prefill.paciente_nombre || '',
    fecha_inicio: prefill.fecha_inicio || hoy,
    tipo: prefill.tipo || 'tratamiento',
    duracion_minutos: prefill.duracion_minutos || 50,
    notas: prefill.notas || '',
  });
  const [pacientes, setPacientes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [turno, setTurno] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const buscarPaciente = async (q) => {
    setForm(f => ({ ...f, paciente_busqueda: q, paciente_id: '' }));
    if (q.length < 2) { setPacientes([]); return; }
    setBuscando(true);
    try {
      const { data } = await api.get('/pacientes', { params: { busqueda: q, limit: 5 } });
      setPacientes(data?.data || []);
    } finally { setBuscando(false); }
  };

  const seleccionarPaciente = (p) => {
    setForm(f => ({ ...f, paciente_id: p.id, paciente_busqueda: `${p.apellido}, ${p.nombre}` }));
    setPacientes([]);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.paciente_id || !form.fecha_inicio) {
      toast.error('Seleccioná un paciente y la fecha/hora del turno');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/turnos', {
        paciente_id: form.paciente_id,
        fecha_inicio: form.fecha_inicio,
        tipo: form.tipo,
        duracion_minutos: Number(form.duracion_minutos),
        notas: form.notas || undefined,
      });
      setTurno(data);
      toast.success('Turno agendado');
    } catch (err) {
      const respData = err.response?.data;
      toast.error(respData?.error || 'Error al agendar el turno');
    } finally { setSaving(false); }
  };

  if (turno) {
    return (
      <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-3 text-sm flex items-center gap-3">
        <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-green-800">Turno agendado</p>
          <p className="text-green-700 text-xs">
            {turno.paciente ? `${turno.paciente.apellido}, ${turno.paciente.nombre} · ` : ''}
            {format(new Date(turno.fecha_inicio), "d/MM/yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>
      </div>
    );
  }

  const TIPOS = ['tratamiento', 'evaluacion', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria'];

  return (
    <form onSubmit={guardar} className="mt-2 bg-white border border-gray-200 rounded-xl p-4 space-y-3 w-full">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nuevo turno</p>

      <div className="flex flex-col gap-1 relative">
        <label className="text-xs font-medium text-gray-600">Paciente <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.paciente_busqueda}
          onChange={(e) => buscarPaciente(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {buscando && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
        {pacientes.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            {pacientes.map(p => (
              <button key={p.id} type="button" onClick={() => seleccionarPaciente(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors">
                {p.apellido}, {p.nombre} <span className="text-gray-400 text-xs">DNI {p.dni}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Fecha y hora <span className="text-red-500">*</span></label>
          <input type="datetime-local" value={form.fecha_inicio} onChange={set('fecha_inicio')}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select value={form.tipo} onChange={set('tipo')}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500">
            {TIPOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Duración (min)</label>
          <input type="number" value={form.duracion_minutos} onChange={set('duracion_minutos')} min={15} max={180}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Notas</label>
        <textarea value={form.notas} onChange={set('notas')} rows={2}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none" />
      </div>

      <button type="submit" disabled={saving}
        className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {saving ? 'Agendando...' : 'Agendar turno'}
      </button>
    </form>
  );
}

export function ToolResultCard({ name, result }) {
  if (result?.type === 'form' && result.form === 'crear_paciente') {
    return <PacienteFormCard prefill={result.prefill || {}} />;
  }

  if (result?.type === 'form' && result.form === 'crear_turno') {
    return <TurnoFormCard prefill={result.prefill || {}} />;
  }

  if (result?.error) {
    return (
      <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
        Error: {result.error}
      </div>
    );
  }

  if (name === 'buscar_pacientes') {
    if (!result?.length) return <div className="mt-2 text-sm text-gray-500 italic">No se encontraron pacientes.</div>;
    return (
      <div className="mt-2 space-y-2">
        {result.map(p => (
          <Link key={p.id} to={`/pacientes/${p.id}`}
            className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2 hover:border-primary-300 transition-colors"
          >
            <div>
              <p className="font-medium text-sm text-gray-900">{p.apellido}, {p.nombre}</p>
              <p className="text-xs text-gray-500">DNI {p.dni} · {p.estado}</p>
            </div>
            <span className="text-xs text-primary-600">Ver →</span>
          </Link>
        ))}
      </div>
    );
  }

  if (name === 'ver_agenda') {
    const { fecha, turnos } = result;
    if (!turnos?.length) return <div className="mt-2 text-sm text-gray-500 italic">Sin turnos para {fecha}.</div>;
    return (
      <div className="mt-2 space-y-1.5">
        {turnos.map(t => (
          <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-xs font-mono text-primary-600 flex-shrink-0">
              {format(new Date(t.fecha_inicio), 'HH:mm')}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : 'Sin paciente'}
              </p>
              <p className="text-xs text-gray-500">{t.tipo} · {t.estado}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (name === 'crear_turno') {
    return (
      <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
        <p className="font-medium text-green-800">Turno creado</p>
        <p className="text-green-700 text-xs mt-0.5">
          {result.paciente ? `${result.paciente.apellido}, ${result.paciente.nombre}` : ''} · {format(new Date(result.fecha_inicio), "d/MM/yyyy 'a las' HH:mm", { locale: es })}
        </p>
      </div>
    );
  }

  if (name === 'crear_paciente') {
    return (
      <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
        <p className="font-medium text-green-800">Paciente registrado</p>
        <Link to={`/pacientes/${result.id}`} className="text-green-700 text-xs underline">
          Ver ficha de {result.apellido}, {result.nombre} →
        </Link>
      </div>
    );
  }

  if (name === 'registrar_sesion') {
    return (
      <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
        <p className="font-medium text-green-800">Sesión registrada</p>
        <Link to={`/sesiones/${result.id}`} className="text-green-700 text-xs underline">
          Ver sesión →
        </Link>
      </div>
    );
  }

  if (name === 'listar_profesionales') {
    return (
      <div className="mt-2 space-y-1">
        {result.map(p => (
          <div key={p.id} className="text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2">
            {p.apellido}, {p.nombre} — <span className="text-gray-500">{p.especialidad}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
