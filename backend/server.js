const http = require('http');
const { Server } = require('socket.io');
const env = require('./src/config/env');
const app = require('./src/app');
const { sequelize } = require('./src/models');
const registerSaleSocket = require('./src/sockets/sale.socket');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.socketCorsOrigin
  }
});

app.set('io', io);
registerSaleSocket(io);

let isShuttingDown = false;

const closeHttpServer = () => new Promise((resolve, reject) => {
  if (!server.listening) {
    resolve();
    return;
  }

  server.close((error) => {
    if (error) reject(error);
    else resolve();
  });
});

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nCerrando servidor por ${signal}...`);

  const forcedExit = setTimeout(() => {
    console.error('Cierre forzado tras agotar el tiempo de espera');
    process.exit(1);
  }, 10000);
  forcedExit.unref();

  try {
    io.disconnectSockets(true);
    await closeHttpServer();
    await sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
    await sequelize.close();
    console.log('Base de datos consolidada y conexiones cerradas');
    process.exit(0);
  } catch (error) {
    console.error('Error durante el cierre:', error.message);
    process.exit(1);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

const startServer = async () => {
  try {
    await sequelize.sync();

    server.listen(env.port, env.host, () => {
      console.log(`Servidor ejecutandose en http://localhost:${env.port}`);
      console.log(`Disponible en la red usando http://IP-DE-ESTE-EQUIPO:${env.port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
