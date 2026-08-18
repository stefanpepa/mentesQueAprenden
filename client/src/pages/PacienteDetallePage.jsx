import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Phone, Mail, FileText, Calendar,
  ArrowLeftRight, Paperclip, ChevronRight, Plus, Sparkles, Loader
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import FileUpload from '../components/ui/FileUpload';
import api from '../services/api';

const TABS = [
  { id: 'historial', label: 'Historial', icon: FileText },
  { id: 'derivaciones', label: 'Derivaciones', icon: ArrowLeftRight },
  { id: 'archivos', label: 'Archivos', icon: Paperclip },
];

const TIPO_SESION_LABEL = {
  evaluacion: 'Evaluación',
  tratamiento: 'Tratamiento',
  seguimiento: 'Seguimiento',
  devolucion: 'Devolución',
  reunion_interdisciplinaria: 'Reunión interdisciplinaria'
};

export default function PacienteDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('historial');
  const [modalPDF, setModalPDF] = useState(null); // { arch, analisis, pregunta }
  const [preguntaPDF, setPreguntaPDF] = useState('');

  const analizarPDFMutation = useMutation({
    mutationFn: ({ archivo_id, pregunta }) => api.post('/ia/analizar-pdf', { archivo_id, pregunta }).then(r => r.data),
    onSuccess: (data) => setModalPDF(prev => ({ ...prev, analisis: data.analisis }))
  });

  const { data: paciente, isLoading } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => api.get(`/pacientes/${id}`).then(r => r.data)
  });

  const { data: sesiones } = useQuery({
    queryKey: ['paciente-sesiones', id],
    queryFn: () => api.get(`/pacientes/${id}/sesiones`).then(r => r.data),
    enabled: tab === 'historial'
  });

  const { data: derivaciones } = useQuery({
    queryKey: ['paciente-derivaciones', id],
    queryFn: () => api.get(`/pacientes/${id}/derivaciones`).then(r => r.data),
    enabled: tab === 'derivaciones'
  });

  const { data: archivos, refetch: refetchArchivos } = useQuery({
    queryKey: ['paciente-archivos', id],
    queryFn: () => api.get(`/pacientes/${id}/archivos`).then(r => r.data),
    enabled: tab === 'archivos'
  });

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!paciente) return <div className="p-6 text-gray-500">Paciente no encontrado</div>;

  const edad = differenceInYears(new Date(), new Date(paciente.fecha_nacimiento));

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0 truncate">
          {paciente.apellido}, {paciente.nombre}
        </h1>
        <Link
          to={`/pacientes/${id}/editar`}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1.5 border border-primary-200 rounded-xl"
        >
          Editar
        </Link>
      </div>

      {/* Card resumen */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-bold text-lg">
              {paciente.nombre[0]}{paciente.apellido[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">
                {paciente.apellido}, {paciente.nombre}
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                paciente.estado === 'activo' ? 'bg-green-100 text-green-700' :
                paciente.estado === 'derivado' ? 'bg-amber-100 text-amber-700' :
                paciente.estado === 'alta' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {paciente.estado}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1 space-y-0.5">
              <p>DNI {paciente.dni} · {edad} años · {format(new Date(paciente.fecha_nacimiento), 'dd/MM/yyyy')}</p>
              {paciente.obra_social && <p>OS: {paciente.obra_social.nombre}{paciente.numero_afiliado ? ` (${paciente.numero_afiliado})` : ''}</p>}
              {paciente.profesional_principal && (
                <p>Prof.: {paciente.profesional_principal.apellido}, {paciente.profesional_principal.nombre}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
          {paciente.telefono && (
            <a href={`tel:${paciente.telefono}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600">
              <Phone size={15} />
              {paciente.telefono}
            </a>
          )}
          {paciente.email && (
            <a href={`mailto:${paciente.email}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600">
              <Mail size={15} />
              {paciente.email}
            </a>
          )}
          {paciente.responsable_nombre && (
            <span className="text-sm text-gray-600">
              Responsable: {paciente.responsable_nombre} ({paciente.responsable_vinculo}) · {paciente.responsable_telefono}
            </span>
          )}
        </div>

        {paciente.motivo_consulta && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-700">
            <span className="font-medium">Motivo: </span>{paciente.motivo_consulta}
          </div>
        )}
      </div>

      {/* Acción rápida */}
      <div className="flex gap-2 mb-4">
        <Link
          to={`/sesiones/nueva?paciente_id=${id}`}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-1 justify-center"
        >
          <Plus size={16} />
          Nueva sesión
        </Link>
        <Link
          to={`/derivaciones?paciente_id=${id}`}
          className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-1 justify-center"
        >
          <ArrowLeftRight size={16} />
          Derivar
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Historial de sesiones */}
      {tab === 'historial' && (
        <div className="space-y-2">
          {sesiones?.data?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-2" />
              <p>Sin sesiones registradas</p>
            </div>
          ) : sesiones?.data?.map(sesion => (
            <Link
              key={sesion.id}
              to={`/sesiones/${sesion.id}`}
              className="block bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {format(new Date(sesion.fecha), "d 'de' MMMM yyyy", { locale: es })}
                    </span>
                    <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                      {TIPO_SESION_LABEL[sesion.tipo]}
                    </span>
                    {sesion.pagado ? (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Pagado</span>
                    ) : sesion.monto ? (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Pendiente</span>
                    ) : null}
                  </div>
                  {sesion.notas_libres && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{sesion.notas_libres}</p>
                  )}
                  {sesion.resumen_ia && (
                    <p className="text-xs text-primary-500 mt-1 italic">IA: {sesion.resumen_ia.slice(0, 80)}...</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sesion.monto && (
                    <span className="text-sm font-medium text-gray-700">
                      ${sesion.monto.toLocaleString('es-AR')}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Tab: Derivaciones */}
      {tab === 'derivaciones' && (
        <div className="space-y-2">
          {derivaciones?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ArrowLeftRight size={40} className="mx-auto mb-2" />
              <p>Sin derivaciones</p>
            </div>
          ) : derivaciones?.map(der => (
            <div key={der.id} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {der.origen?.apellido} → {der.destino?.apellido}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{der.motivo}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(der.created_at), "d/MM/yyyy")}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                  der.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                  der.estado === 'aceptada' ? 'bg-green-100 text-green-700' :
                  der.estado === 'rechazada' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {der.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Archivos */}
      {tab === 'archivos' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-medium text-gray-900 mb-3 text-sm">Subir archivo</h3>
            <FileUpload
              pacienteId={id}
              onSubido={() => refetchArchivos()}
            />
          </div>

          <div className="space-y-2">
          {archivos?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Paperclip size={40} className="mx-auto mb-2" />
              <p>Sin archivos adjuntos</p>
            </div>
          ) : archivos?.map(arch => (
            <div key={arch.id} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Paperclip size={18} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{arch.nombre_original}</p>
                  <p className="text-xs text-gray-500">
                    {arch.tipo} · {format(new Date(arch.created_at), "d/MM/yyyy")} · {arch.subido_por?.apellido}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(arch.mime_type) && (
                    <button
                      onClick={() => setModalPDF({ arch, analisis: null })}
                      className="flex items-center gap-1 text-primary-500 hover:text-primary-700 text-xs font-medium px-2 py-1 border border-primary-100 rounded-lg hover:bg-primary-50"
                      title="Analizar con IA (Gemini)"
                    >
                      <Sparkles size={12} /> IA
                    </button>
                  )}
                  <a
                    href="#"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    onClick={async (e) => {
                      e.preventDefault();
                      const res = await api.get(`/archivos/${arch.id}/download-url`);
                      window.open(res.data.url, '_blank');
                    }}
                  >
                    Descargar
                  </a>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Modal: Analizar PDF con Gemini */}
      <Modal open={!!modalPDF} onClose={() => { setModalPDF(null); setPreguntaPDF(''); }} title="Analizar con IA" size="lg">
        {modalPDF && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
              <Paperclip size={14} className="text-gray-400" />
              <span className="truncate font-medium">{modalPDF.arch.nombre_original}</span>
              <span className="ml-auto text-xs text-primary-500 font-medium">Gemini Flash</span>
            </div>

            {modalPDF.analisis ? (
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                <p className="text-xs font-medium text-primary-600 mb-2 flex items-center gap-1">
                  <Sparkles size={12} /> Análisis de Gemini
                </p>
                <p className="text-sm text-primary-900 leading-relaxed whitespace-pre-wrap">{modalPDF.analisis}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Gemini leerá el documento y extraerá la información clínica relevante.</p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Pregunta específica (opcional)
              </label>
              <input
                value={preguntaPDF}
                onChange={(e) => setPreguntaPDF(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: ¿Cuál es el diagnóstico principal? ¿Qué medicación indica?"
              />
            </div>

            {analizarPDFMutation.isError && (
              <p className="text-sm text-red-600">{analizarPDFMutation.error?.response?.data?.error}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setModalPDF(null); setPreguntaPDF(''); }} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">
                Cerrar
              </button>
              <button
                onClick={() => analizarPDFMutation.mutate({ archivo_id: modalPDF.arch.id, pregunta: preguntaPDF || undefined })}
                disabled={analizarPDFMutation.isPending}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                {analizarPDFMutation.isPending ? (
                  <><Loader size={14} className="animate-spin" /> Analizando...</>
                ) : (
                  <><Sparkles size={14} /> {modalPDF.analisis ? 'Re-analizar' : 'Analizar'}</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
