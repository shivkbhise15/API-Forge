import { api } from './axiosInstance.js';

export const authApi = {
  register:       (data)  => api.post('/auth/register', data),
  login:          (data)  => api.post('/auth/login', data),
  logout:         ()      => api.post('/auth/logout'),
  refresh:        ()      => api.post('/auth/refresh'),
  getMe:          ()      => api.get('/auth/me'),
  verifyEmail:    (token) => api.get(`/auth/verify-email/${token}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (data)  => api.post('/auth/reset-password', data),
};
