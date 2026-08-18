import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeftRight, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';

const ESTADO_COLOR = {
  pendiente: 'bg-amber-100 text-amber-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  completada: 'bg-gray-100 text-gray-600'
};

export default function DerivacionesPage() {
  const { profesional } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('pendientes');
  const [modalResponder, setModalResponder] = useState(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [sugerenciaIA, setSugerenciaIA] = useState('');
  const [loadingIA, setLoadingIA] = useState(false);

  const pacienteIdParam = searchParams.get('paciente_id');
  const [formNueva, setFormNueva] = useState({
    paciente_id: pacienteIdParam || '',
    profesional_destino_id: '',
    motivo: ''
  });

  // Si viene con ?paciente_id, abrir modal automáticamente
  useEffect(() => {
    if (pacienteIdParam) setModalNueva(true);
  }, [pacienteIdParam]);

  const { data: pendientes } = useQuery({
    queryKey: ['derivaciones-pendientes'],
    queryFn: () => api.get('/derivaciones/pendientes').then(r => r.data)
  });

  const { data: todas } = useQuery({
    queryKey: ['derivaciones-todas'],
    queryFn: () => api.get('/derivaciones').then(r => r.data),
    enabled: tab === 'todas'
  });

  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-select'],
    queryFn: () => api.get('/pacientes', { params: { limit: 200 } }).then(r => r.data?.data || [])
  });

  const { data: profesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => api.get('/profesionales').then(r => r.data)
  });

  const responderMutation = useMutation({
    mutationFn: ({ id, estado, observaciones }) =>
      api.patch(`/derivaciones/${id}/responder`, { estado, observaciones }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['derivaciones-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['turnos-hoy'] });
      setModalResponder(null);
      setObservaciones('');
      toast.success(vars.estado === 'aceptada' ? 'Derivación aceptada' : 'Derivación rechazada');
    },
    onError: () => toast.error('Error al responder la derivación')
  });

  const crearMutation = useMutation({
    mutationFn: (data) => api.post('/derivaciones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['derivaciones-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['derivaciones-todas'] });
      setModalNueva(false);
      setFormNueva({ paciente_id: '', profesional_destino_id: '', motivo: '' });
      toast.success('Derivación enviada');
    },
    onError: () => toast.error('Error al crear la derivación')
  });

  const pedirSugerenciaIA = async () => {
    if (!formNueva.paciente_id) return;
    setLoadingIA(true);
    try {
      const { data } = await api.post('/ia/sugerir-derivacion', {
        paciente_id: formNueva.paciente_id,
        contexto_adicional: formNueva.motivo
      });
      setSugerenciaIA(data.sugerencia);
    } catch {}
    setLoadingIA(false);
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Derivaciones</h1>
        <button
          onClick={() => setModalNueva(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          <ArrowLeftRight size={16} /> Nueva derivación
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {['pendientes', 'todas'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            {t === 'pendientes' ? `Pendientes ${pendientes?.length ? `(${pendientes.length})` : ''}` : 'Todas'}
          </button>
        ))}
      </div>

      {/* Lista pendientes */}
      {tab === 'pendientes' && (
        <div className="space-y-3">
          {!pendientes?.length ? (
            <div className="text-center py-16 text-gray-400">
              <ArrowLeftRight size={40} className="mx-auto mb-3 text-gray-200" />
              <p>No tenés derivaciones pendientes</p>
            </div>
          ) : pendientes.map(der => (
            <div key={der.id} className="bg-white rounded-2xl border border-amber-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {der.paciente?.apellido}, {der.paciente?.nombre}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    De {der.origen?.nombre} {der.origen?.apellido} ({der.origen?.especialidad}) · {format(new Date(der.created_at), 'd/MM/yyyy')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${ESTADO_COLOR[der.estado]}`}>
                  {der.estado}
                </span>
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 mb-3">{der.motivo}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setModalResponder({ ...der, respuesta: 'aceptada' }); }}
                  className="flex items-center gap-1.5 flex-1 justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium"
                >
                  <CheckCircle size={14} /> Aceptar
                </button>
                <button
                  onClick={() => { setModalResponder({ ...der, respuesta: 'rechazada' }); }}
                  className="flex items-center gap-1.5 flex-1 justify-center py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium"
                >
                  <XCircle size={14} /> Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista todas */}
      {tab === 'todas' && (
        <div className="space-y-3">
          {!todas?.length ? (
            <div className="text-center py-16 text-gray-400">
              <ArrowLeftRight size={40} className="mx-auto mb-3 text-gray-200" />
              <p>Sin derivaciones registradas</p>
            </div>
          ) : todas.map(der => (
            <div key={der.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">
                    {der.paciente?.apellido}, {der.paciente?.nombre}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {der.origen?.apellido} → {der.destino?.apellido} · {format(new Date(der.created_at), 'd/MM/yyyy')}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">{der.motivo}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${ESTADO_COLOR[der.estado]}`}>
                  {der.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Responder derivación */}
      <Modal
        open={!!modalResponder}
        onClose={() => { setModalResponder(null); setObservaciones(''); }}
        title={modalResponder?.respuesta === 'aceptada' ? 'Aceptar derivación' : 'Rechazar derivación'}
      >
        {modalResponder && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-medium">{modalResponder.paciente?.apellido}, {modalResponder.paciente?.nombre}</p>
              <p className="text-gray-500 mt-1">{modalResponder.motivo}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observaciones (opcional)</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Agregá una respuesta o comentario..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalResponder(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">
                Cancelar
              </button>
              <button
                onClick={() => responderMutation.mutate({ id: modalResponder.id, estado: modalResponder.respuesta, observaciones })}
                disabled={responderMutation.isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 ${modalResponder.respuesta === 'aceptada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {responderMutation.isPending ? 'Guardando...' : modalResponder.respuesta === 'aceptada' ? 'Confirmar aceptación' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Nueva derivación */}
      <Modal open={modalNueva} onClose={() => setModalNueva(false)} title="Nueva derivación" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Paciente *</label>
            <select
              value={formNueva.paciente_id}
              onChange={(e) => setFormNueva(p => ({ ...p, paciente_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Seleccionar paciente</option>
              {pacientes?.map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Derivar a *</label>
            <select
              value={formNueva.profesional_destino_id}
              onChange={(e) => setFormNueva(p => ({ ...p, profesional_destino_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Seleccionar profesional</option>
              {profesionales?.filter(p => p.id !== profesional?.id).map(p => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — {p.especialidad}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Motivo *</label>
            <textarea
              value={formNueva.motivo}
              onChange={(e) => setFormNueva(p => ({ ...p, motivo: e.target.value }))}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Describí el motivo de la derivación..."
            />
          </div>

          {/* Sugerencia IA */}
          {formNueva.paciente_id && (
            <div>
              <button
                type="button"
                onClick={pedirSugerenciaIA}
                disabled={loadingIA}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Sparkles size={14} />
                {loadingIA ? 'Consultando IA...' : 'Consultar IA sobre este caso'}
              </button>
              {sugerenciaIA && (
                <div className="mt-2 bg-primary-50 border border-primary-100 rounded-xl p-3">
                  <p className="text-xs font-medium text-primary-600 mb-1">Sugerencia IA</p>
                  <p className="text-sm text-primary-900">{sugerenciaIA}</p>
                </div>
              )}
            </div>
          )}

          {crearMutation.isError && (
            <p className="text-sm text-red-600">{crearMutation.error?.response?.data?.error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setModalNueva(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">
              Cancelar
            </button>
            <button
              onClick={() => crearMutation.mutate(formNueva)}
              disabled={crearMutation.isPending || !formNueva.paciente_id || !formNueva.profesional_destino_id || !formNueva.motivo}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
            >
              {crearMutation.isPending ? 'Enviando...' : 'Enviar derivación'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
