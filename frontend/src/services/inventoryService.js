import { api } from '../config/api.js';

export const inventoryService = {
  getMovements: (params = {}) => api.get('/api/inventario/movimientos', { params }),
  createMovement: (payload) => api.post('/api/inventario/movimientos', payload)
};
