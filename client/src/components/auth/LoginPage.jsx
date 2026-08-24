import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <CheckCircle2 size={40} className="mx-auto mb-3 text-primary-500" />
        <p className="text-gray-800 font-medium mb-1">Revisá tu email</p>
        <p className="text-sm text-gray-500 mb-6">
          Si <span className="font-medium">{email}</span> está registrado, te llegará un link para restablecer tu contraseña.
        </p>
        <button
          onClick={onBack}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5 mx-auto"
        >
          <ArrowLeft size={15} /> Volver al inicio de sesión
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 mb-2"
      >
        <ArrowLeft size={15} /> Volver
      </button>
      <p className="text-sm text-gray-500">
        Ingresá tu email y te mandamos un link para restablecer tu contraseña.
      </p>
      <div className="relative">
        <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow"
          placeholder="tu@email.com"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Enviando...' : 'Enviar link'}
      </button>
    </motion.form>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modo, setModo] = useState('login'); // 'login' | 'forgot'
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) navigate('/');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f6f0fb 0%, #eee0f7 50%, #f5e8f9 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white rounded-2xl shadow-xl shadow-primary-900/5 w-full max-w-md p-8 border border-primary-100/50"
      >
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-primary-500/20"
            style={{ background: 'linear-gradient(135deg, #9b5de5 0%, #8347d1 100%)' }}
          >
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Salud</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión Clínica Interdisciplinaria</p>
        </div>

        <AnimatePresence mode="wait">
          {modo === 'forgot' ? (
            <ForgotPasswordForm key="forgot" onBack={() => setModo('login')} />
          ) : (
            <motion.form
              key="login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => setModo('forgot')}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm overflow-hidden"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </button>

              <p className="text-sm text-gray-500 text-center pt-1">
                ¿No tenés cuenta?{' '}
                <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                  Crear cuenta
                </Link>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
