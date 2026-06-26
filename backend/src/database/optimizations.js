const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { clearSearchIndexCache } = require('../utils/searchIndex');

const INDEX_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_productos_activo_id ON productos (activo, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_productos_categoria_activo_id ON productos (Categoria_id, activo, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_clientes_nombre_telefono ON clientes (nombre, telefono)',
  'CREATE INDEX IF NOT EXISTS idx_ventas_fecha_id ON ventas (fecha DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_ventas_estado_fecha_id ON ventas (estado, fecha DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id ON ventas (Cliente_id, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_detalles_venta_id ON detalle_ventas (Venta_id, id)',
  'CREATE INDEX IF NOT EXISTS idx_detalles_producto_id ON detalle_ventas (Producto_id, id)',
  'CREATE INDEX IF NOT EXISTS idx_movimientos_fecha_id ON movimientos_inventario (fecha_hora DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_movimientos_tipo_fecha_id ON movimientos_inventario (tipo_movimiento, fecha_hora DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_movimientos_producto_fecha_id ON movimientos_inventario (Producto_id, fecha_hora DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_movimientos_venta_id ON movimientos_inventario (Venta_id, id)',
  'CREATE INDEX IF NOT EXISTS idx_movimientos_detalle_id ON movimientos_inventario (DetalleVenta_id, id)'
];

const DROP_SEARCH_STATEMENTS = [
  'DROP TRIGGER IF EXISTS productos_fts_ai',
  'DROP TRIGGER IF EXISTS productos_fts_ad',
  'DROP TRIGGER IF EXISTS productos_fts_au',
  'DROP TRIGGER IF EXISTS clientes_fts_ai',
  'DROP TRIGGER IF EXISTS clientes_fts_ad',
  'DROP TRIGGER IF EXISTS clientes_fts_au',
  'DROP TABLE IF EXISTS productos_fts',
  'DROP TABLE IF EXISTS clientes_fts'
];

const SEARCH_STATEMENTS = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS productos_fts USING fts5(
    nombre,
    content='productos',
    content_rowid='id',
    tokenize='trigram'
  )`,
  `CREATE TRIGGER IF NOT EXISTS productos_fts_ai AFTER INSERT ON productos BEGIN
    INSERT INTO productos_fts(rowid, nombre) VALUES (new.id, new.nombre);
  END`,
  `CREATE TRIGGER IF NOT EXISTS productos_fts_ad AFTER DELETE ON productos BEGIN
    INSERT INTO productos_fts(productos_fts, rowid, nombre)
    VALUES ('delete', old.id, old.nombre);
  END`,
  `CREATE TRIGGER IF NOT EXISTS productos_fts_au AFTER UPDATE OF nombre ON productos BEGIN
    INSERT INTO productos_fts(productos_fts, rowid, nombre)
    VALUES ('delete', old.id, old.nombre);
    INSERT INTO productos_fts(rowid, nombre) VALUES (new.id, new.nombre);
  END`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS clientes_fts USING fts5(
    nombre,
    telefono,
    content='clientes',
    content_rowid='id',
    tokenize='trigram'
  )`,
  `CREATE TRIGGER IF NOT EXISTS clientes_fts_ai AFTER INSERT ON clientes BEGIN
    INSERT INTO clientes_fts(rowid, nombre, telefono)
    VALUES (new.id, new.nombre, new.telefono);
  END`,
  `CREATE TRIGGER IF NOT EXISTS clientes_fts_ad AFTER DELETE ON clientes BEGIN
    INSERT INTO clientes_fts(clientes_fts, rowid, nombre, telefono)
    VALUES ('delete', old.id, old.nombre, old.telefono);
  END`,
  `CREATE TRIGGER IF NOT EXISTS clientes_fts_au AFTER UPDATE OF nombre, telefono ON clientes BEGIN
    INSERT INTO clientes_fts(clientes_fts, rowid, nombre, telefono)
    VALUES ('delete', old.id, old.nombre, old.telefono);
    INSERT INTO clientes_fts(rowid, nombre, telefono)
    VALUES (new.id, new.nombre, new.telefono);
  END`
];

const runStatements = async (statements) => {
  for (const statement of statements) await sequelize.query(statement);
};

const createDatabaseOptimizations = async ({ resetSearch = false, rebuildSearch = false } = {}) => {
  if (resetSearch) await runStatements(DROP_SEARCH_STATEMENTS);
  await runStatements(INDEX_STATEMENTS);
  await runStatements(SEARCH_STATEMENTS);

  if (rebuildSearch) {
    await sequelize.query("INSERT INTO productos_fts(productos_fts) VALUES ('rebuild')");
    await sequelize.query("INSERT INTO clientes_fts(clientes_fts) VALUES ('rebuild')");
  }

  clearSearchIndexCache();
};

const optimizeDatabaseStatistics = async () => {
  await sequelize.query('ANALYZE');
  await sequelize.query('PRAGMA optimize', { type: QueryTypes.SELECT });
};

module.exports = {
  createDatabaseOptimizations,
  optimizeDatabaseStatistics
};
