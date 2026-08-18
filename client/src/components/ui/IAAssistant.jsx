import { useState } from 'react';
import { Sparkles, CheckCircle, X, Loader } from 'lucide-react';
import api from '../../services/api';

export default function IAAssistant({ pacienteId, sesionId, tipoSesion, especialidad, notasParciales, onAceptar }) {
  const [estado, setEstado] = useState('idle'); // idle | loading | mostrar | error
  const [sugerencia, setSugerencia] = useState('');
  const [error, setError] = useState('');

  const sugerirNotas = async () => {
    if (!notasParciales?.trim()) {
      setError('Escribí algunas notas primero para que la IA pueda ayudarte');
      return;
    }
    setEstado('loading');
    setError('');
    try {
      const { data } = await api.post('/ia/sugerir-notas', {
        notas_parciales: notasParciales,
        paciente_id: pacienteId,
        sesion_id: sesionId,
        tipo_sesion: tipoSesion,
        especialidad
      });
      setSugerencia(data.sugerencia);
      setEstado('mostrar');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con la IA');
      setEstado('error');
    }
  };

  const aceptar = () => {
    onAceptar(sugerencia);
    setEstado('idle');
    setSugerencia('');
  };

  return (
    <div className="mt-2">
      {estado === 'idle' || estado === 'error' ? (
        <div>
          <button
            type="button"
            onClick={sugerirNotas}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium py-1.5"
          >
            <Sparkles size={15} />
            Asistir con IA
          </button>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      ) : estado === 'loading' ? (
        <div className="flex items-center gap-2 text-sm text-primary-500 py-2">
          <Loader size={15} className="animate-spin" />
          Generando sugerencia...
        </div>
      ) : (
        <div className="mt-3 border border-primary-200 rounded-xl overflow-hidden">
          <div className="bg-primary-50 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary-700">
              <Sparkles size={13} />
              Sugerencia de IA — revisá antes de aceptar
            </div>
            <button onClick={() => setEstado('idle')} className="text-primary-400 hover:text-primary-600">
              <X size={14} />
            </button>
          </div>
          <div className="p-3 bg-white">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sugerencia}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 flex gap-2">
            <button
              type="button"
              onClick={aceptar}
              className="flex items-center gap-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <CheckCircle size={14} />
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => setEstado('idle')}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Ignorar
            </button>
            <button
              type="button"
              onClick={sugerirNotas}
              className="text-sm text-primary-500 hover:text-primary-700 px-3 py-1.5 ml-auto"
            >
              Regenerar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
