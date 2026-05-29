import { api } from './axiosInstance.js';

export const projectApi = {
  list:   (params)     => api.get('/projects', { params }),
  getOne: (id)         => api.get(`/projects/${id}`),
  create: (data)       => api.post('/projects', data),
  update: (id, data)   => api.put(`/projects/${id}`, data),
  delete: (id)         => api.delete(`/projects/${id}`),
};
