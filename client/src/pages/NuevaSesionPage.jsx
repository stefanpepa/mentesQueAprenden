import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import IAAssistant from '../components/ui/IAAssistant';
import FileUpload from '../components/ui/FileUpload';

const TIPOS = [
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'evaluacion', label: 'Evaluación' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'reunion_interdisciplinaria', label: 'Reunión interdisciplinaria' }
];

export default function NuevaSesionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pacienteIdParam = searchParams.get('paciente_id');
  const { profesional } = useAuthStore();
  const [notasLibres, setNotasLibres] = useState('');
  const [sesionCreada, setSesionCreada] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      paciente_id: pacienteIdParam || '',
      tipo: 'tratamiento',
      fecha: new Date().toISOString().slice(0, 16),
      duracion_minutos: 50
    }
  });

  const tipoSesion = watch('tipo');
  const pacienteId = watch('paciente_id');

  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-select'],
    queryFn: () => api.get('/pacientes', { params: { limit: 200 } }).then(r => r.data?.data || [])
  });

  const { data: paciente } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}`).then(r => r.data),
    enabled: !!pacienteId
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/sesiones', data),
    onSuccess: (res) => {
      setSesionCreada(res.data);
    }
  });

  const resumirMutation = useMutation({
    mutationFn: (data) => api.post('/ia/resumir-sesion', data),
    onSuccess: () => navigate(`/pacientes/${pacienteId}`)
  });

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      notas_libres: notasLibres,
      duracion_minutos: Number(data.duracion_minutos)
    });
  };

  const finalizarConResumen = async () => {
    if (!sesionCreada) return;
    await resumirMutation.mutateAsync({
      sesion_id: sesionCreada.id,
      notas_libres: notasLibres
    });
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  if (sesionCreada) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sesión registrada</h2>
          <p className="text-gray-500 mb-6">¿Querés que la IA genere un resumen de la sesión para el historial?</p>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/pacientes/${pacienteId}`)}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Saltear
            </button>
            <button
              onClick={finalizarConResumen}
              disabled={resumirMutation.isPending || !notasLibres}
              className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              {resumirMutation.isPending ? 'Generando...' : 'Generar resumen IA'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nueva sesión</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Paciente y datos básicos */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Datos de la sesión</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Paciente *</label>
            <select
              {...register('paciente_id', { required: 'Requerido' })}
              className={inputClass}
            >
              <option value="">Seleccionar paciente</option>
              {pacientes?.map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — DNI {p.dni}</option>
              ))}
            </select>
            {errors.paciente_id && <p className="text-xs text-red-500 mt-1">{errors.paciente_id.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha y hora *</label>
              <input type="datetime-local" {...register('fecha', { required: 'Requerido' })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de sesión</label>
              <select {...register('tipo')} className={inputClass}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Duración (min)</label>
              <input type="number" {...register('duracion_minutos')} min={15} max={480} step={5} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Monto ($)</label>
              <input type="number" {...register('monto')} min={0} step={100} className={inputClass} placeholder="0" />
            </div>
          </div>
        </div>

        {/* Notas clínicas con IA */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Notas clínicas</h2>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Sparkles size={12} className="text-teal-400" />
              Asistencia IA disponible
            </span>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notas libres</label>
            <textarea
              value={notasLibres}
              onChange={(e) => setNotasLibres(e.target.value)}
              rows={5}
              className={`${inputClass} resize-none`}
              placeholder="Escribí las observaciones de la sesión..."
            />
          </div>

          {pacienteId && (
            <IAAssistant
              pacienteId={pacienteId}
              tipoSesion={tipoSesion}
              especialidad={profesional?.especialidad}
              notasParciales={notasLibres}
              onAceptar={(texto) => setNotasLibres(texto)}
            />
          )}
        </div>

        {/* Archivos — solo si ya hay paciente seleccionado */}
        {pacienteId && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Archivos adjuntos</h2>
            <FileUpload pacienteId={pacienteId} />
          </div>
        )}

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {mutation.error?.response?.data?.error || 'Error al guardar la sesión'}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl font-medium">
            {mutation.isPending ? 'Guardando...' : 'Registrar sesión'}
          </button>
        </div>
      </form>
    </div>
  );
}
