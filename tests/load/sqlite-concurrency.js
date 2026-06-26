const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const databasePath = path.join(os.tmpdir(), `cotizaciones-sqlite-concurrency-${process.pid}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = databasePath;

const app = require('../../backend/src/app');
const { sequelize, Producto, Venta, MovimientoInventario } = require('../../backend/src/models');
const { seedTestData } = require('../backend/fixtures');
const { createDatabaseOptimizations } = require('../../backend/src/database/optimizations');

const levels = String(process.env.SQLITE_CONCURRENCY_LEVELS || '1,2,4,8,16,32')
  .split(',').map(Number).filter((value) => Number.isInteger(value) && value > 0);
const requestsPerLevel = Number(process.env.SQLITE_REQUESTS_PER_LEVEL || 40);
const targetP95 = Number(process.env.SQLITE_TARGET_P95_MS || 2000);

if (levels.length === 0) throw new Error('SQLITE_CONCURRENCY_LEVELS no contiene niveles validos');
if (!Number.isInteger(requestsPerLevel) || requestsPerLevel < 1) {
  throw new Error('SQLITE_REQUESTS_PER_LEVEL debe ser un entero positivo');
}

console.log('[TEST] Pool max:', sequelize.config.pool?.max);
console.log('[TEST] Pool acquire:', sequelize.config.pool?.acquire);

const percentile = (values, fraction) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] || 0;
};

const runPool = async ({ count, concurrency, request }) => {
  const durations = [];
  const statuses = new Map();
  let successes = 0;
  let nextIndex = 0;
  const startedAt = performance.now();

  const worker = async () => {
    while (nextIndex < count) {
      const index = nextIndex++;
      const requestStartedAt = performance.now();
      try {
        const response = await request(index);
        await response.arrayBuffer();
        durations.push(performance.now() - requestStartedAt);
        statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
        if (response.ok) successes += 1;
      } catch (_error) {
        durations.push(performance.now() - requestStartedAt);
        statuses.set('network', (statuses.get('network') || 0) + 1);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
  const elapsedMs = performance.now() - startedAt;
  return {
    successes,
    failures: count - successes,
    statuses: [...statuses.entries()].map(([status, amount]) => `${status}:${amount}`).join(' '),
    average: durations.reduce((sum, value) => sum + value, 0) / durations.length,
    p95: percentile(durations, 0.95),
    throughput: count / (elapsedMs / 1000)
  };
};

const printResult = (kind, concurrency, result) => {
  console.log(
    `${kind.padEnd(10)} c=${String(concurrency).padStart(2)} | `
    + `${result.successes}/${requestsPerLevel} OK | `
    + `prom ${result.average.toFixed(1)} ms | p95 ${result.p95.toFixed(1)} ms | `
    + `${result.throughput.toFixed(1)} req/s | ${result.statuses}`
  );
};

const removeTemporaryDatabase = async () => {
  const pending = ['', '-shm', '-wal'].map((suffix) => `${databasePath}${suffix}`);

  for (let attempt = 1; attempt <= 10 && pending.length > 0; attempt += 1) {
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      try {
        await fs.promises.rm(pending[index], { force: true });
        pending.splice(index, 1);
      } catch (error) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      }
    }

    if (pending.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }

  if (pending.length > 0) {
    console.warn(`Advertencia: Windows mantuvo bloqueados estos temporales: ${pending.join(', ')}`);
  }
};

const main = async () => {
  await sequelize.sync({ force: true });
  await createDatabaseOptimizations({ resetSearch: true });
  const { producto, cliente } = await seedTestData();
  const initialStock = levels.length * requestsPerLevel + 100;
  await producto.update({ stock: initialStock });

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let successfulWrites = 0;
  let maximumHealthyWriteConcurrency = 0;

  try {
    console.log(`Base temporal: ${databasePath}`);
    console.log(`Solicitudes por nivel: ${requestsPerLevel}; objetivo p95: ${targetP95} ms\n`);

    for (const concurrency of levels) {
      const reads = await runPool({
        count: requestsPerLevel,
        concurrency,
        request: () => fetch(`${baseUrl}/api/productos?activo=true`)
      });
      printResult('LECTURA', concurrency, reads);

      const writes = await runPool({
        count: requestsPerLevel,
        concurrency,
        request: () => fetch(`${baseUrl}/api/ventas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: 'confirmada',
            metodo_pago: 'transferencia',
            Cliente_id: cliente.id,
            items: [{ Producto_id: producto.id, cantidad: 1, descuento_aplicado: 0 }]
          })
        })
      });
      printResult('ESCRITURA', concurrency, writes);
      console.log('');
      successfulWrites += writes.successes;
      if (writes.failures === 0 && writes.p95 <= targetP95) maximumHealthyWriteConcurrency = concurrency;
    }

    const [finalProduct, confirmedSales, saleMovements] = await Promise.all([
      Producto.findByPk(producto.id),
      Venta.count({ where: { estado: 'confirmada' } }),
      MovimientoInventario.count({ where: { Producto_id: producto.id, tipo_movimiento: 'venta' } })
    ]);
    const expectedStock = initialStock - successfulWrites;

    console.log('Resumen');
    console.log(`- Mayor concurrencia de escritura saludable: ${maximumHealthyWriteConcurrency || 'ninguna'}`);
    console.log(`- Escrituras confirmadas: ${successfulWrites}`);
    console.log(`- Stock esperado/real: ${expectedStock}/${finalProduct.stock}`);
    console.log(`- Ventas/movimientos: ${confirmedSales}/${saleMovements}`);

    if (finalProduct.stock !== expectedStock || confirmedSales !== successfulWrites || saleMovements !== successfulWrites) {
      throw new Error('La reconciliacion final detecto una inconsistencia de datos');
    }
    console.log('\nPrueba terminada con consistencia correcta.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    await removeTemporaryDatabase();
  }
};

main().catch((error) => {
  console.error(`Prueba de concurrencia fallida: ${error.message}`);
  process.exitCode = 1;
});
