import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';

export default function NuevoPacientePage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { estado: 'activo', provincia: 'Buenos Aires' }
  });

  const { data: profesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => api.get('/profesionales').then(r => r.data)
  });

  const { data: obrasSociales } = useQuery({
    queryKey: ['obras_sociales'],
    queryFn: () => api.get('/obras-sociales').then(r => r.data)
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/pacientes', data),
    onSuccess: (res) => navigate(`/pacientes/${res.data.id}`)
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
    `w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm ${
      hasError ? 'border-red-400' : 'border-gray-300'
    }`;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo paciente</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Datos personales */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Datos personales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" required error={errors.nombre}>
              <input
                {...register('nombre', { required: 'Requerido' })}
                className={inputClass(errors.nombre)}
                placeholder="Nombre"
              />
            </Field>
            <Field label="Apellido" required error={errors.apellido}>
              <input
                {...register('apellido', { required: 'Requerido' })}
                className={inputClass(errors.apellido)}
                placeholder="Apellido"
              />
            </Field>
            <Field label="DNI" required error={errors.dni}>
              <input
                {...register('dni', {
                  required: 'Requerido',
                  pattern: { value: /^\d{7,8}$/, message: '7 u 8 dígitos' }
                })}
                className={inputClass(errors.dni)}
                placeholder="30123456"
                inputMode="numeric"
              />
            </Field>
            <Field label="Fecha de nacimiento" required error={errors.fecha_nacimiento}>
              <input
                type="date"
                {...register('fecha_nacimiento', { required: 'Requerido' })}
                className={inputClass(errors.fecha_nacimiento)}
              />
            </Field>
            <Field label="Género" error={errors.genero}>
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

        {/* Contacto */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Contacto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Teléfono" error={errors.telefono}>
              <input
                {...register('telefono')}
                className={inputClass(false)}
                placeholder="11 1234-5678"
                inputMode="tel"
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <input
                type="email"
                {...register('email')}
                className={inputClass(false)}
                placeholder="email@ejemplo.com"
              />
            </Field>
            <Field label="Dirección" error={errors.direccion}>
              <input
                {...register('direccion')}
                className={inputClass(false)}
                placeholder="Calle y número"
              />
            </Field>
            <Field label="Localidad" error={errors.localidad}>
              <input
                {...register('localidad')}
                className={inputClass(false)}
                placeholder="Localidad"
              />
            </Field>
          </div>
        </section>

        {/* Responsable */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Responsable / Contacto de emergencia</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nombre completo" error={errors.responsable_nombre}>
              <input {...register('responsable_nombre')} className={inputClass(false)} />
            </Field>
            <Field label="Teléfono" error={errors.responsable_telefono}>
              <input {...register('responsable_telefono')} className={inputClass(false)} inputMode="tel" />
            </Field>
            <Field label="Vínculo" error={errors.responsable_vinculo}>
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

        {/* Cobertura */}
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

        {/* Clínico */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Información clínica</h2>
          <Field label="Profesional asignado" required error={errors.profesional_principal_id}>
            <select
              {...register('profesional_principal_id', { required: 'Requerido' })}
              className={inputClass(errors.profesional_principal_id)}
            >
              <option value="">Seleccionar profesional</option>
              {profesionales?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre} — {p.especialidad}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motivo de consulta">
            <textarea
              {...register('motivo_consulta')}
              rows={3}
              className={`${inputClass(false)} resize-none`}
              placeholder="Describí el motivo de consulta..."
            />
          </Field>
        </section>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {mutation.error?.response?.data?.error || 'Error al guardar el paciente'}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl font-medium transition-colors"
          >
            {mutation.isPending ? 'Guardando...' : 'Crear paciente'}
          </button>
        </div>
      </form>
    </div>
  );
}
