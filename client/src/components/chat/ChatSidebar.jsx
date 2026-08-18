import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Bot, Loader2, MoreVertical, Settings, LogOut } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { ToolResultCard } from './ChatToolResults';

const SUGERENCIAS = [
  { label: 'Ver agenda de hoy', msg: '¿Qué turnos tengo hoy?' },
  { label: 'Buscar paciente', msg: 'Buscar paciente ' },
  { label: 'Nuevo turno', msg: 'Quiero agendar un turno' },
  { label: 'Nuevo paciente', msg: 'Quiero registrar un nuevo paciente' }
];

const STORAGE_KEY = 'chat_historial';

export default function ChatSidebar() {
  const { profesional, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(STORAGE_KEY);
      return guardado ? JSON.parse(guardado) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  const enviar = async (texto) => {
    const limpio = texto.trim();
    if (!limpio || loading) return;
    const historial = [...messages, { role: 'user', content: limpio }];
    setMessages(historial);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ia/chat', {
        messages: historial.map(m => ({ role: m.role, content: m.content }))
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, tool_results: data.tool_results }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.response?.data?.error || err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input); }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const iniciales = `${profesional?.nombre?.[0] || ''}${profesional?.apellido?.[0] || ''}`;

  return (
    <div className="w-full md:w-[380px] bg-sidebar flex flex-col flex-shrink-0 h-[55vh] md:h-full">
      {/* Header usuario */}
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-between relative">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #f5c55e 0%, #e97979 100%)' }}
          >
            {iniciales}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#f2eef7] truncate">
              {profesional?.nombre} {profesional?.apellido}
            </p>
            <p className="text-xs text-[#9891a8] truncate">{profesional?.especialidad}</p>
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="p-1 text-[#9891a8] hover:text-[#f2eef7] transition-colors flex-shrink-0"
          title="Menú"
        >
          <MoreVertical size={18} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-14 right-4 z-20 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
              {isAdmin() && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-primary-50">
                  <Settings size={16} /> Administración
                </Link>
              )}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50">
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot size={36} className="mx-auto mb-3 text-[#4a4258]" />
            <p className="text-[#f2eef7] mb-1">Hola, {profesional?.nombre}.</p>
            <p className="text-sm text-[#9891a8] mb-5">¿En qué te puedo ayudar hoy?</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGERENCIAS.map(s => (
                <button
                  key={s.label}
                  onClick={() => enviar(s.msg)}
                  className="px-3 py-2 bg-sidebar-bubble border border-sidebar-borderLight rounded-xl text-xs text-[#ded9e8] hover:border-primary-500 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-primary-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold">IA</div>
              )}
              <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    isUser ? 'text-[#2a2a2a]' : 'bg-sidebar-bubble border border-sidebar-borderLight text-[#ded9e8]'
                  }`}
                  style={isUser ? { background: '#f5c55e' } : undefined}
                >
                  {msg.content}
                </div>
                {msg.tool_results?.map((tr, j) => (
                  <ToolResultCard key={j} name={tr.name} result={tr.result} />
                ))}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold">IA</div>
            <div className="bg-sidebar-bubble border border-sidebar-borderLight rounded-xl px-3 py-2.5">
              <Loader2 size={16} className="animate-spin text-[#9891a8]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar-header">
        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder="Pregunta algo..."
            className="flex-1 border border-sidebar-borderLight rounded-lg px-3 py-2.5 text-[13px] text-[#f2eef7] bg-sidebar-bubble placeholder:text-[#7a7288] focus:outline-none focus:border-primary-500 disabled:opacity-60"
          />
          <button
            onClick={() => enviar(input)}
            disabled={!input.trim() || loading}
            className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
