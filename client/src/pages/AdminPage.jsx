import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, UserPlus, Edit2, Power } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/ui/Modal';

const ESPECIALIDAD_LABEL = {
  psicopedagogia: 'Psicopedagogía',
  psicologia: 'Psicología',
  fonoaudiologia: 'Fonoaudiología',
  otro: 'Otro'
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('profesionales');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalDesactivar, setModalDesactivar] = useState(null);
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', password: '',
    especialidad: 'psicopedagogia', rol: 'profesional',
    matricula: '', porcentaje_honorarios: 70
  });

  const { data: profesionales } = useQuery({
    queryKey: ['profesionales-admin'],
    queryFn: () => api.get('/profesionales').then(r => r.data)
  });

  const crearMutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales-admin'] });
      setModalNuevo(false);
      setForm({ nombre: '', apellido: '', email: '', password: '', especialidad: 'psicopedagogia', rol: 'profesional', matricula: '', porcentaje_honorarios: 70 });
    }
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/profesionales/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales-admin'] });
      setModalEditar(null);
    }
  });

  const desactivarMutation = useMutation({
    mutationFn: (id) => api.delete(`/profesionales/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profesionales-admin'] })
  });

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Administración</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {[
          { id: 'profesionales', label: 'Profesionales', icon: Users },
          { id: 'configuracion', label: 'Configuración', icon: Settings }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Profesionales */}
      {tab === 'profesionales' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setModalNuevo(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <UserPlus size={16} /> Agregar profesional
            </button>
          </div>

          <div className="space-y-2">
            {profesionales?.map(prof => (
              <div key={prof.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${!prof.activo ? 'opacity-50 border-gray-100' : 'border-gray-100'}`}>
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-700 font-semibold text-sm">
                    {prof.nombre[0]}{prof.apellido[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{prof.apellido}, {prof.nombre}</p>
                  <p className="text-xs text-gray-500">
                    {ESPECIALIDAD_LABEL[prof.especialidad]} · {prof.rol} · {prof.porcentaje_honorarios}% honorarios
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setModalEditar(prof)}
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  {prof.activo && (
                    <button
                      onClick={() => setModalDesactivar(prof)}
                      className="p-2 rounded-xl hover:bg-red-50 text-red-400"
                      title="Desactivar"
                    >
                      <Power size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuración */}
      {tab === 'configuracion' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Configuración del espacio</h2>
          <p className="text-sm text-gray-500">
            La configuración de WhatsApp (token, phone ID) y del porcentaje de honorarios
            se gestiona desde las variables de entorno del servidor y la tabla
            <code className="bg-gray-100 px-1 rounded text-xs ml-1">configuracion_espacio</code> en Supabase.
          </p>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
            <p className="font-medium mb-1">Variables de entorno necesarias:</p>
            <ul className="space-y-1 text-xs font-mono">
              <li>ANTHROPIC_API_KEY — para asistencia IA</li>
              <li>WHATSAPP_TOKEN — token de Meta Cloud API</li>
              <li>WHATSAPP_PHONE_ID — ID del número de WhatsApp</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal: Nuevo profesional */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo profesional" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nombre *</label>
              <input value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Apellido *</label>
              <input value={form.apellido} onChange={(e) => setForm(p => ({ ...p, apellido: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña inicial *</label>
            <input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} className={inputClass} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Especialidad</label>
              <select value={form.especialidad} onChange={(e) => setForm(p => ({ ...p, especialidad: e.target.value }))} className={inputClass}>
                {Object.entries(ESPECIALIDAD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Rol</label>
              <select value={form.rol} onChange={(e) => setForm(p => ({ ...p, rol: e.target.value }))} className={inputClass}>
                <option value="profesional">Profesional</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Matrícula</label>
              <input value={form.matricula} onChange={(e) => setForm(p => ({ ...p, matricula: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">% Honorarios</label>
              <input type="number" min={0} max={100} value={form.porcentaje_honorarios} onChange={(e) => setForm(p => ({ ...p, porcentaje_honorarios: e.target.value }))} className={inputClass} />
            </div>
          </div>
          {crearMutation.isError && (
            <p className="text-sm text-red-600">{crearMutation.error?.response?.data?.error}</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => setModalNuevo(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
            <button onClick={() => crearMutation.mutate(form)} disabled={crearMutation.isPending} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium">
              {crearMutation.isPending ? 'Creando...' : 'Crear profesional'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar desactivar */}
      <Modal open={!!modalDesactivar} onClose={() => setModalDesactivar(null)} title="Desactivar profesional">
        {modalDesactivar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Desactivar a <span className="font-semibold">{modalDesactivar.nombre} {modalDesactivar.apellido}</span>?
              No podrá iniciar sesión hasta que se reactive.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModalDesactivar(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
              <button
                onClick={() => { desactivarMutation.mutate(modalDesactivar.id); setModalDesactivar(null); }}
                disabled={desactivarMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
              >
                Desactivar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Editar */}
      <Modal open={!!modalEditar} onClose={() => setModalEditar(null)} title="Editar profesional">
        {modalEditar && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nombre</label>
                <input value={modalEditar.nombre} onChange={(e) => setModalEditar(p => ({ ...p, nombre: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Apellido</label>
                <input value={modalEditar.apellido} onChange={(e) => setModalEditar(p => ({ ...p, apellido: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">% Honorarios</label>
              <input type="number" min={0} max={100} value={modalEditar.porcentaje_honorarios} onChange={(e) => setModalEditar(p => ({ ...p, porcentaje_honorarios: Number(e.target.value) }))} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Matrícula</label>
              <input value={modalEditar.matricula || ''} onChange={(e) => setModalEditar(p => ({ ...p, matricula: e.target.value }))} className={inputClass} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalEditar(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
              <button
                onClick={() => editarMutation.mutate({ id: modalEditar.id, nombre: modalEditar.nombre, apellido: modalEditar.apellido, matricula: modalEditar.matricula, porcentaje_honorarios: modalEditar.porcentaje_honorarios })}
                disabled={editarMutation.isPending}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
              >
                {editarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
