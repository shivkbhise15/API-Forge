/**
 * Axios instance with transparent token refresh.
 *
 * Key design decisions:
 * 1. Access token stored in Zustand memory (never localStorage — XSS safe)
 * 2. Refresh token is an httpOnly cookie — not accessible to JS
 * 3. On 401: calls /auth/refresh using a PLAIN axios (not the intercepted api
 *    instance) to avoid infinite 401 → refresh → 401 loops
 * 4. Concurrent requests that 401 during a refresh are queued and retried
 *    together once the new token arrives
 */
import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Main intercepted instance — used everywhere in the app
export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Plain instance for the refresh call — NO interceptors, avoids loops
const refreshApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ── Request interceptor: attach access token ─────────────────────────────
api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: transparent token refresh on 401 ───────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 and only retry once per request
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Queue concurrent requests that arrive during a refresh
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Use the plain refreshApi (no interceptors) to avoid 401 loop
      const { data } = await refreshApi.post('/auth/refresh');
      const newToken = data.data.accessToken;

      useAuthStore.getState().setAccessToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      // Redirect to login page
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
