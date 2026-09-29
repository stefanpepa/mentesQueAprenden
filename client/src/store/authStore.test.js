import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';
import { useAuthStore } from './authStore';

vi.mock('../services/api');

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ profesional: null, accessToken: null, refreshToken: null, isLoading: false, error: null });
  vi.clearAllMocks();
});

describe('authStore', () => {
  it('login exitoso guarda profesional y tokens', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        profesional: { id: '1', nombre: 'Ana', rol: 'profesional' },
        session: { access_token: 'AT', refresh_token: 'RT' }
      }
    });

    const resultado = await useAuthStore.getState().login('ana@test.com', '123456');

    expect(resultado).toEqual({ success: true });
    expect(useAuthStore.getState().profesional.nombre).toBe('Ana');
    expect(localStorage.getItem('access_token')).toBe('AT');
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it('login fallido guarda el mensaje de error y no autentica', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Credenciales inválidas' } } });

    const resultado = await useAuthStore.getState().login('ana@test.com', 'mala');

    expect(resultado).toEqual({ success: false, error: 'Credenciales inválidas' });
    expect(useAuthStore.getState().profesional).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('isAdmin refleja el rol del profesional logueado', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        profesional: { id: '1', rol: 'admin' },
        session: { access_token: 'AT', refresh_token: 'RT' }
      }
    });

    await useAuthStore.getState().login('admin@test.com', '123456');

    expect(useAuthStore.getState().isAdmin()).toBe(true);
  });

  it('logout limpia el estado y el localStorage', async () => {
    api.post.mockResolvedValueOnce({});
    localStorage.setItem('access_token', 'AT');
    localStorage.setItem('refresh_token', 'RT');
    useAuthStore.setState({ profesional: { id: '1' }, accessToken: 'AT', refreshToken: 'RT' });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().profesional).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
