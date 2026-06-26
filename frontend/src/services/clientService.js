import { api } from '../config/api.js';

export const clientService = {
  getAll: (params = {}) => api.get('/api/clientes', { params }),
  getById: (id) => api.get(`/api/clientes/${id}`),
  getQuotes: (id, params = {}) => api.get(`/api/clientes/${id}/ventas`, { params }),
  create: (payload) => api.post('/api/clientes', payload),
  update: (id, payload) => api.put(`/api/clientes/${id}`, payload),
  remove: (id) => api.delete(`/api/clientes/${id}`)
};
