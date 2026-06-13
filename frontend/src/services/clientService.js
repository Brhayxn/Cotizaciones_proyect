import { api } from '../config/api.js';

export const clientService = {
  getAll: () => api.get('/api/clientes'),
  getById: (id) => api.get(`/api/clientes/${id}`),
  getQuotes: (id) => api.get(`/api/clientes/${id}/cotizaciones`),
  create: (payload) => api.post('/api/clientes', payload),
  update: (id, payload) => api.put(`/api/clientes/${id}`, payload),
  remove: (id) => api.delete(`/api/clientes/${id}`)
};
