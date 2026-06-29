import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      profesional: {
        id: '00000000-0000-0000-0000-000000000001',
        nombre: 'Admin',
        apellido: 'Test',
        email: 'admin@test.com',
        rol: 'admin',
        especialidad: 'psicopedagogia'
      },
      accessToken: 'dev-token',
      refreshToken: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          localStorage.setItem('access_token', data.session.access_token);
          localStorage.setItem('refresh_token', data.session.refresh_token);
          set({
            profesional: data.profesional,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            isLoading: false
          });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Error al iniciar sesión';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ profesional: null, accessToken: null, refreshToken: null });
      },

      isAdmin: () => get().profesional?.rol === 'admin',
      isAuthenticated: () => !!get().profesional && !!localStorage.getItem('access_token')
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        profesional: state.profesional,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken
      })
    }
  )
);
