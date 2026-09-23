import { api } from '../config/api.js';

export const inventoryService = {
  // Se usa para resumen, historial y movimientos manuales de stock.
  getSummary: () => api.get('/api/inventario/resumen'),
  getMovements: (params = {}) => api.get('/api/inventario/movimientos', { params }),
  createMovement: (payload) => api.post('/api/inventario/movimientos', payload)
};
