import { api } from '../config/api.js';

export const saleService = {
  getAll: (params = {}) => api.get('/api/ventas', { params }),
  getToday: (params = {}) => api.get('/api/ventas/hoy', { params }),
  getLastWeek: () => api.get('/api/ventas/ultima-semana'),
  getLastMonth: () => api.get('/api/ventas/ultimo-mes'),
  create: (payload) => api.post('/api/ventas', payload),
  confirm: (id, metodo_pago, socket_id = null) => api.patch(`/api/ventas/${id}/confirmar`, { metodo_pago, socket_id }),
  cancel: (id, socket_id = null) => api.patch(`/api/ventas/${id}/anular`, { socket_id }),
  remove: (id) => api.delete(`/api/ventas/${id}`)
};
