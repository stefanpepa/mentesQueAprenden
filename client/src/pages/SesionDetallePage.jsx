import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Save, Sparkles, History } from 'lucide-react';
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
  const [datosEdit, setDatosEdit] = useState(null);

  const { data: sesion, isLoading } = useQuery({
    queryKey: ['sesion', id],
    queryFn: () => api.get(`/sesiones/${id}`).then(r => r.data)
  });

  // Si se navega de una sesión a otra sin desmontar la página, no arrastrar
  // el borrador de la anterior (se guardaría encima de la nueva).
  useEffect(() => {
    setEditando(false);
    setNotasLibres(null);
  }, [id]);

  const valoresOriginales = (s) => ({
    fecha: format(new Date(s.fecha), "yyyy-MM-dd'T'HH:mm"),
    tipo: s.tipo,
    duracion_minutos: String(s.duracion_minutos || 50),
    consultorio: s.consultorio == null ? '' : String(s.consultorio),
    monto: s.monto == null ? '' : String(s.monto)
  });

  const iniciarEdicion = () => {
    setDatosEdit(valoresOriginales(sesion));
    setNotasLibres(sesion.notas_libres || '');
    setEditando(true);
  };

  // Solo se mandan los campos que el usuario cambió: si no, reenviar la fecha
  // sin tocarla movería igual el turno vinculado en la agenda.
  const guardarCambios = () => {
    const original = valoresOriginales(sesion);
    const cambios = {};
    if (datosEdit.fecha !== original.fecha) cambios.fecha = new Date(datosEdit.fecha).toISOString();
    if (datosEdit.tipo !== original.tipo) cambios.tipo = datosEdit.tipo;
    if (String(datosEdit.duracion_minutos) !== original.duracion_minutos) cambios.duracion_minutos = Number(datosEdit.duracion_minutos);
    if (datosEdit.consultorio !== original.consultorio) cambios.consultorio = datosEdit.consultorio ? Number(datosEdit.consultorio) : null;
    if (!sesion.pagado && String(datosEdit.monto) !== original.monto) {
      cambios.monto = datosEdit.monto === '' ? null : Number(datosEdit.monto);
    }
    if (notasLibres !== (sesion.notas_libres || '')) cambios.notas_libres = notasLibres;

    if (Object.keys(cambios).length === 0) {
      setEditando(false);
      toast.info('No hubo cambios para guardar');
      return;
    }
    guardarMutation.mutate(cambios);
  };

  const { data: versiones } = useQuery({
    queryKey: ['sesion-versiones', id],
    queryFn: () => api.get(`/sesiones/${id}/versiones`).then(r => r.data),
    enabled: modalVersiones
  });

  const guardarMutation = useMutation({
    mutationFn: (data) => api.patch(`/sesiones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesion', id] });
      // La fecha/duración de la sesión puede haber movido un turno vinculado
      // (ver SesionService.actualizar) — invalidamos también el historial del
      // paciente y todo lo relacionado a turnos/agenda para que no queden
      // pantallas mostrando la fecha vieja.
      queryClient.invalidateQueries({ queryKey: ['paciente-sesiones', sesion?.paciente_id] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('turno') });
      setEditando(false);
      toast.success('Cambios guardados');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al guardar los cambios')
  });

  const resumirMutation = useMutation({
    mutationFn: () => api.post('/ia/resumir-sesion', { sesion_id: id, notas_libres: sesion.notas_libres }),
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
      queryClient.invalidateQueries({ queryKey: ['paciente-sesiones', sesion?.paciente_id] });
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
          <h1 className="text-2xl font-bold text-gray-900">
            {format(new Date(sesion.fecha), "d 'de' MMMM yyyy", { locale: es })}
          </h1>
          <p className="text-sm text-gray-500">
            {TIPO_LABEL[sesion.tipo]} · {sesion.duracion_minutos} min · {sesion.consultorio ? `Consultorio ${sesion.consultorio}` : 'Sin consultorio'}
          </p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => editando ? setEditando(false) : iniciarEdicion()}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${editando ? 'bg-gray-100 text-gray-700 border-gray-200' : 'border-primary-200 text-primary-600'}`}
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
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-bold text-sm">
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
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Fecha y hora</label>
                <input
                  type="datetime-local"
                  value={datosEdit.fecha}
                  onChange={(e) => setDatosEdit(d => ({ ...d, fecha: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Tipo</label>
                <select
                  value={datosEdit.tipo}
                  onChange={(e) => setDatosEdit(d => ({ ...d, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                    <option key={valor} value={valor}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Duración (min)</label>
                <input
                  type="number"
                  min={1} max={480}
                  value={datosEdit.duracion_minutos}
                  onChange={(e) => setDatosEdit(d => ({ ...d, duracion_minutos: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Consultorio</label>
                <select
                  value={datosEdit.consultorio}
                  onChange={(e) => setDatosEdit(d => ({ ...d, consultorio: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {[1, 2, 3].map(n => <option key={n} value={String(n)}>Consultorio {n}</option>)}
                  <option value="">Sin consultorio</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Monto ($)</label>
                <input
                  type="number"
                  min={0} step="0.01"
                  value={datosEdit.monto}
                  onChange={(e) => setDatosEdit(d => ({ ...d, monto: e.target.value }))}
                  disabled={sesion.pagado}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                {sesion.pagado && (
                  <p className="text-[11px] text-gray-400 mt-1">Ya tiene un pago registrado; el monto no se puede cambiar.</p>
                )}
              </div>
            </div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notas</label>
            <textarea
              value={notasActuales}
              onChange={(e) => setNotasLibres(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Notas de la sesión..."
            />
            <IAAssistant
              pacienteId={sesion.paciente_id}
              sesionId={id}
              tipoSesion={datosEdit.tipo}
              especialidad={profesional?.especialidad}
              notasParciales={notasActuales}
              onAceptar={(texto) => setNotasLibres(texto)}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={guardarCambios}
                disabled={guardarMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
              >
                <Save size={14} />
                {guardarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
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
      <div className="bg-primary-50 rounded-2xl border border-primary-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-primary-600" />
            Resumen IA
          </h2>
          {puedeEditar && sesion.notas_libres && (
            <button
              onClick={() => resumirMutation.mutate()}
              disabled={resumirMutation.isPending}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              {resumirMutation.isPending ? 'Generando...' : sesion.resumen_ia ? 'Regenerar' : 'Generar'}
            </button>
          )}
        </div>
        {sesion.resumen_ia ? (
          <p className="text-sm text-primary-900 leading-relaxed">{sesion.resumen_ia}</p>
        ) : (
          <p className="text-sm text-primary-400 italic">Sin resumen. Guardá notas y hacé click en "Generar".</p>
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
