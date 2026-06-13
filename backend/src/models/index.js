const sequelize = require('../config/database');
const Cliente = require('./Cliente');
const Categoria = require('./Categoria');
const Producto = require('./Producto');
const Cotizacion = require('./Cotizacion');
const DetalleCotizacion = require('./DetalleCotizacion');

Cliente.hasMany(Cotizacion, {
  foreignKey: 'Cliente_id',
  as: 'cotizaciones'
});

Cotizacion.belongsTo(Cliente, {
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

Cotizacion.hasMany(DetalleCotizacion, {
  foreignKey: 'Cotizacion_id',
  as: 'detalles',
  onDelete: 'CASCADE'
});

DetalleCotizacion.belongsTo(Cotizacion, {
  foreignKey: 'Cotizacion_id',
  as: 'cotizacion'
});

Producto.hasMany(DetalleCotizacion, {
  foreignKey: 'Producto_id',
  as: 'detallesCotizacion'
});

DetalleCotizacion.belongsTo(Producto, {
  foreignKey: 'Producto_id',
  as: 'producto'
});

module.exports = {
  sequelize,
  Cliente,
  Categoria,
  Producto,
  Cotizacion,
  DetalleCotizacion
};
