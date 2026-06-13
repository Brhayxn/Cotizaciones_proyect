const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

const databaseDir = path.join(__dirname, '../../database');
const databasePath = path.join(databaseDir, 'database.sqlite');

if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: databasePath,
  logging: false
});

module.exports = sequelize;
