import { api } from '../config/api.js';

export const categoryService = {
  getAll: () => api.get('/api/categorias'),
  create: (payload) => api.post('/api/categorias', payload),
  update: (id, payload) => api.put(`/api/categorias/${id}`, payload),
  remove: (id) => api.delete(`/api/categorias/${id}`)
};
