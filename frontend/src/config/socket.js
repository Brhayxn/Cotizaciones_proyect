import { io } from 'socket.io-client';
import { API_URL } from './api.js';

export const socket = io(API_URL, {
  // WebSocket es preferido; polling queda como respaldo si la red lo bloquea.
  autoConnect: true,
  transports: ['websocket', 'polling']
});
