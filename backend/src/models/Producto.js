const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  precio: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  Categoria_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'productos'
});

module.exports = Producto;
