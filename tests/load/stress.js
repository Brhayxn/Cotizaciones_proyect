const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const databasePath = path.join(os.tmpdir(), `cotizaciones-stress-${process.pid}.sqlite`);

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = databasePath;

const app = require('../../backend/src/app');
const { sequelize } = require('../../backend/src/models');
const { seedTestData } = require('../backend/fixtures');
const { createDatabaseOptimizations } = require('../../backend/src/database/optimizations');

const percentile = (values, value) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * value) - 1)] || 0;
};

const runPool = async ({ count, concurrency, request }) => {
  const durations = [];
  const failures = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < count) {
      const index = nextIndex;
      nextIndex += 1;
      const startedAt = performance.now();

      try {
        const response = await request(index);
        durations.push(performance.now() - startedAt);
        if (!response.ok) failures.push({ index, status: response.status });
        await response.arrayBuffer();
      } catch (error) {
        durations.push(performance.now() - startedAt);
        failures.push({ index, message: error.message });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { durations, failures };
};

const assertResult = (name, result, maximumP95 = 2000) => {
  const p95 = percentile(result.durations, 0.95);
  const average = result.durations.reduce((sum, duration) => sum + duration, 0) / result.durations.length;

  console.log(`${name}: ${result.durations.length} solicitudes, promedio ${average.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);

  if (result.failures.length > 0) {
    throw new Error(`${name}: ${result.failures.length} solicitudes fallaron`);
  }
  if (p95 > maximumP95) {
    throw new Error(`${name}: p95 ${p95.toFixed(1)} ms supera el límite de ${maximumP95} ms`);
  }
};

const main = async () => {
  await sequelize.sync({ force: true });
  await createDatabaseOptimizations({ resetSearch: true });
  const { producto } = await seedTestData();
  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const reads = await runPool({
      count: 300,
      concurrency: 25,
      request: (index) => fetch(index % 2 === 0 ? `${baseUrl}/api/health` : `${baseUrl}/api/productos?activo=true`)
    });
    assertResult('Lecturas concurrentes', reads);

    const quotes = await runPool({
      count: 25,
      concurrency: 1,
      request: (index) => fetch(`${baseUrl}/api/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: { nombre: `Cliente carga ${index}`, telefono: `9000${String(index).padStart(4, '0')}` },
          items: [{ Producto_id: producto.id, cantidad: 1, descuento_aplicado: 0 }]
        })
      })
    });
    assertResult('Cotizaciones sostenidas', quotes);

    console.log('Prueba de estrés simple aprobada.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    for (const suffix of ['', '-shm', '-wal']) {
      fs.rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }
};

main().catch((error) => {
  console.error(`Prueba de estrés fallida: ${error.message}`);
  process.exitCode = 1;
});
