const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');

const clienteRoutes = require('./routes/cliente.routes');
const categoriaRoutes = require('./routes/categoria.routes');
const productoRoutes = require('./routes/producto.routes');
const ventaRoutes = require('./routes/venta.routes');
const inventarioRoutes = require('./routes/inventario.routes');

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, data: { status: 'running' } });
});

app.use('/api/clientes', clienteRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/inventario', inventarioRoutes);

const frontendDistPath = env.frontendDistPath;

app.use(express.static(frontendDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ ok: false, message: 'Error interno del servidor' });
});

module.exports = app;
