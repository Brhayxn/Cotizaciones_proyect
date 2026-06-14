import { api } from '../config/api.js';

export const quoteService = {
  create: (payload) => api.post('/api/ventas', payload),
  getAll: () => api.get('/api/ventas')
};
