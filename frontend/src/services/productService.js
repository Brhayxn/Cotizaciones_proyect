import { api } from '../config/api.js';

export const productService = {
  getAll: (params = {}) => api.get('/api/productos', { params }),
  create: (payload) => api.post('/api/productos', payload),
  update: (id, payload) => api.put(`/api/productos/${id}`, payload),
  setStatus: (id, activo) => api.patch(`/api/productos/${id}/estado`, { activo })
};
