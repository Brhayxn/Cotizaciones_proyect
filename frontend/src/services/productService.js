import { api } from '../config/api.js';

export const productService = {
  getAll: (params = {}) => api.get('/api/productos', { params }),
  getById: (id) => api.get(`/api/productos/${id}`),
  create: (payload) => api.post('/api/productos', payload),
  update: (id, payload) => api.put(`/api/productos/${id}`, payload),
  setStatus: (id, activo) => api.patch(`/api/productos/${id}/estado`, { activo })
};
