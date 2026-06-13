require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { sequelize } = require('./src/models');
const registerQuoteSocket = require('./src/sockets/quote.socket');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

registerQuoteSocket(io);

const startServer = async () => {
  try {
    await sequelize.sync();

    server.listen(PORT, HOST, () => {
      console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
      console.log(`Disponible en la red usando http://IP-DE-ESTE-EQUIPO:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
