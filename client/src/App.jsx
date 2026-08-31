import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import MainShell from './components/layout/MainShell';
import InicioPage from './pages/InicioPage';
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
import NuevaEvaluacionPage from './pages/NuevaEvaluacionPage';
import EvaluacionDetallePage from './pages/EvaluacionDetallePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function PublicOnlyRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="bottom-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainShell>
                  <Routes>
                    <Route path="/" element={<InicioPage />} />
                    <Route path="/pacientes" element={<PacientesPage />} />
                    <Route path="/pacientes/nuevo" element={<NuevoPacientePage />} />
                    <Route path="/pacientes/:id" element={<PacienteDetallePage />} />
                    <Route path="/pacientes/:id/editar" element={<EditarPacientePage />} />
                    <Route path="/agenda" element={<AgendaPage />} />
                    <Route path="/sesiones/nueva" element={<NuevaSesionPage />} />
                    <Route path="/sesiones/:id" element={<SesionDetallePage />} />
                    <Route path="/evaluaciones/nueva" element={<NuevaEvaluacionPage />} />
                    <Route path="/evaluaciones/:id" element={<EvaluacionDetallePage />} />
                    <Route path="/derivaciones" element={<DerivacionesPage />} />
                    <Route path="/pagos" element={<PagosPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </MainShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
