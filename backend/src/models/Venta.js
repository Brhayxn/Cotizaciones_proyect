const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
