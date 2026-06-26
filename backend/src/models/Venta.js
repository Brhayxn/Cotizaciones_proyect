const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PAYMENT_METHODS } = require('../utils/payment');

const Venta = sequelize.define('Venta', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  totalVenta: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  total_sin_redondeo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  ajuste_redondeo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  metodo_pago: {
    type: DataTypes.ENUM(...PAYMENT_METHODS),
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'cotizada',
    validate: {
      isIn: [['cotizada', 'confirmada', 'anulada']]
    }
  },
  Cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'ventas'
});

module.exports = Venta;
