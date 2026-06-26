const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');

const PRODUCT_COUNT = 850;
const QUOTE_COUNT = 100001;
const CHUNK_SIZE = 2500;
const API_LIMIT_MS = Number(process.env.SCALE_API_LIMIT_MS || 120000);
const CATALOG_LIMIT_MS = Number(process.env.SCALE_CATALOG_LIMIT_MS || 15000);
const DASHBOARD_LIMIT_MS = Number(process.env.SCALE_DASHBOARD_LIMIT_MS || 180000);
const API_TARGET_MS = Number(process.env.SCALE_API_TARGET_MS || 5000);
const DASHBOARD_TARGET_MS = Number(process.env.SCALE_DASHBOARD_TARGET_MS || 10000);
const databasePath = path.join(os.tmpdir(), `cotizaciones-scale-${process.pid}.sqlite`);

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = databasePath;

const app = require('../../backend/src/app');
const {
  sequelize,
  Cliente,
  Categoria,
  Producto,
  Venta,
  DetalleVenta
} = require('../../backend/src/models');
const {
  createDatabaseOptimizations,
  optimizeDatabaseStatistics
} = require('../../backend/src/database/optimizations');

const assertUnder = (name, duration, limit) => {
  if (duration > limit) {
    throw new Error(`${name}: ${duration.toFixed(1)} ms supera el límite de ${limit} ms`);
  }
};

const stateFor = (index) => {
  const bucket = index % 20;
  if (bucket === 0) return 'anulada';
  if (bucket <= 5) return 'confirmada';
  return 'cotizada';
};

const seedScaleData = async () => {
  const startedAt = performance.now();
  const category = await Categoria.create({ nombre: 'Escala masiva' });
  const client = await Cliente.create({ nombre: 'Cliente benchmark', telefono: '900000000' });

  const products = Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const number = String(index + 1).padStart(4, '0');
    return {
      nombre: `Producto escala ${number}`,
      precio: 1000 + index,
      descuento_maximo: index % 21,
      stock: 1000000,
      activo: true,
      Categoria_id: category.id
    };
  });
  await Producto.bulkCreate(products, { validate: false });

  const firstProductId = (await Producto.min('id')) || 1;
  const now = Date.now();

  await sequelize.transaction(async (transaction) => {
    for (let start = 0; start < QUOTE_COUNT; start += CHUNK_SIZE) {
      const size = Math.min(CHUNK_SIZE, QUOTE_COUNT - start);
      const sales = Array.from({ length: size }, (_, offset) => {
        const index = start + offset;
        return {
          totalVenta: 1000 + (index % PRODUCT_COUNT),
          fecha: new Date(now - (index % 30) * 86400000 - (index % 24) * 3600000),
          estado: stateFor(index),
          Cliente_id: client.id,
          createdAt: new Date(now - (index % 30) * 86400000),
          updatedAt: new Date(now - (index % 30) * 86400000)
        };
      });
      await Venta.bulkCreate(sales, { validate: false, transaction });
    }

    for (let start = 0; start < QUOTE_COUNT; start += CHUNK_SIZE) {
      const size = Math.min(CHUNK_SIZE, QUOTE_COUNT - start);
      const details = Array.from({ length: size }, (_, offset) => {
        const index = start + offset;
        const productOffset = index % PRODUCT_COUNT;
        const price = 1000 + productOffset;
        return {
          cantidad: 1,
          nombre_producto: `Producto escala ${String(productOffset + 1).padStart(4, '0')}`,
          precio_unitario: price,
          subtotal: price,
          descuento_aplicado: 0,
          Venta_id: index + 1,
          Producto_id: firstProductId + productOffset,
          createdAt: new Date(now),
          updatedAt: new Date(now)
        };
      });
      await DetalleVenta.bulkCreate(details, { validate: false, transaction });
    }
  });

  return performance.now() - startedAt;
};

