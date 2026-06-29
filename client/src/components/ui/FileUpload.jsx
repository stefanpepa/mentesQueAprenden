import { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, Loader } from 'lucide-react';
import api from '../../services/api';

const TIPOS_MIME = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagen',
  'image/png': 'Imagen',
  'image/webp': 'Imagen',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word'
};

export default function FileUpload({ pacienteId, sesionId, onSubido }) {
  const [archivos, setArchivos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);

  const agregarArchivos = (files) => {
    const nuevos = Array.from(files).map(file => ({
      file,
      nombre: file.name,
      tipo: detectarTipo(file.name),
      estado: 'pendiente',
      error: null
    }));
    setArchivos(prev => [...prev, ...nuevos]);
  };

  const detectarTipo = (nombre) => {
    const ext = nombre.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'informe';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'estudio';
    return 'otro';
  };

  const subirTodos = async () => {
    setSubiendo(true);
    const pendientes = archivos.filter(a => a.estado === 'pendiente');

    for (const item of pendientes) {
      try {
        setArchivos(prev => prev.map(a =>
          a.file === item.file ? { ...a, estado: 'subiendo' } : a
        ));

        // Pedir URL firmada al backend
        const { data: urlData } = await api.post('/archivos/upload-url', {
          paciente_id: pacienteId,
          sesion_id: sesionId,
          nombre_original: item.file.name,
          mime_type: item.file.type,
          tamanio_bytes: item.file.size,
          tipo: item.tipo
        });

        // Upload directo a Supabase Storage
        await fetch(urlData.upload_url, {
          method: 'PUT',
          body: item.file,
          headers: { 'Content-Type': item.file.type }
        });

        setArchivos(prev => prev.map(a =>
          a.file === item.file ? { ...a, estado: 'ok', archivoId: urlData.archivo_id } : a
        ));

        onSubido?.(urlData.archivo_id);
      } catch (err) {
        setArchivos(prev => prev.map(a =>
          a.file === item.file ? { ...a, estado: 'error', error: 'Error al subir' } : a
        ));
      }
    }
    setSubiendo(false);
  };

  const remover = (file) => {
    setArchivos(prev => prev.filter(a => a.file !== file));
  };

  const onDrop = (e) => {
    e.preventDefault();
    agregarArchivos(e.dataTransfer.files);
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 hover:border-teal-400 rounded-xl p-6 text-center cursor-pointer transition-colors"
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 font-medium">Arrastrá archivos o hacé click</p>
        <p className="text-xs text-gray-400 mt-1">PDF, imágenes, Word — máx. 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          className="hidden"
          onChange={(e) => agregarArchivos(e.target.files)}
        />
      </div>

      {/* Lista de archivos */}
      {archivos.length > 0 && (
        <div className="mt-3 space-y-2">
          {archivos.map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
              <File size={18} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.nombre}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    value={item.tipo}
                    onChange={(e) => setArchivos(prev => prev.map((a, j) =>
                      j === i ? { ...a, tipo: e.target.value } : a
                    ))}
                    className="text-xs border-0 bg-transparent text-gray-500 p-0 focus:ring-0"
                    disabled={item.estado !== 'pendiente'}
                  >
                    <option value="informe">Informe</option>
                    <option value="estudio">Estudio</option>
                    <option value="consentimiento">Consentimiento</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="flex-shrink-0">
                {item.estado === 'subiendo' && <Loader size={16} className="animate-spin text-teal-500" />}
                {item.estado === 'ok' && <CheckCircle size={16} className="text-green-500" />}
                {item.estado === 'error' && <span className="text-xs text-red-500">{item.error}</span>}
                {item.estado === 'pendiente' && (
                  <button onClick={() => remover(item.file)} className="text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {archivos.some(a => a.estado === 'pendiente') && (
            <button
              onClick={subirTodos}
              disabled={subiendo}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {subiendo ? 'Subiendo...' : `Subir ${archivos.filter(a => a.estado === 'pendiente').length} archivo(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
