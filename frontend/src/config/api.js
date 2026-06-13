import axios from 'axios';

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

export const API_URL = import.meta.env.VITE_API_URL || browserOrigin;

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'No se pudo conectar con la API';
    return Promise.reject(new Error(message));
  }
);
