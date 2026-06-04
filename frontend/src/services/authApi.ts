import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  AdminUser,
  VerifyTokenResponse,
} from '../types/auth';
import { getAdminToken, clearAdminToken } from '../utils/token';

const api = axios.create({
  baseURL: '/api',
});

// ---------------------------------------------------------------------------
// Request interceptor — attach admin JWT as Bearer token
// ---------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  const adminToken = getAdminToken();
  if (adminToken && config.headers) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — clear admin token and redirect on 401
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAdminToken();
      // Only redirect if not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const authApi = {
  /** Admin login — backend expects form-encoded data */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append('username', data.username);
    formData.append('password', data.password);
    const response = await api.post<LoginResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },

  /** Verify current admin token and return user info */
  async getMe(): Promise<AdminUser> {
    const response = await api.get<AdminUser>('/auth/me');
    return response.data;
  },

  /** Verify a service token (for frontend bio/writing/literature pages) */
  async verifyServiceToken(token: string): Promise<VerifyTokenResponse> {
    const response = await api.post<VerifyTokenResponse>(
      '/auth/verify-service-token',
      { token },
    );
    return response.data;
  },
};

export default authApi;
