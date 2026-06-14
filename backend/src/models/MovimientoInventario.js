const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoInventario = sequelize.define('MovimientoInventario', {
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
  tipo_movimiento: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['ajuste', 'venta', 'abastecimiento', 'anulacion']]
    }
  },
  fecha_hora: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Producto_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Venta_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  DetalleVenta_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'movimientos_inventario'
});

module.exports = MovimientoInventario;
