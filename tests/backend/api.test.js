const request = require('supertest');
const app = require('../../backend/src/app');
const {
  sequelize,
  Cliente,
  Categoria,
  Producto,
  Venta,
  DetalleVenta,
  MovimientoInventario
} = require('../../backend/src/models');
const { seedTestData } = require('./fixtures');
const {
  createDatabaseOptimizations,
  optimizeDatabaseStatistics
} = require('../../backend/src/database/optimizations');

let fixtures;

beforeEach(async () => {
  app.set('io', null);
  await sequelize.sync({ force: true });
  await createDatabaseOptimizations({ resetSearch: true });
  fixtures = await seedTestData();
  await optimizeDatabaseStatistics();
});

afterAll(async () => {
  await sequelize.close();
});

describe('contrato general de la API', () => {
  it('responde el health check con el formato de éxito', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ ok: true, data: { status: 'running' } });
  });

  it('responde rutas inexistentes con el formato de error', async () => {
    const response = await request(app).get('/api/no-existe').expect(404);
    expect(response.body).toEqual({ ok: false, message: 'Ruta no encontrada' });
  });
});

describe('clientes y categorías', () => {
  it('crea, actualiza, lista y elimina un cliente', async () => {
    const created = await request(app)
      .post('/api/clientes')
      .send({ nombre: 'Ana Pérez', telefono: '987654321' })
      .expect(201);
    expect(created.body.ok).toBe(true);

    await request(app)
      .put(`/api/clientes/${created.body.data.id}`)
      .send({ nombre: 'Ana Actualizada' })
      .expect(200);

    const listed = await request(app).get('/api/clientes').expect(200);
    expect(listed.body.data.some((client) => client.nombre === 'Ana Actualizada')).toBe(true);

    await request(app).delete(`/api/clientes/${created.body.data.id}`).expect(200);
    expect(await Cliente.findByPk(created.body.data.id)).toBeNull();
  });

  it('valida el nombre y la unicidad de categorías', async () => {
    const invalid = await request(app).post('/api/categorias').send({ nombre: '  ' }).expect(400);
    expect(invalid.body).toMatchObject({ ok: false, message: expect.any(String) });

    const created = await request(app).post('/api/categorias').send({ nombre: 'Pinturas' }).expect(201);
    await request(app).post('/api/categorias').send({ nombre: 'Pinturas' }).expect(400);
    await request(app).put(`/api/categorias/${created.body.data.id}`).send({ nombre: 'Pinturas y brochas' }).expect(200);

    const category = await Categoria.findByPk(created.body.data.id);
    expect(category.nombre).toBe('Pinturas y brochas');
  });
});

describe('limites operativos de clientes', () => {
  it('limita clientes y busca por nombre o telefono', async () => {
    await Cliente.bulkCreate(Array.from({ length: 45 }, (_, index) => ({
      nombre: `Cliente masivo ${String(index).padStart(2, '0')}`,
      telefono: `90000${String(index).padStart(4, '0')}`
    })));

    const listed = await request(app).get('/api/clientes').expect(200);
    expect(listed.body.data).toHaveLength(40);
    expect(listed.body.meta).toMatchObject({ limit: 40, hasMore: true });

    const searched = await request(app).get('/api/clientes?q=900000000').expect(200);
    expect(searched.body.data).toHaveLength(1);
    expect(searched.body.data[0].nombre).toBe('Cliente masivo 00');
  });
});

