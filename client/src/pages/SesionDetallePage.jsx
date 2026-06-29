import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Save, Clock, Sparkles, History } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import IAAssistant from '../components/ui/IAAssistant';
import FileUpload from '../components/ui/FileUpload';
import Modal from '../components/ui/Modal';

const TIPO_LABEL = {
  evaluacion: 'Evaluación', tratamiento: 'Tratamiento',
  seguimiento: 'Seguimiento', devolucion: 'Devolución',
  reunion_interdisciplinaria: 'Reunión interdisciplinaria'
};

export default function SesionDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profesional } = useAuthStore();
  const [notasLibres, setNotasLibres] = useState(null);
  const [modalVersiones, setModalVersiones] = useState(false);
  const [editando, setEditando] = useState(false);

  const { data: sesion, isLoading } = useQuery({
    queryKey: ['sesion', id],
    queryFn: () => api.get(`/sesiones/${id}`).then(r => r.data)
  });

  useEffect(() => {
    if (sesion && notasLibres === null) {
      setNotasLibres(sesion.notas_libres || '');
    }
  }, [sesion]);

  const { data: versiones } = useQuery({
    queryKey: ['sesion-versiones', id],
    queryFn: () => api.get(`/sesiones/${id}/versiones`).then(r => r.data),
    enabled: modalVersiones
  });

  const guardarMutation = useMutation({
    mutationFn: (data) => api.patch(`/sesiones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesion', id] });
      setEditando(false);
      toast.success('Notas guardadas');
    },
    onError: () => toast.error('Error al guardar las notas')
  });

  const resumirMutation = useMutation({
    mutationFn: () => api.post('/ia/resumir-sesion', { sesion_id: id, notas_libres: notasLibres }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesion', id] });
      toast.success('Resumen generado');
    },
    onError: () => toast.error('Error al generar resumen')
  });

  const pagarMutation = useMutation({
    mutationFn: (data) => api.post('/pagos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesion', id] });
      toast.success('Pago registrado');
    },
    onError: () => toast.error('Error al registrar pago')
  });

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;
  if (!sesion) return <div className="p-6 text-gray-400">Sesión no encontrada</div>;

  const puedeEditar = sesion.profesional_id === profesional?.id || profesional?.rol === 'admin';
  const notasActuales = notasLibres ?? sesion.notas_libres ?? '';

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">
            {format(new Date(sesion.fecha), "d 'de' MMMM yyyy", { locale: es })}
          </h1>
          <p className="text-sm text-gray-500">
            {TIPO_LABEL[sesion.tipo]} · {sesion.duracion_minutos} min
          </p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setEditando(!editando)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${editando ? 'bg-gray-100 text-gray-700 border-gray-200' : 'border-teal-200 text-teal-600'}`}
          >
            {editando ? 'Cancelar' : 'Editar'}
          </button>
        )}
      </div>

      {/* Paciente */}
      {sesion.paciente && (
        <Link
          to={`/pacientes/${sesion.paciente_id}`}
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 mb-4 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-teal-700 font-bold text-sm">
              {sesion.paciente.nombre[0]}{sesion.paciente.apellido[0]}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{sesion.paciente.apellido}, {sesion.paciente.nombre}</p>
            <p className="text-xs text-gray-500">DNI {sesion.paciente.dni}</p>
          </div>
        </Link>
      )}

      {/* Notas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Notas clínicas</h2>
          <button
            onClick={() => setModalVersiones(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <History size={14} /> Historial
          </button>
        </div>

        {editando ? (
          <>
            <textarea
              value={notasActuales}
              onChange={(e) => setNotasLibres(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Notas de la sesión..."
            />
            <IAAssistant
              pacienteId={sesion.paciente_id}
              sesionId={id}
              tipoSesion={sesion.tipo}
              especialidad={profesional?.especialidad}
              notasParciales={notasActuales}
              onAceptar={(texto) => setNotasLibres(texto)}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => guardarMutation.mutate({ notas_libres: notasActuales })}
                disabled={guardarMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
              >
                <Save size={14} />
                {guardarMutation.isPending ? 'Guardando...' : 'Guardar notas'}
              </button>
            </div>
          </>
        ) : (
          <div>
            {sesion.notas_libres ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sesion.notas_libres}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin notas registradas</p>
            )}
          </div>
        )}
      </div>

      {/* Resumen IA */}
      <div className="bg-teal-50 rounded-2xl border border-teal-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-teal-600" />
            Resumen IA
          </h2>
          {puedeEditar && sesion.notas_libres && (
            <button
              onClick={() => resumirMutation.mutate()}
              disabled={resumirMutation.isPending}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              {resumirMutation.isPending ? 'Generando...' : sesion.resumen_ia ? 'Regenerar' : 'Generar'}
            </button>
          )}
        </div>
        {sesion.resumen_ia ? (
          <p className="text-sm text-teal-900 leading-relaxed">{sesion.resumen_ia}</p>
        ) : (
          <p className="text-sm text-teal-400 italic">Sin resumen. Guardá notas y hacé click en "Generar".</p>
        )}
      </div>

      {/* Pago */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Pago</h2>
        {sesion.pagado ? (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3">
            <span className="text-lg">✓</span>
            <div>
              <p className="font-medium text-sm">Pagado</p>
              {sesion.monto && <p className="text-xs">${Number(sesion.monto).toLocaleString('es-AR')} · {sesion.metodo_pago}</p>}
            </div>
          </div>
        ) : sesion.monto ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monto: <span className="font-semibold text-gray-900">${Number(sesion.monto).toLocaleString('es-AR')}</span></p>
              <p className="text-xs text-amber-600 mt-0.5">Pago pendiente</p>
            </div>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  pagarMutation.mutate({ sesion_id: id, monto_total: sesion.monto, metodo_pago: e.target.value });
                }
              }}
              defaultValue=""
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none"
            >
              <option value="" disabled>Registrar pago...</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="obra_social">Obra social</option>
            </select>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin monto registrado</p>
        )}
      </div>

      {/* Archivos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Adjuntar archivos</h2>
        <FileUpload pacienteId={sesion.paciente_id} sesionId={id} />
      </div>

      {/* Modal: versiones */}
      <Modal open={modalVersiones} onClose={() => setModalVersiones(false)} title="Historial de ediciones">
        <div className="space-y-3">
          {!versiones?.length ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin ediciones registradas</p>
          ) : versiones.map(v => (
            <div key={v.id} className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-2">
                {format(new Date(v.modificado_at), "d/MM/yyyy HH:mm")} — {v.modificado_por?.nombre} {v.modificado_por?.apellido}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{v.notas_libres_nueva}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
