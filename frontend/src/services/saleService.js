import { api } from '../config/api.js';

export const saleService = {
  getAll: (params = {}) => api.get('/api/ventas', { params }),
  create: (payload) => api.post('/api/ventas', payload),
  confirm: (id) => api.patch(`/api/ventas/${id}/confirmar`),
  cancel: (id) => api.patch(`/api/ventas/${id}/anular`),
  remove: (id) => api.delete(`/api/ventas/${id}`)
};
