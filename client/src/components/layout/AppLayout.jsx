import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Users, Calendar, ArrowLeftRight,
  Settings, LogOut, Menu, X, Bell, ChevronRight, DollarSign, LayoutDashboard, Bot
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Asistente IA', icon: Bot, exact: true },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
];

const ADMIN_ITEMS = [
  { path: '/admin', label: 'Administración', icon: Settings }
];

const ESPECIALIDAD_LABEL = {
  psicopedagogia: 'Psicopedagogía',
  psicologia: 'Psicología',
  fonoaudiologia: 'Fonoaudiología',
  otro: 'Profesional'
};

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profesional, logout, isAdmin } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavLink = ({ item }) => {
    const Icon = item.icon;
    const active = item.exact
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    return (
      <Link
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
          active
            ? 'bg-teal-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon size={20} />
        <span>{item.label}</span>
        {active && <ChevronRight size={16} className="ml-auto" />}
      </Link>
    );
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : ''}`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">Centro de Salud</p>
            <p className="text-xs text-gray-500 truncate">Gestión Clínica</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => <NavLink key={item.path} item={item} />)}
        {isAdmin() && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">Admin</p>
            </div>
            {ADMIN_ITEMS.map(item => <NavLink key={item.path} item={item} />)}
          </>
        )}
      </nav>

      {/* Perfil */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-teal-700 font-semibold text-sm">
              {profesional?.nombre?.[0]}{profesional?.apellido?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profesional?.nombre} {profesional?.apellido}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {ESPECIALIDAD_LABEL[profesional?.especialidad] || profesional?.especialidad}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 h-full bg-white shadow-xl flex flex-col">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>
            <Sidebar mobile />
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100"
          >
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-900 flex-1">Centro de Salud</span>
          <button className="p-2 rounded-xl hover:bg-gray-100 relative">
            <Bell size={22} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
