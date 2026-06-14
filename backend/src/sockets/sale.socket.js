const registerSaleSocket = (io) => {
  io.on('connection', (socket) => {
    socket.on('screen:join', (payload = {}) => {
      if (!payload.screenId) return;
      socket.join(payload.screenId);
      socket.emit('screen:joined', { ok: true, screenId: payload.screenId });
    });

    socket.on('sale:show', (payload = {}) => {
      if (!payload.screenId) return;
      io.to(payload.screenId).emit('sale:update', {
        cliente: payload.cliente || null,
        items: payload.items || [],
        total: payload.total || 0
      });
    });

    socket.on('sale:clear', (payload = {}) => {
      if (!payload.screenId) return;
      io.to(payload.screenId).emit('sale:update', {
        cliente: null,
        items: [],
        total: 0
      });
    });
  });
};

module.exports = registerSaleSocket;
