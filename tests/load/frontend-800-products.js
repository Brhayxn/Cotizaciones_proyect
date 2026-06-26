const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');

const PRODUCT_COUNT = 850;
const API_LIMIT_MS = Number(process.env.CATALOG_API_LIMIT_MS || 2000);
const RENDER_LIMIT_MS = Number(process.env.CATALOG_RENDER_LIMIT_MS || 10000);
const SEARCH_LIMIT_MS = Number(process.env.CATALOG_SEARCH_LIMIT_MS || 1000);
const databasePath = path.join(os.tmpdir(), `cotizaciones-catalog-${process.pid}.sqlite`);

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = databasePath;

const app = require('../../backend/src/app');
const { sequelize, Categoria, Producto } = require('../../backend/src/models');
const {
  createDatabaseOptimizations,
  optimizeDatabaseStatistics
} = require('../../backend/src/database/optimizations');

const assertUnder = (name, duration, limit) => {
  if (duration > limit) {
    throw new Error(`${name}: ${duration.toFixed(1)} ms supera el límite de ${limit} ms`);
  }
};

const seedCatalog = async () => {
  const category = await Categoria.create({ nombre: 'Catálogo masivo' });
  const products = Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const number = String(index + 1).padStart(4, '0');
    return {
      nombre: `Producto carga ${number}`,
      precio: 1000 + index,
      descuento_maximo: index % 21,
      stock: 10 + (index % 40),
      activo: true,
      Categoria_id: category.id
    };
  });
  await Producto.bulkCreate(products);
};

const main = async () => {
  let server;
  let browser;

  try {
    await sequelize.sync({ force: true });
    await createDatabaseOptimizations({ resetSearch: true });
    await seedCatalog();
    await optimizeDatabaseStatistics();

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const apiStartedAt = performance.now();
    const apiResponse = await page.request.get(`${baseUrl}/api/productos?activo=true`);
    const apiDuration = performance.now() - apiStartedAt;
    if (!apiResponse.ok()) throw new Error(`La API respondió HTTP ${apiResponse.status()}`);
    const apiPayload = await apiResponse.json();
    if (apiPayload.data?.length !== 40 || apiPayload.meta?.total !== PRODUCT_COUNT || !apiPayload.meta?.hasMore) {
      throw new Error('La API no aplicó correctamente el límite operativo de 40 productos');
    }

    const renderStartedAt = performance.now();
    await page.goto(`${baseUrl}/productos`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.products-grid .glass-card').length === expected,
      40,
      { timeout: RENDER_LIMIT_MS }
    );
    const renderDuration = performance.now() - renderStartedAt;

    const searchStartedAt = performance.now();
    await page.getByPlaceholder('Nombre del producto').fill('Producto carga 0850');
    await page.waitForFunction(
      () => document.querySelectorAll('.products-grid .glass-card').length === 1,
      undefined,
      { timeout: SEARCH_LIMIT_MS }
    );
    const searchDuration = performance.now() - searchStartedAt;

    assertUnder('Carga de API', apiDuration, API_LIMIT_MS);
    assertUnder('Renderizado inicial de 40 productos', renderDuration, RENDER_LIMIT_MS);
    assertUnder('Búsqueda en catálogo', searchDuration, SEARCH_LIMIT_MS);

    console.log(`API (40 de ${PRODUCT_COUNT} productos): ${apiDuration.toFixed(1)} ms`);
    console.log(`Renderizado (40 tarjetas): ${renderDuration.toFixed(1)} ms`);
    console.log(`Búsqueda hasta 1 resultado: ${searchDuration.toFixed(1)} ms`);
    console.log('Prueba de catálogo masivo aprobada.');
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
  console.error(`Prueba de catálogo masivo fallida: ${error.message}`);
  process.exitCode = 1;
});
