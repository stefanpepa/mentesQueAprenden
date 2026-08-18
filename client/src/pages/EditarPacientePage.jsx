import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

export default function EditarPacientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: paciente, isLoading } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => api.get(`/pacientes/${id}`).then(r => r.data)
  });

  const { data: profesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => api.get('/profesionales').then(r => r.data)
  });

  const { data: obrasSociales } = useQuery({
    queryKey: ['obras_sociales'],
    queryFn: () => api.get('/obras-sociales').then(r => r.data)
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (paciente) {
      reset({
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        dni: paciente.dni,
        fecha_nacimiento: paciente.fecha_nacimiento?.slice(0, 10),
        genero: paciente.genero || '',
        estado: paciente.estado,
        telefono: paciente.telefono || '',
        email: paciente.email || '',
        direccion: paciente.direccion || '',
        localidad: paciente.localidad || '',
        responsable_nombre: paciente.responsable_nombre || '',
        responsable_telefono: paciente.responsable_telefono || '',
        responsable_vinculo: paciente.responsable_vinculo || '',
        obra_social_id: paciente.obra_social_id || '',
        numero_afiliado: paciente.numero_afiliado || '',
        profesional_principal_id: paciente.profesional_principal_id || '',
        motivo_consulta: paciente.motivo_consulta || ''
      });
    }
  }, [paciente, reset]);

  const mutation = useMutation({
    mutationFn: (data) => api.patch(`/pacientes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paciente', id] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast.success('Cambios guardados');
      navigate(`/pacientes/${id}`);
    },
    onError: () => toast.error('Error al guardar los cambios')
  });

  const onSubmit = (data) => mutation.mutate(data);

  const Field = ({ label, error, required, children }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );

  const inputClass = (hasError) =>
    `w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${
      hasError ? 'border-red-400' : 'border-gray-300'
    }`;

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;
  if (!paciente) return <div className="p-6 text-gray-400">Paciente no encontrado</div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Editar — {paciente.apellido}, {paciente.nombre}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Datos personales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" required error={errors.nombre}>
              <input {...register('nombre', { required: 'Requerido' })} className={inputClass(errors.nombre)} />
            </Field>
            <Field label="Apellido" required error={errors.apellido}>
              <input {...register('apellido', { required: 'Requerido' })} className={inputClass(errors.apellido)} />
            </Field>
            <Field label="DNI" required error={errors.dni}>
              <input
                {...register('dni', { required: 'Requerido', pattern: { value: /^\d{7,8}$/, message: '7 u 8 dígitos' } })}
                className={inputClass(errors.dni)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Fecha de nacimiento" required error={errors.fecha_nacimiento}>
              <input type="date" {...register('fecha_nacimiento', { required: 'Requerido' })} className={inputClass(errors.fecha_nacimiento)} />
            </Field>
            <Field label="Género">
              <select {...register('genero')} className={inputClass(false)}>
                <option value="">Sin especificar</option>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="no_binario">No binario</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Estado" required>
              <select {...register('estado')} className={inputClass(false)}>
                <option value="activo">Activo</option>
                <option value="derivado">Derivado</option>
                <option value="alta">Alta</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Contacto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Teléfono">
              <input {...register('telefono')} className={inputClass(false)} inputMode="tel" />
            </Field>
            <Field label="Email">
              <input type="email" {...register('email')} className={inputClass(false)} />
            </Field>
            <Field label="Dirección">
              <input {...register('direccion')} className={inputClass(false)} />
            </Field>
            <Field label="Localidad">
              <input {...register('localidad')} className={inputClass(false)} />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Responsable / Contacto de emergencia</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nombre completo">
              <input {...register('responsable_nombre')} className={inputClass(false)} />
            </Field>
            <Field label="Teléfono">
              <input {...register('responsable_telefono')} className={inputClass(false)} inputMode="tel" />
            </Field>
            <Field label="Vínculo">
              <select {...register('responsable_vinculo')} className={inputClass(false)}>
                <option value="">Seleccionar</option>
                <option value="madre">Madre</option>
                <option value="padre">Padre</option>
                <option value="tutor">Tutor/a</option>
                <option value="conyuge">Cónyuge</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Cobertura médica</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Obra social">
              <select {...register('obra_social_id')} className={inputClass(false)}>
                <option value="">Sin obra social</option>
                {obrasSociales?.map(os => (
                  <option key={os.id} value={os.id}>{os.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="N° de afiliado">
              <input {...register('numero_afiliado')} className={inputClass(false)} />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Información clínica</h2>
          <Field label="Profesional asignado" required error={errors.profesional_principal_id}>
            <select
              {...register('profesional_principal_id', { required: 'Requerido' })}
              className={inputClass(errors.profesional_principal_id)}
            >
              <option value="">Seleccionar profesional</option>
              {profesionales?.map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — {p.especialidad}</option>
              ))}
            </select>
          </Field>
          <Field label="Motivo de consulta">
            <textarea {...register('motivo_consulta')} rows={3} className={`${inputClass(false)} resize-none`} />
          </Field>
        </section>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {mutation.error?.response?.data?.error || 'Error al guardar los cambios'}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl font-medium">
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
