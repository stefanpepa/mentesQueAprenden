import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Save, Sparkles, Plus, Trash2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import MiniMarkdown from '../components/ui/MiniMarkdown';
import { exportarInformePdf } from '../utils/exportarInformePdf';

const CAMPOS_INFORME = [
  { key: 'motivo_consulta', label: 'Motivo de consulta', rows: 3 },
  { key: 'antecedentes', label: 'Antecedentes significativos', rows: 5 },
  { key: 'observacion_conducta', label: 'Observación de la conducta durante la evaluación', rows: 5 },
  { key: 'conclusiones', label: 'Conclusiones', rows: 4 },
  { key: 'sugerencias', label: 'Sugerencias', rows: 4 }
];

function PruebaCard({ prueba, onGuardar, onEliminar }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(prueba.nombre_prueba);
  const [texto, setTexto] = useState(prueba.resultados?.texto || '');
  const [observaciones, setObservaciones] = useState(prueba.observaciones || '');

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  if (editando) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Nombre de la prueba (ej: WISC-V)" />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={`${inputClass} resize-none`} placeholder="Resultados y puntajes, tal como los tengas..." />
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Observaciones (opcional)" />
        <div className="flex gap-2">
          <button onClick={() => setEditando(false)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
          <button
            onClick={() => { onGuardar({ nombre_prueba: nombre, resultados_texto: texto, observaciones }); setEditando(false); }}
            className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium"
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => setEditando(true)} className="flex-1 min-w-0 text-left">
          <p className="font-medium text-gray-900">{prueba.nombre_prueba}</p>
          {prueba.resultados?.texto && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{prueba.resultados.texto}</p>
          )}
        </button>
        <button onClick={onEliminar} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 flex-shrink-0">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function EvaluacionDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campos, setCampos] = useState(null);
  const [agregandoPrueba, setAgregandoPrueba] = useState(false);
  const [nuevaPrueba, setNuevaPrueba] = useState({ nombre_prueba: '', resultados_texto: '', observaciones: '' });

  const { data: evaluacion, isLoading } = useQuery({
    queryKey: ['evaluacion', id],
    queryFn: () => api.get(`/evaluaciones/${id}`).then(r => r.data)
  });

  useEffect(() => {
    if (evaluacion && campos === null) {
      setCampos({
        motivo_consulta: evaluacion.motivo_consulta || '',
        antecedentes: evaluacion.antecedentes || '',
        observacion_conducta: evaluacion.observacion_conducta || '',
        conclusiones: evaluacion.conclusiones || '',
        sugerencias: evaluacion.sugerencias || ''
      });
    }
  }, [evaluacion]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['evaluacion', id] });

  const guardarMutation = useMutation({
    mutationFn: (data) => api.patch(`/evaluaciones/${id}`, data),
    onSuccess: () => { invalidar(); toast.success('Cambios guardados'); },
    onError: () => toast.error('Error al guardar')
  });

  const agregarPruebaMutation = useMutation({
    mutationFn: (data) => api.post(`/evaluaciones/${id}/pruebas`, data),
    onSuccess: () => {
      invalidar();
      setAgregandoPrueba(false);
      setNuevaPrueba({ nombre_prueba: '', resultados_texto: '', observaciones: '' });
    },
    onError: () => toast.error('Error al agregar la prueba')
  });

  const editarPruebaMutation = useMutation({
    mutationFn: ({ pruebaId, data }) => api.patch(`/evaluaciones/pruebas/${pruebaId}`, data),
    onSuccess: invalidar,
    onError: () => toast.error('Error al guardar la prueba')
  });

  const eliminarPruebaMutation = useMutation({
    mutationFn: (pruebaId) => api.delete(`/evaluaciones/pruebas/${pruebaId}`),
    onSuccess: invalidar,
    onError: () => toast.error('Error al eliminar la prueba')
  });

  const generarInformeMutation = useMutation({
    mutationFn: () => api.post(`/evaluaciones/${id}/generar-informe`),
    onSuccess: () => { invalidar(); toast.success('Informe generado'); },
    onError: () => toast.error('Error al generar el informe con IA')
  });

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none';

  if (isLoading || campos === null) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!evaluacion) return <div className="p-6 text-gray-400">Evaluación no encontrada</div>;

  const huboCambios = CAMPOS_INFORME.some(({ key }) => campos[key] !== (evaluacion[key] || ''));

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {format(new Date(evaluacion.fecha_evaluacion), "d 'de' MMMM yyyy", { locale: es })}
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${evaluacion.estado === 'finalizado' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {evaluacion.estado === 'finalizado' ? 'Finalizado' : 'Borrador'}
          </span>
        </div>
      </div>

      {/* Paciente */}
      {evaluacion.paciente && (
        <Link
          to={`/pacientes/${evaluacion.paciente_id}`}
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 mb-4 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-bold text-sm">
              {evaluacion.paciente.nombre[0]}{evaluacion.paciente.apellido[0]}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{evaluacion.paciente.apellido}, {evaluacion.paciente.nombre}</p>
            <p className="text-xs text-gray-500">DNI {evaluacion.paciente.dni}</p>
          </div>
        </Link>
      )}

      {/* Campos del informe */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-4">
        {CAMPOS_INFORME.map(({ key, label, rows }) => (
          <div key={key}>
            <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
            <textarea
              value={campos[key]}
              onChange={(e) => setCampos((c) => ({ ...c, [key]: e.target.value }))}
              rows={rows}
              className={inputClass}
            />
          </div>
        ))}
        {huboCambios && (
          <button
            onClick={() => guardarMutation.mutate(campos)}
            disabled={guardarMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
          >
            <Save size={14} />
            {guardarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      {/* Pruebas aplicadas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Pruebas aplicadas</h2>
          {!agregandoPrueba && (
            <button
              onClick={() => setAgregandoPrueba(true)}
              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus size={14} /> Agregar
            </button>
          )}
        </div>

        <div className="space-y-2">
          {evaluacion.pruebas?.map((prueba) => (
            <PruebaCard
              key={prueba.id}
              prueba={prueba}
              onGuardar={(data) => editarPruebaMutation.mutate({ pruebaId: prueba.id, data })}
              onEliminar={() => eliminarPruebaMutation.mutate(prueba.id)}
            />
          ))}

          {evaluacion.pruebas?.length === 0 && !agregandoPrueba && (
            <p className="text-sm text-gray-400 italic text-center py-4">Sin pruebas cargadas</p>
          )}

          {agregandoPrueba && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
              <input
                value={nuevaPrueba.nombre_prueba}
                onChange={(e) => setNuevaPrueba((p) => ({ ...p, nombre_prueba: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Nombre de la prueba (ej: WISC-V, D2, BRIEF-2...)"
                autoFocus
              />
              <textarea
                value={nuevaPrueba.resultados_texto}
                onChange={(e) => setNuevaPrueba((p) => ({ ...p, resultados_texto: e.target.value }))}
                rows={4}
                className={inputClass}
                placeholder="Pegá o escribí los resultados y puntajes tal como los tengas..."
              />
              <div className="flex gap-2">
                <button onClick={() => setAgregandoPrueba(false)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">
                  Cancelar
                </button>
                <button
                  onClick={() => agregarPruebaMutation.mutate(nuevaPrueba)}
                  disabled={!nuevaPrueba.nombre_prueba.trim() || agregarPruebaMutation.isPending}
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
                >
                  {agregarPruebaMutation.isPending ? 'Agregando...' : 'Agregar prueba'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Informe generado */}
      <div className="bg-primary-50 rounded-2xl border border-primary-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-primary-600" />
            Informe
          </h2>
          <div className="flex items-center gap-2">
            {evaluacion.informe_generado && (
              <button
                onClick={() => exportarInformePdf(evaluacion)}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium border border-primary-200 rounded-lg px-2.5 py-1.5"
              >
                <Download size={13} /> Exportar PDF
              </button>
            )}
            <button
              onClick={() => generarInformeMutation.mutate()}
              disabled={generarInformeMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-60"
            >
              {generarInformeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              {generarInformeMutation.isPending ? 'Generando...' : evaluacion.informe_generado ? 'Regenerar' : 'Generar con IA'}
            </button>
          </div>
        </div>

        {evaluacion.informe_generado ? (
          <MiniMarkdown text={evaluacion.informe_generado} className="text-sm text-primary-900 leading-relaxed" />
        ) : (
          <p className="text-sm text-primary-400 italic">
            Cargá el motivo de consulta, antecedentes y pruebas, y hacé click en "Generar con IA" para redactar el informe completo.
          </p>
        )}
      </div>
    </div>
  );
}
