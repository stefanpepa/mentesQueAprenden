import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

export default function NuevaEvaluacionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pacienteIdParam = searchParams.get('paciente_id');

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      paciente_id: pacienteIdParam || '',
      fecha_evaluacion: new Date().toISOString().slice(0, 10),
      motivo_consulta: '',
      antecedentes: ''
    }
  });

  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-select'],
    queryFn: () => api.get('/pacientes', { params: { limit: 200 } }).then(r => r.data?.data || []),
    enabled: !pacienteIdParam
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/evaluaciones', data),
    onSuccess: (res) => navigate(`/evaluaciones/${res.data.id}`),
    onError: (err) => toast.error(err.response?.data?.error || 'Error al crear la evaluación')
  });

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nueva evaluación</h1>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          {!pacienteIdParam && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Paciente *</label>
              <select {...register('paciente_id', { required: 'Requerido' })} className={inputClass}>
                <option value="">Seleccionar paciente</option>
                {pacientes?.map(p => (
                  <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — DNI {p.dni}</option>
                ))}
              </select>
              {errors.paciente_id && <p className="text-xs text-red-500 mt-1">{errors.paciente_id.message}</p>}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de evaluación *</label>
            <input type="date" {...register('fecha_evaluacion', { required: 'Requerido' })} className={inputClass} />
            {errors.fecha_evaluacion && <p className="text-xs text-red-500 mt-1">{errors.fecha_evaluacion.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Motivo de consulta</label>
            <textarea {...register('motivo_consulta')} rows={3} className={`${inputClass} resize-none`} placeholder="¿Por qué se solicita esta evaluación?" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Antecedentes</label>
            <textarea {...register('antecedentes')} rows={4} className={`${inputClass} resize-none`} placeholder="Antecedentes significativos (desarrollo, escolaridad, tratamientos previos, etc.)" />
          </div>
        </div>

        <p className="text-xs text-gray-400 px-1">
          Después de crear la evaluación vas a poder cargar las pruebas aplicadas, la observación de la conducta, conclusiones y sugerencias, y generar el informe final con IA.
        </p>

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl font-medium">
            {mutation.isPending ? 'Creando...' : 'Crear y continuar'}
          </button>
        </div>
      </form>
    </div>
  );
}
