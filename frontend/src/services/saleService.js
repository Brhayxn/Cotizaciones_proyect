import { api } from '../config/api.js';

export const saleService = {
  // Capa delgada: las pantallas no necesitan conocer rutas exactas de ventas.
  getAll: (params = {}) => api.get('/api/ventas', { params }),
  getToday: (params = {}) => api.get('/api/ventas/hoy', { params }),
  getLastWeek: () => api.get('/api/ventas/ultima-semana'),
  getLastMonth: () => api.get('/api/ventas/ultimo-mes'),
  create: (payload) => api.post('/api/ventas', payload),
  confirm: (id, metodo_pago, socket_id = null, monto_pagado = null) => api.patch(`/api/ventas/${id}/confirmar`, { metodo_pago, socket_id, monto_pagado }),
  registerPayment: (id, payload) => api.post(`/api/ventas/${id}/pagos`, payload),
  cancel: (id, socket_id = null) => api.patch(`/api/ventas/${id}/anular`, { socket_id }),
  remove: (id) => api.delete(`/api/ventas/${id}`)
};