describe('productos e inventario', () => {
  it('crea un producto con stock y registra su abastecimiento inicial', async () => {
    const response = await request(app).post('/api/productos').send({
      nombre: 'Serrucho',
      precio: 12990,
      descuento_maximo: 15,
      stock: 8,
      Categoria_id: fixtures.categoria.id
    }).expect(201);

    const movements = await MovimientoInventario.findAll({ where: { Producto_id: response.body.data.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ cantidad: 8, tipo_movimiento: 'abastecimiento' });
  });

  it('filtra productos y valida datos inválidos', async () => {
    const invalid = await request(app).post('/api/productos').send({ nombre: 'Malo', precio: 0 }).expect(400);
    expect(invalid.body.ok).toBe(false);

    const active = await request(app).get('/api/productos?activo=true').expect(200);
    expect(active.body.data.every((product) => product.activo === true)).toBe(true);
    await request(app).get('/api/productos?activo=quizas').expect(400);
  });

  it('abastece, ajusta y filtra movimientos de inventario', async () => {
    await request(app).post('/api/inventario/movimientos').send({
      Producto_id: fixtures.producto.id,
      cantidad: 3,
      tipo_movimiento: 'abastecimiento'
    }).expect(201);
    expect((await fixtures.producto.reload()).stock).toBe(8);

    await request(app).post('/api/inventario/movimientos').send({
      Producto_id: fixtures.producto.id,
      cantidad: 2,
      tipo_movimiento: 'ajuste'
    }).expect(201);
    expect((await fixtures.producto.reload()).stock).toBe(2);

    const filtered = await request(app).get(`/api/inventario/movimientos?producto=${fixtures.producto.id}&tipo=ajuste`).expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].tipo_movimiento).toBe('ajuste');
  });

  it('rechaza movimientos manuales inválidos sin cambiar stock', async () => {
    await request(app).post('/api/inventario/movimientos').send({
      Producto_id: fixtures.producto.id,
      cantidad: 0,
      tipo_movimiento: 'venta'
    }).expect(400);
    expect((await fixtures.producto.reload()).stock).toBe(5);
  });
  it('limita productos y movimientos sin impedir busquedas fuera del primer bloque', async () => {
    const products = await Producto.bulkCreate(Array.from({ length: 45 }, (_, index) => ({
      nombre: `Producto masivo ${String(index).padStart(2, '0')}`,
      precio: 1000 + index,
      stock: 1,
      activo: true,
      Categoria_id: fixtures.categoria.id
    })));
    await MovimientoInventario.bulkCreate(products.map((product) => ({
      cantidad: 1,
      tipo_movimiento: 'abastecimiento',
      Producto_id: product.id
    })));

    const listed = await request(app).get('/api/productos?activo=true').expect(200);
    expect(listed.body.data).toHaveLength(40);
    expect(listed.body.meta.hasMore).toBe(true);

    const productSearch = await request(app).get(`/api/productos?q=${encodeURIComponent('Producto masivo 00')}&categoria=${fixtures.categoria.id}`).expect(200);
    expect(productSearch.body.data).toHaveLength(1);

    const movementSearch = await request(app).get(`/api/inventario/movimientos?q=${encodeURIComponent('Producto masivo 00')}&tipo=abastecimiento`).expect(200);
    expect(movementSearch.body.data).toHaveLength(1);

    await request(app).get('/api/productos?limit=41').expect(400);
    await request(app).get('/api/clientes?limit=0').expect(400);
    await request(app).get('/api/inventario/movimientos?tipo=invalido').expect(400);
  });
});

