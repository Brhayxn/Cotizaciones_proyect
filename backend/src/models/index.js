const sequelize = require('../config/database');
const Cliente = require('./Cliente');
const Categoria = require('./Categoria');
const Producto = require('./Producto');
const Venta = require('./Venta');
const DetalleVenta = require('./DetalleVenta');
const MovimientoInventario = require('./MovimientoInventario');

Cliente.hasMany(Venta, {
  foreignKey: 'Cliente_id',
  as: 'ventas'
});

Venta.belongsTo(Cliente, {
  foreignKey: 'Cliente_id',
  as: 'cliente'
});

Categoria.hasMany(Producto, {
  foreignKey: 'Categoria_id',
  as: 'productos'
});

Producto.belongsTo(Categoria, {
  foreignKey: 'Categoria_id',
  as: 'categoria'
});

Venta.hasMany(DetalleVenta, {
  foreignKey: 'Venta_id',
  as: 'detalles',
  onDelete: 'CASCADE'
});

DetalleVenta.belongsTo(Venta, {
  foreignKey: 'Venta_id',
  as: 'venta'
});

Producto.hasMany(DetalleVenta, {
  foreignKey: 'Producto_id',
  as: 'detallesVenta'
});

DetalleVenta.belongsTo(Producto, {
  foreignKey: 'Producto_id',
  as: 'producto'
});

Producto.hasMany(MovimientoInventario, {
  foreignKey: 'Producto_id',
  as: 'movimientosInventario'
});

MovimientoInventario.belongsTo(Producto, {
  foreignKey: 'Producto_id',
  as: 'producto'
});

Venta.hasMany(MovimientoInventario, {
  foreignKey: 'Venta_id',
  as: 'movimientosInventario'
});

MovimientoInventario.belongsTo(Venta, {
  foreignKey: 'Venta_id',
  as: 'venta'
});

DetalleVenta.hasMany(MovimientoInventario, {
  foreignKey: 'DetalleVenta_id',
  as: 'movimientosInventario'
});

MovimientoInventario.belongsTo(DetalleVenta, {
  foreignKey: 'DetalleVenta_id',
  as: 'detalleVenta'
});

module.exports = {
  sequelize,
  Cliente,
  Categoria,
  Producto,
  Venta,
  DetalleVenta,
  MovimientoInventario
};
