import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const ESPECIALIDADES = [
  { value: 'psicopedagogia', label: 'Psicopedagogía' },
  { value: 'psicologia', label: 'Psicología' },
  { value: 'fonoaudiologia', label: 'Fonoaudiología' },
  { value: 'otro', label: 'Otro' }
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', password: '',
    especialidad: 'psicopedagogia', matricula: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const { signup, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await signup(form);
    if (result.success) navigate('/');
  };

  const inputClass = 'w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow';

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
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-primary-500/20"
            style={{ background: 'linear-gradient(135deg, #9b5de5 0%, #8347d1 100%)' }}
          >
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">Centro de Salud · Gestión Clínica Interdisciplinaria</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <div className="relative">
                <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.nombre} onChange={set('nombre')} required autoFocus className={inputClass} placeholder="Florencia" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
              <input value={form.apellido} onChange={set('apellido')} required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow" placeholder="García" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" className={inputClass} placeholder="tu@email.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow"
                placeholder="Mínimo 8 caracteres"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Especialidad</label>
              <select
                value={form.especialidad}
                onChange={set('especialidad')}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow"
              >
                {ESPECIALIDADES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Matrícula</label>
              <input value={form.matricula} onChange={set('matricula')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow" placeholder="Opcional" />
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
            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <Link
            to="/login"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1.5 pt-1"
          >
            <ArrowLeft size={15} /> Ya tengo cuenta, iniciar sesión
          </Link>
        </form>
      </motion.div>
    </div>
  );
}
