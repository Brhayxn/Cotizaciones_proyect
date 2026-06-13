import { api } from '../config/api.js';

export const quoteService = {
  create: (payload) => api.post('/api/cotizaciones', payload),
  getAll: () => api.get('/api/cotizaciones')
};
