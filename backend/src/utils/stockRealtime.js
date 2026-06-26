const { Producto } = require('../models');

const emitStockUpdates = async (req, productIds, reason) => {
  const io = req.app.get('io');
  const ids = [...new Set((productIds || []).map(Number).filter(Number.isInteger))];
  if (!io || ids.length === 0) return;

  try {
    const products = await Producto.findAll({
      where: { id: ids },
      attributes: ['id', 'nombre', 'stock', 'activo']
    });
    const payload = {
      reason,
      products: products.map((product) => product.toJSON()),
      updatedAt: new Date().toISOString()
    };
    const sourceSocketId = String(req.body?.socket_id || '').trim();
    const emitter = sourceSocketId ? io.except(sourceSocketId) : io;
    emitter.emit('inventory:stock', payload);
  } catch (error) {
    console.error('No se pudo emitir la actualizacion de stock:', error.message);
  }
};

module.exports = { emitStockUpdates };
