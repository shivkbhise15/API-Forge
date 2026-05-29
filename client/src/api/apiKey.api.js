import { api } from './axiosInstance.js';

export const apiKeyApi = {
  list:   (projectId, params) => api.get('/keys', { params: { projectId, ...params } }),
  getOne: (id)                => api.get(`/keys/${id}`),
  create: (data)              => api.post('/keys', data),
  update: (id, data)          => api.patch(`/keys/${id}`, data),
  revoke: (id)                => api.patch(`/keys/${id}/revoke`),
  delete: (id)                => api.delete(`/keys/${id}`),
};
