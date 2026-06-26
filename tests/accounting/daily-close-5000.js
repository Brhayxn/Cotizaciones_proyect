const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');
const { chromium } = require('@playwright/test');
const backendRequire = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { Op, QueryTypes } = backendRequire('sequelize');

const SEED = 0x5eed1234;
const SALE_COUNT = 5000;
const PRODUCT_COUNT = 120;
const INITIAL_STOCK = 1000000;
const FIXED_DATE = new Date('2026-01-15T15:00:00.000Z');
const DASHBOARD_LIMIT_MS = Number(process.env.ACCOUNTING_DASHBOARD_LIMIT_MS || 120000);
const databasePath = path.join(os.tmpdir(), `cotizaciones-accounting-${process.pid}.sqlite`);

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = databasePath;

const app = require('../../backend/src/app');
const {
  sequelize,
  Producto,
  Venta,
  DetalleVenta,
  MovimientoInventario
} = require('../../backend/src/models');
const {
  createDatabaseOptimizations,
  optimizeDatabaseStatistics
} = require('../../backend/src/database/optimizations');

const fail = (message) => { throw new Error(message); };

const assertEqual = (actual, expected, label) => {
  if (Number(actual) !== Number(expected)) {
    fail(`${label}: esperado ${expected}, obtenido ${actual}`);
  }
};

const createRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
};

const exactSubtotal = ({ quantity, price, discount }) => (
  Math.floor((quantity * price * (100 - discount) + 50) / 100)
);

const statusFor = (index) => {
  const bucket = index % 10;
  if (bucket === 0) return 'anulada';
  if (bucket <= 2) return 'cotizada';
  return 'confirmada';
};

const discountFor = ({ mode, maximum, random }) => {
  if (maximum === 0 || mode === 0) return 0;
  if (mode === 1) return maximum;
  if (mode === 2) return Math.floor(maximum / 2);
  return random() % (maximum + 1);
};

const requestJson = async (baseUrl, pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    fail(`${options.method || 'GET'} ${pathname}: HTTP ${response.status} - ${payload.message || 'error'}`);
  }
  return payload.data;
};

const createProducts = async (baseUrl) => {
  const category = await requestJson(baseUrl, '/api/categorias', {
    method: 'POST',
    body: JSON.stringify({ nombre: 'Precision contable' })
  });
  const products = [];

  for (let index = 0; index < PRODUCT_COUNT; index += 1) {
    products.push(await requestJson(baseUrl, '/api/productos', {
      method: 'POST',
      body: JSON.stringify({
        nombre: `Producto contable ${String(index + 1).padStart(3, '0')}`,
        precio: 1001 + index * 37,
        descuento_maximo: index % 31,
        stock: INITIAL_STOCK,
        Categoria_id: category.id
      })
    }));
  }
  return products;
};

const compareCreatedSale = (created, expectedItems, expectedTotal, saleNumber) => {
  assertEqual(created.totalVenta, expectedTotal, `Venta ${saleNumber}: total API`);
  assertEqual(created.detalles.length, expectedItems.length, `Venta ${saleNumber}: cantidad de detalles`);
  const detailsByProduct = new Map(created.detalles.map((detail) => [Number(detail.Producto_id), detail]));

  for (const expected of expectedItems) {
    const actual = detailsByProduct.get(expected.Producto_id);
    if (!actual) fail(`Venta ${saleNumber}: falta detalle del producto ${expected.Producto_id}`);
    assertEqual(actual.cantidad, expected.quantity, `Venta ${saleNumber}: cantidad producto ${expected.Producto_id}`);
    assertEqual(actual.precio_unitario, expected.price, `Venta ${saleNumber}: precio producto ${expected.Producto_id}`);
    assertEqual(actual.descuento_aplicado, expected.discount, `Venta ${saleNumber}: descuento producto ${expected.Producto_id}`);
    assertEqual(actual.subtotal, expected.subtotal, `Venta ${saleNumber}: subtotal producto ${expected.Producto_id}`);
  }
};

const readDashboardMetric = async (page, label) => page.evaluate((metricLabel) => {
  const labelNode = [...document.querySelectorAll('p, span')].find((node) => node.textContent.trim() === metricLabel);
  return labelNode?.parentElement?.querySelector('strong')?.textContent?.trim() || null;
}, label);

const currencyDigits = (value) => String(value || '').replace(/[^0-9]/g, '');

