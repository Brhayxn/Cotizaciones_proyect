const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const env = require('./env');

const databasePath = env.databasePath;
const databaseDir = path.dirname(databasePath);

if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: databasePath,
  logging: env.databaseLogging ? console.log : false,
  pool: {
    max: 1,       // una sola conexión → sin competencia por lock
    min: 0,
    acquire:30000 , // tiempo máximo esperando conexión del pool
    idle: 10000
  }
});

const runPragma = (connection, statement) => new Promise((resolve, reject) => {
  connection.run(statement, (error) => {
    if (error) return reject(error);
    return resolve();
  });
});

const configuredConnections = new WeakSet();
const getConnection = sequelize.connectionManager.getConnection.bind(
  sequelize.connectionManager
);

// Sequelize no ejecuta afterConnect para SQLite, por eso se configura al adquirirla.
sequelize.connectionManager.getConnection = async (options) => {
  const connection = await getConnection(options);

  if (!configuredConnections.has(connection)) {
    await runPragma(connection, `PRAGMA journal_mode = ${env.sqliteJournalMode}`);
    await runPragma(connection, `PRAGMA busy_timeout = ${env.sqliteBusyTimeout}`);
    configuredConnections.add(connection);
  }

  return connection;
};

module.exports = sequelize;
