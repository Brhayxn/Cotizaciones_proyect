const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DetalleCotizacion = sequelize.define('DetalleCotizacion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  nombre_producto: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  precio_unitario: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  subtotal: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  Cotizacion_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Producto_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'detalle_cotizaciones'
});

module.exports = DetalleCotizacion;