const main = async () => {
  let server;
  let browser;
  const startedAt = performance.now();

  try {
    await sequelize.sync({ force: true });
    await createDatabaseOptimizations({ resetSearch: true });
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const products = await createProducts(baseUrl);
    const client = await requestJson(baseUrl, '/api/clientes', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Cliente cierre masivo', telefono: '900000000' })
    });

    const random = createRandom(SEED);
    const expectedStocks = new Map(products.map((product) => [product.id, INITIAL_STOCK]));
    const annulledSaleIds = new Set();
    let expectedClose = 0;
    let expectedUnits = 0;
    let detailCount = 0;
    let fractionalCases = 0;
    let halfCases = 0;

    for (let saleIndex = 0; saleIndex < SALE_COUNT; saleIndex += 1) {
      const finalStatus = statusFor(saleIndex);
      const itemCount = 1 + (random() % 5);
      const selected = new Set();
      const expectedItems = [];

      while (expectedItems.length < itemCount) {
        const product = products[random() % products.length];
        if (selected.has(product.id)) continue;
        selected.add(product.id);
        const quantity = 1 + (random() % 9);
        const discount = discountFor({
          mode: (saleIndex + expectedItems.length) % 4,
          maximum: Number(product.descuento_maximo),
          random
        });
        const numerator = quantity * Number(product.precio) * (100 - discount);
        if (numerator % 100 !== 0) fractionalCases += 1;
        if (numerator % 100 === 50) halfCases += 1;
        expectedItems.push({
          Producto_id: product.id,
          quantity,
          price: Number(product.precio),
          discount,
          subtotal: exactSubtotal({ quantity, price: Number(product.precio), discount })
        });
      }

      const expectedTotal = expectedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const created = await requestJson(baseUrl, '/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          estado: finalStatus === 'cotizada' ? 'cotizada' : 'confirmada',
          ...(finalStatus === 'cotizada' ? {} : { metodo_pago: 'transferencia' }),
          Cliente_id: client.id,
          items: expectedItems.map((item) => ({
            Producto_id: item.Producto_id,
            cantidad: item.quantity,
            descuento_aplicado: item.discount
          }))
        })
      });

      compareCreatedSale(created, expectedItems, expectedTotal, saleIndex + 1);
      detailCount += expectedItems.length;

      if (finalStatus === 'confirmada') {
        expectedClose += expectedTotal;
        for (const item of expectedItems) {
          expectedUnits += item.quantity;
          expectedStocks.set(item.Producto_id, expectedStocks.get(item.Producto_id) - item.quantity);
        }
      } else if (finalStatus === 'anulada') {
        const cancelled = await requestJson(baseUrl, `/api/ventas/${created.id}/anular`, { method: 'PATCH' });
        if (cancelled.estado !== 'anulada') fail(`Venta ${saleIndex + 1}: no quedo anulada`);
        annulledSaleIds.add(created.id);
      }

      if ((saleIndex + 1) % 500 === 0) {
        console.log(`Generadas y verificadas ${saleIndex + 1}/${SALE_COUNT} ventas...`);
      }
    }

    if (fractionalCases < 1000 || halfCases === 0) {
      fail(`Cobertura de redondeo insuficiente: ${fractionalCases} fracciones, ${halfCases} casos .50`);
    }

    await Venta.update({ fecha: FIXED_DATE }, { where: {} });
    await optimizeDatabaseStatistics();
    const generationDuration = performance.now() - startedAt;
    const reconcileStartedAt = performance.now();
    const operationalSales = await requestJson(baseUrl, '/api/ventas');
    assertEqual(operationalSales.length, 40, 'Limite operativo de ventas API');
    const allSales = await Venta.findAll({ include: [{ model: DetalleVenta, as: 'detalles' }] });
    assertEqual(allSales.length, SALE_COUNT, 'Cantidad total de ventas almacenadas');
    const counts = { confirmada: 0, cotizada: 0, anulada: 0 };
    let apiClose = 0;
    let apiDetailClose = 0;

    for (const sale of allSales) {
      counts[sale.estado] += 1;
      const detailTotal = sale.detalles.reduce((sum, detail) => sum + Number(detail.subtotal), 0);
      assertEqual(sale.totalVenta, detailTotal, `Venta ${sale.id}: total frente a detalles finales`);
      if (sale.estado === 'confirmada') {
        apiClose += Number(sale.totalVenta);
        apiDetailClose += detailTotal;
      }
    }

    assertEqual(counts.confirmada, 3500, 'Ventas confirmadas');
    assertEqual(counts.cotizada, 1000, 'Cotizaciones pendientes');
    assertEqual(counts.anulada, 500, 'Ventas anuladas');
    assertEqual(apiClose, expectedClose, 'Cierre API frente al oraculo');
    assertEqual(apiDetailClose, expectedClose, 'Detalles API frente al oraculo');

    const dbSaleClose = await Venta.sum('totalVenta', { where: { estado: 'confirmada' } });
    const [dbDetailResult] = await sequelize.query(
      'SELECT COALESCE(SUM(d.subtotal), 0) AS total FROM detalle_ventas d JOIN ventas v ON v.id = d.Venta_id WHERE v.estado = :status',
      { replacements: { status: 'confirmada' }, type: QueryTypes.SELECT }
    );
    assertEqual(dbSaleClose, expectedClose, 'Cierre SQLite por ventas');
    assertEqual(dbDetailResult.total, expectedClose, 'Cierre SQLite por detalles');

    const storedProducts = await Producto.findAll();
    for (const product of storedProducts) {
      assertEqual(product.stock, expectedStocks.get(product.id), `Stock final producto ${product.id}`);
    }

    const saleMovements = await MovimientoInventario.findAll({
      where: { Venta_id: { [Op.ne]: null } },
      attributes: ['Venta_id', 'DetalleVenta_id', 'tipo_movimiento'],
      raw: true
    });
    const movementsByDetail = new Map();
    for (const movement of saleMovements) {
      const key = `${movement.Venta_id}:${movement.DetalleVenta_id}`;
      const current = movementsByDetail.get(key) || [];
      current.push(movement.tipo_movimiento);
      movementsByDetail.set(key, current);
    }

    const cancelledDetails = await DetalleVenta.findAll({
      where: { Venta_id: { [Op.in]: [...annulledSaleIds] } },
      attributes: ['id', 'Venta_id'],
      raw: true
    });
    for (const detail of cancelledDetails) {
      const types = (movementsByDetail.get(`${detail.Venta_id}:${detail.id}`) || []).sort();
      if (types.join(',') !== 'anulacion,venta') {
        fail(`Detalle anulado ${detail.id}: movimientos ${types.join(',') || 'ausentes'}`);
      }
    }

    const reconcileDuration = performance.now() - reconcileStartedAt;
    const dashboardStartedAt = performance.now();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((expected) => {
      const label = [...document.querySelectorAll('p')].find((node) => node.textContent.trim() === 'Ventas realizadas');
      return label?.parentElement?.querySelector('strong')?.textContent?.replace(/\D/g, '') === String(expected);
    }, counts.confirmada, { timeout: DASHBOARD_LIMIT_MS });

    const dashboardClose = await readDashboardMetric(page, 'Ganancias');
    const dashboardSales = await readDashboardMetric(page, 'Ventas realizadas');
    const dashboardUnits = await readDashboardMetric(page, 'Unidades vendidas');
    const dashboardTicket = await readDashboardMetric(page, 'Ticket medio');
    const expectedTicket = Math.round(expectedClose / counts.confirmada);

    assertEqual(currencyDigits(dashboardClose), expectedClose, 'Dashboard: ganancias');
    assertEqual(currencyDigits(dashboardSales), counts.confirmada, 'Dashboard: ventas realizadas');
    assertEqual(currencyDigits(dashboardUnits), expectedUnits, 'Dashboard: unidades vendidas');
    assertEqual(currencyDigits(dashboardTicket), expectedTicket, 'Dashboard: ticket medio');

    const dashboardDuration = performance.now() - dashboardStartedAt;
    const difference = Number(dbDetailResult.total) - expectedClose;
    console.log('--- Reconciliacion contable aprobada ---');
    console.log(`Semilla: ${SEED}`);
    console.log(`Dia contable: ${FIXED_DATE.toISOString()} (mediodia America/Santiago)`);
    console.log('Ventas: 3500 confirmadas, 1000 cotizadas, 500 anuladas');
    console.log(`Detalles verificados: ${detailCount}`);
    console.log(`Casos con fraccion: ${fractionalCases}; casos exactamente .50: ${halfCases}`);
    console.log(`Cierre esperado/API/SQLite/Dashboard: $${expectedClose}`);
    console.log(`Diferencia final: $${difference}`);
    console.log(`Unidades confirmadas: ${expectedUnits}; ticket promedio: $${expectedTicket}`);
    console.log(`Generacion y verificacion: ${(generationDuration / 1000).toFixed(1)} s`);
    console.log(`Reconciliacion API/SQLite: ${(reconcileDuration / 1000).toFixed(1)} s`);
    console.log(`Carga y validacion Dashboard: ${(dashboardDuration / 1000).toFixed(1)} s`);
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    for (const suffix of ['', '-shm', '-wal']) fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
};

main().catch((error) => {
  console.error(`Reconciliacion contable fallida: ${error.message}`);
  process.exitCode = 1;
});