describe('ventas, stock y transacciones', () => {
  const payload = () => ({
    Cliente_id: fixtures.cliente.id,
    items: [{ Producto_id: fixtures.producto.id, cantidad: 2, descuento_aplicado: 10 }]
  });

  it('descuenta stock atomicamente ante ventas simultaneas', async () => {
    const lastUnit = await Producto.create({
      nombre: 'Ultima unidad concurrente',
      precio: 5000,
      stock: 1,
      activo: true,
      Categoria_id: fixtures.categoria.id
    });
    const salePayload = {
      estado: 'confirmada',
      metodo_pago: 'transferencia',
      Cliente_id: fixtures.cliente.id,
      items: [{ Producto_id: lastUnit.id, cantidad: 1 }]
    };

    const responses = await Promise.all([
      request(app).post('/api/ventas').send(salePayload),
      request(app).post('/api/ventas').send(salePayload)
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect((await lastUnit.reload()).stock).toBe(0);
    expect(await Venta.count({ where: { estado: 'confirmada' } })).toBe(1);
  });

  it('emite el nuevo stock a los demas vendedores', async () => {
    const emit = vi.fn();
    const except = vi.fn(() => ({ emit }));
    app.set('io', { emit: vi.fn(), except });

    await request(app).post('/api/ventas').send({
      ...payload(),
      estado: 'confirmada',
      metodo_pago: 'transferencia',
      socket_id: 'vendedor-origen'
    }).expect(201);

    expect(except).toHaveBeenCalledWith('vendedor-origen');
    expect(emit).toHaveBeenCalledWith('inventory:stock', expect.objectContaining({
      reason: 'venta',
      products: [expect.objectContaining({ id: fixtures.producto.id, stock: 3 })]
    }));
  });

  it('limita el registro operativo sin recortar la analitica diaria', async () => {
    await Venta.bulkCreate(Array.from({ length: 45 }, (_, index) => ({
      totalVenta: 1000 + index,
      estado: 'cotizada',
      fecha: new Date()
    })));

    const operational = await request(app).get('/api/ventas').expect(200);
    expect(operational.body.data).toHaveLength(40);
    expect(operational.body.meta.hasMore).toBe(true);

    const limitedToday = await request(app).get('/api/ventas/hoy?limit=40').expect(200);
    expect(limitedToday.body.data).toHaveLength(40);
    expect(limitedToday.body.meta.hasMore).toBe(true);

    const analyticalToday = await request(app).get('/api/ventas/hoy').expect(200);
    expect(analyticalToday.body.data.length).toBeGreaterThan(40);
  });

  it('filtra ventas de hoy, última semana y último mes', async () => {
    const now = new Date();
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setDate(now.getDate() - 8);
    const thirtyFiveDaysAgo = new Date(now);
    thirtyFiveDaysAgo.setDate(now.getDate() - 35);

    const todaySale = await Venta.create({ totalVenta: 1000, estado: 'confirmada', fecha: now });
    const weekExcludedSale = await Venta.create({ totalVenta: 2000, estado: 'confirmada', fecha: eightDaysAgo });
    const monthExcludedSale = await Venta.create({ totalVenta: 3000, estado: 'confirmada', fecha: thirtyFiveDaysAgo });

    const today = await request(app).get('/api/ventas/hoy').expect(200);
    const week = await request(app).get('/api/ventas/ultima-semana').expect(200);
    const month = await request(app).get('/api/ventas/ultimo-mes').expect(200);

    expect(today.body.data.map((sale) => sale.id)).toContain(todaySale.id);
    expect(today.body.data.map((sale) => sale.id)).not.toContain(weekExcludedSale.id);
    expect(week.body.data.map((sale) => sale.id)).toContain(todaySale.id);
    expect(week.body.data.map((sale) => sale.id)).not.toContain(weekExcludedSale.id);
    expect(month.body.data.map((sale) => sale.id)).toEqual(expect.arrayContaining([todaySale.id, weekExcludedSale.id]));
    expect(month.body.data.map((sale) => sale.id)).not.toContain(monthExcludedSale.id);
  });

  it('recorre cotizada -> confirmada -> anulada y restaura el stock', async () => {
    const created = await request(app).post('/api/ventas').send(payload()).expect(201);
    expect(created.body.data).toMatchObject({ estado: 'cotizada', totalVenta: 18000 });
    expect((await fixtures.producto.reload()).stock).toBe(5);

    const confirmed = await request(app)
      .patch(`/api/ventas/${created.body.data.id}/confirmar`)
      .send({ metodo_pago: 'transferencia' })
      .expect(200);
    expect(confirmed.body.data.estado).toBe('confirmada');
    expect(confirmed.body.data).toMatchObject({
      metodo_pago: 'transferencia',
      total_sin_redondeo: 18000,
      ajuste_redondeo: 0,
      totalVenta: 18000
    });
    expect((await fixtures.producto.reload()).stock).toBe(3);

    const cancelled = await request(app).patch(`/api/ventas/${created.body.data.id}/anular`).expect(200);
    expect(cancelled.body.data.estado).toBe('anulada');
    expect((await fixtures.producto.reload()).stock).toBe(5);

    const movements = await MovimientoInventario.findAll({ where: { Venta_id: created.body.data.id } });
    expect(movements.map((movement) => movement.tipo_movimiento).sort()).toEqual(['anulacion', 'venta']);
  });

  it.each([
    ['cantidad inválida', () => ({ items: [{ Producto_id: fixtures.producto.id, cantidad: 0 }] })],
    ['descuento excesivo', () => ({ items: [{ Producto_id: fixtures.producto.id, cantidad: 1, descuento_aplicado: 11 }] })],
    ['producto inactivo', () => ({ items: [{ Producto_id: fixtures.productoInactivo.id, cantidad: 1 }] })],
    ['stock insuficiente', () => ({ estado: 'confirmada', metodo_pago: 'transferencia', items: [{ Producto_id: fixtures.producto.id, cantidad: 99 }] })]
  ])('rechaza %s', async (_name, makePayload) => {
    const response = await request(app).post('/api/ventas').send(makePayload()).expect(400);
    expect(response.body).toMatchObject({ ok: false, message: expect.any(String) });
  });

  it('revierte completamente una venta confirmada fallida', async () => {
    const before = {
      sales: await Venta.count(),
      details: await DetalleVenta.count(),
      movements: await MovimientoInventario.count(),
      stock: fixtures.producto.stock
    };

    await request(app).post('/api/ventas').send({
      estado: 'confirmada',
      metodo_pago: 'debito_credito',
      items: [
        { Producto_id: fixtures.producto.id, cantidad: 2 },
        { Producto_id: fixtures.productoSinStock.id, cantidad: 1 }
      ]
    }).expect(400);

    expect(await Venta.count()).toBe(before.sales);
    expect(await DetalleVenta.count()).toBe(before.details);
    expect(await MovimientoInventario.count()).toBe(before.movements);
    expect((await fixtures.producto.reload()).stock).toBe(before.stock);
  });

  it('exige y valida el método de pago al confirmar', async () => {
    await request(app).post('/api/ventas').send({
      estado: 'confirmada',
      items: [{ Producto_id: fixtures.producto.id, cantidad: 1 }]
    }).expect(400);

    await request(app).post('/api/ventas').send({
      estado: 'confirmada',
      metodo_pago: 'cheque',
      items: [{ Producto_id: fixtures.producto.id, cantidad: 1 }]
    }).expect(400);

    const quote = await request(app).post('/api/ventas').send(payload()).expect(201);
    expect(quote.body.data.metodo_pago).toBeNull();
    await request(app).patch(`/api/ventas/${quote.body.data.id}/confirmar`).expect(400);
  });

  it('redondea solo el total final de ventas en efectivo', async () => {
    const cashProduct = await Producto.create({
      nombre: 'Producto redondeo efectivo',
      precio: 12325,
      descuento_maximo: 0,
      stock: 2,
      activo: true,
      Categoria_id: fixtures.categoria.id
    });

    const cashSale = await request(app).post('/api/ventas').send({
      estado: 'confirmada',
      metodo_pago: 'efectivo',
      items: [{ Producto_id: cashProduct.id, cantidad: 1 }]
    }).expect(201);

    expect(cashSale.body.data).toMatchObject({
      metodo_pago: 'efectivo',
      total_sin_redondeo: 12325,
      ajuste_redondeo: -5,
      totalVenta: 12320
    });
    expect(cashSale.body.data.detalles[0].subtotal).toBe(12325);

    const cardSale = await request(app).post('/api/ventas').send({
      estado: 'confirmada',
      metodo_pago: 'debito_credito',
      items: [{ Producto_id: cashProduct.id, cantidad: 1 }]
    }).expect(201);

    expect(cardSale.body.data).toMatchObject({
      metodo_pago: 'debito_credito',
      total_sin_redondeo: 12325,
      ajuste_redondeo: 0,
      totalVenta: 12325
    });
  });
});

describe('indices y busqueda FTS5', () => {
  it('crea los indices, tablas virtuales y triggers esperados', async () => {
    const [indexRows] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'"
    );
    const indexNames = indexRows.map((row) => row.name);
    expect(indexNames).toEqual(expect.arrayContaining([
      'idx_productos_activo_id',
      'idx_productos_categoria_activo_id',
      'idx_clientes_nombre_telefono',
      'idx_ventas_fecha_id',
      'idx_ventas_estado_fecha_id',
      'idx_ventas_cliente_id',
      'idx_detalles_venta_id',
      'idx_detalles_producto_id',
      'idx_movimientos_fecha_id',
      'idx_movimientos_tipo_fecha_id',
      'idx_movimientos_producto_fecha_id',
      'idx_movimientos_venta_id',
      'idx_movimientos_detalle_id'
    ]));

    const [searchRows] = await sequelize.query(
      "SELECT name, type FROM sqlite_master WHERE name IN ('productos_fts', 'clientes_fts', 'productos_fts_ai', 'productos_fts_ad', 'productos_fts_au', 'clientes_fts_ai', 'clientes_fts_ad', 'clientes_fts_au')"
    );
    expect(searchRows).toHaveLength(8);
  });

  it('sincroniza FTS al crear, actualizar y eliminar registros', async () => {
    const product = await Producto.create({
      nombre: 'Serrucho profesional',
      precio: 9000,
      stock: 4,
      activo: true,
      Categoria_id: fixtures.categoria.id
    });
    const client = await Cliente.create({ nombre: 'Juan Troncoso', telefono: '90901234' });

    expect((await request(app).get('/api/productos?q=rruch').expect(200)).body.data[0].id).toBe(product.id);
    expect((await request(app).get('/api/clientes?q=onc').expect(200)).body.data[0].id).toBe(client.id);

    await product.update({ nombre: 'Alicate profesional' });
    await client.update({ nombre: 'Maria Castillo', telefono: '987654321' });
    expect((await request(app).get('/api/productos?q=rruch').expect(200)).body.data).toHaveLength(0);
    expect((await request(app).get('/api/productos?q=icat').expect(200)).body.data[0].id).toBe(product.id);
    expect((await request(app).get('/api/clientes?q=7654').expect(200)).body.data[0].id).toBe(client.id);

    await product.destroy();
    await client.destroy();
    expect((await request(app).get('/api/productos?q=icat').expect(200)).body.data).toHaveLength(0);
    expect((await request(app).get('/api/clientes?q=7654').expect(200)).body.data).toHaveLength(0);
  });

  it('usa los indices en planes representativos', async () => {
    const plans = await Promise.all([
      sequelize.query('EXPLAIN QUERY PLAN SELECT id FROM productos INDEXED BY idx_productos_activo_id WHERE activo = 1 ORDER BY id DESC LIMIT 40'),
      sequelize.query('EXPLAIN QUERY PLAN SELECT id FROM ventas INDEXED BY idx_ventas_fecha_id WHERE fecha >= 0 ORDER BY fecha DESC, id DESC LIMIT 40'),
      sequelize.query("EXPLAIN QUERY PLAN SELECT id FROM ventas INDEXED BY idx_ventas_estado_fecha_id WHERE estado = 'confirmada' ORDER BY fecha DESC, id DESC LIMIT 40"),
      sequelize.query('EXPLAIN QUERY PLAN SELECT id FROM movimientos_inventario INDEXED BY idx_movimientos_producto_fecha_id WHERE Producto_id = 1 ORDER BY fecha_hora DESC, id DESC LIMIT 40'),
      sequelize.query("EXPLAIN QUERY PLAN SELECT rowid FROM productos_fts WHERE productos_fts MATCH '\"mart\"'")
    ]);
    const details = plans.flatMap(([rows]) => rows.map((row) => row.detail)).join(' ');

    expect(details).toContain('idx_productos_activo_id');
    expect(details).toContain('idx_ventas_fecha_id');
    expect(details).toContain('idx_ventas_estado_fecha_id');
    expect(details).toContain('idx_movimientos_producto_fecha_id');
    expect(details).toContain('VIRTUAL TABLE INDEX');
  });
});
