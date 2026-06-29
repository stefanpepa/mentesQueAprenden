import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import api from './services/api';
import LoginPage from './components/auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import PacientesPage from './pages/PacientesPage';
import NuevoPacientePage from './pages/NuevoPacientePage';
import EditarPacientePage from './pages/EditarPacientePage';
import PacienteDetallePage from './pages/PacienteDetallePage';
import AgendaPage from './pages/AgendaPage';
import NuevaSesionPage from './pages/NuevaSesionPage';
import SesionDetallePage from './pages/SesionDetallePage';
import DerivacionesPage from './pages/DerivacionesPage';
import PagosPage from './pages/PagosPage';
import AdminPage from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function DevAuthSync() {
  const profesional = useAuthStore(s => s.profesional);
  useEffect(() => {
    if (import.meta.env.DEV && profesional?.id === '00000000-0000-0000-0000-000000000001') {
      api.get('/auth/me').then(r => {
        useAuthStore.setState({ profesional: r.data.profesional });
      }).catch(() => {});
    }
  }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="bottom-right" richColors />
      <DevAuthSync />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<ChatPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/pacientes" element={<PacientesPage />} />
                    <Route path="/pacientes/nuevo" element={<NuevoPacientePage />} />
                    <Route path="/pacientes/:id" element={<PacienteDetallePage />} />
                    <Route path="/pacientes/:id/editar" element={<EditarPacientePage />} />
                    <Route path="/agenda" element={<AgendaPage />} />
                    <Route path="/sesiones/nueva" element={<NuevaSesionPage />} />
                    <Route path="/sesiones/:id" element={<SesionDetallePage />} />
                    <Route path="/derivaciones" element={<DerivacionesPage />} />
                    <Route path="/pagos" element={<PagosPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