const main = async () => {
  let server;
  let browser;

  try {
    await sequelize.sync({ force: true });
    await createDatabaseOptimizations({ resetSearch: true });
    const seedDuration = await seedScaleData();
    await optimizeDatabaseStatistics();

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const apiStartedAt = performance.now();
    const salesResponse = await context.request.get(`${baseUrl}/api/ventas`, { timeout: API_LIMIT_MS });
    const apiDuration = performance.now() - apiStartedAt;
    if (!salesResponse.ok()) throw new Error(`Ventas respondió HTTP ${salesResponse.status()}`);
    const salesPayload = await salesResponse.json();
    if (salesPayload.data?.length !== 40 || salesPayload.meta?.total !== QUOTE_COUNT || !salesPayload.meta?.hasMore) {
      throw new Error('Ventas no aplicó correctamente el límite operativo de 40 registros');
    }
    assertUnder('API de 100.001 cotizaciones', apiDuration, API_LIMIT_MS);

    const catalogStartedAt = performance.now();
    await page.goto(`${baseUrl}/productos`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.products-grid .glass-card').length === expected,
      40,
      { timeout: CATALOG_LIMIT_MS }
    );
    const catalogDuration = performance.now() - catalogStartedAt;
    assertUnder('Catálogo limitado a 40 productos', catalogDuration, CATALOG_LIMIT_MS);

    const dashboardStartedAt = performance.now();
    const dashboardResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/ventas/ultima-semana') && response.ok(),
      { timeout: DASHBOARD_LIMIT_MS }
    );
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    const dashboardResponse = await dashboardResponsePromise;
    const dashboardPayload = await dashboardResponse.json();
    const expectedConfirmedSales = (dashboardPayload.data || [])
      .filter((sale) => sale.estado === 'confirmada')
      .length;

    if (expectedConfirmedSales === 0) {
      throw new Error('La semana sembrada no contiene ventas confirmadas');
    }

    await page.waitForFunction((expected) => {
      const label = [...document.querySelectorAll('p')].find((element) => element.textContent === 'Ventas realizadas');
      const value = label?.parentElement?.querySelector('strong')?.textContent || '';
      return Number(value.replace(/\D/g, '')) === expected;
    }, expectedConfirmedSales, { timeout: DASHBOARD_LIMIT_MS });
    const dashboardDuration = performance.now() - dashboardStartedAt;
    assertUnder('Dashboard con 100.001 cotizaciones', dashboardDuration, DASHBOARD_LIMIT_MS);

    console.log(`Siembra: ${PRODUCT_COUNT} productos + ${QUOTE_COUNT} cotizaciones/detalles en ${(seedDuration / 1000).toFixed(1)} s`);
    console.log(`API de ventas (40 de ${QUOTE_COUNT}): ${(apiDuration / 1000).toFixed(1)} s`);
    console.log(`Catálogo (40 de ${PRODUCT_COUNT} tarjetas): ${catalogDuration.toFixed(1)} ms`);
    console.log(`Dashboard y analítica: ${(dashboardDuration / 1000).toFixed(1)} s`);

    const warnings = [];
    if (apiDuration > API_TARGET_MS) warnings.push(`API supera el objetivo de ${API_TARGET_MS / 1000} s`);
    if (dashboardDuration > DASHBOARD_TARGET_MS) warnings.push(`Dashboard supera el objetivo de ${DASHBOARD_TARGET_MS / 1000} s`);

    if (warnings.length > 0) {
      console.warn(`Benchmark funcional con advertencias: ${warnings.join('; ')}.`);
    } else {
      console.log('Benchmark de 100.000+ cotizaciones aprobado sin advertencias.');
    }
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    for (const suffix of ['', '-shm', '-wal']) {
      fs.rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }
};

main().catch((error) => {
  console.error(`Benchmark de escala fallido: ${error.message}`);
  process.exitCode = 1;
});
