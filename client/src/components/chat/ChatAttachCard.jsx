import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, Paperclip, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import MiniMarkdown from '../ui/MiniMarkdown';

const TIPO_POR_EXT = { pdf: 'informe', jpg: 'estudio', jpeg: 'estudio', png: 'estudio', webp: 'estudio' };

function detectarTipo(nombre) {
  const ext = nombre.split('.').pop().toLowerCase();
  return TIPO_POR_EXT[ext] || 'otro';
}

// Adjuntar un archivo desde el chat requiere saber a qué paciente pertenece
// (POST /archivos/upload-url lo exige), así que primero se busca/selecciona
// el paciente y recién después se sube.
export function ChatAttachCard({ file }) {
  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [pacienteSel, setPacienteSel] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [archivoId, setArchivoId] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [analisis, setAnalisis] = useState(null);

  const buscarPaciente = async (q) => {
    setBusqueda(q);
    if (q.length < 2) { setPacientes([]); return; }
    setBuscando(true);
    try {
      const { data } = await api.get('/pacientes', { params: { busqueda: q, limit: 5 } });
      setPacientes(data?.data || []);
    } finally { setBuscando(false); }
  };

  const seleccionarYSubir = async (p) => {
    setPacienteSel(p);
    setPacientes([]);
    setBusqueda(`${p.apellido}, ${p.nombre}`);
    setSubiendo(true);
    try {
      const { data: urlData } = await api.post('/archivos/upload-url', {
        paciente_id: p.id,
        nombre_original: file.name,
        mime_type: file.type,
        tamanio_bytes: file.size,
        tipo: detectarTipo(file.name)
      });

      await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      setArchivoId(urlData.archivo_id);
      toast.success('Archivo subido');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir el archivo');
      setPacienteSel(null);
    } finally {
      setSubiendo(false);
    }
  };

  const analizar = async () => {
    setAnalizando(true);
    try {
      const { data } = await api.post('/ia/analizar-pdf', { archivo_id: archivoId });
      setAnalisis(data.analisis);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al analizar el archivo');
    } finally {
      setAnalizando(false);
    }
  };

  const mimesSoportados = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const soportaIA = mimesSoportados.includes(file.type);

  if (archivoId) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-3 text-sm origin-left w-full"
      >
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <p className="font-medium text-green-800">{file.name}</p>
        </div>
        <p className="text-green-700 text-xs mb-2">
          Adjuntado a {pacienteSel.apellido}, {pacienteSel.nombre}
        </p>

        {analisis ? (
          <div className="bg-white border border-green-100 rounded-lg p-3 mt-2">
            <p className="text-xs font-medium text-primary-600 mb-1 flex items-center gap-1">
              <Sparkles size={12} /> Análisis de IA
            </p>
            <MiniMarkdown text={analisis} className="text-xs text-gray-700 leading-relaxed" />
          </div>
        ) : soportaIA ? (
          <button
            onClick={analizar}
            disabled={analizando}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-60"
          >
            {analizando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {analizando ? 'Analizando...' : 'Analizar con IA'}
          </button>
        ) : null}

        <Link to={`/pacientes/${pacienteSel.id}`} className="block text-green-700 text-xs underline mt-2">
          Ver ficha del paciente →
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-xl p-3 w-full">
      <div className="flex items-center gap-2 mb-2">
        <Paperclip size={15} className="text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-700 truncate">{file.name}</p>
      </div>

      {subiendo ? (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Subiendo...
        </p>
      ) : (
        <div className="relative">
          <label className="text-xs font-medium text-gray-600 block mb-1">¿A qué paciente pertenece?</label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => buscarPaciente(e.target.value)}
            placeholder="Buscar por nombre o DNI..."
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {buscando && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
          {pacientes.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {pacientes.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => seleccionarYSubir(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors"
                >
                  {p.apellido}, {p.nombre} <span className="text-gray-400 text-xs">DNI {p.dni}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
