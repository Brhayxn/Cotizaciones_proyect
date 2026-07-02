import { api } from '../config/api.js';

export const quoteService = {
  // Alias simple de ventas usado por código que piensa en "cotizaciones".
  create: (payload) => api.post('/api/ventas', payload),
  getAll: () => api.get('/api/ventas')
};
