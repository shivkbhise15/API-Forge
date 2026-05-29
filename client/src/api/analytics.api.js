import { api } from './axiosInstance.js';

export const analyticsApi = {
  getOverview:  ()                     => api.get('/analytics/overview'),
  getDashboard: (projectId, days = 30) => api.get('/analytics/dashboard', { params: { projectId, days } }),
  getSnapshots: (projectId, days = 30) => api.get('/analytics/snapshots',  { params: { projectId, days } }),
};

export const logApi = {
  getLogs:    (params)    => api.get('/logs',          { params }),
  getSummary: (projectId) => api.get('/logs/summary',  { params: { projectId } }),
  getOne:     (id)        => api.get(`/logs/${id}`),
};
