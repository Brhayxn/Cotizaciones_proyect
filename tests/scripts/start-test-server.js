const fs = require('fs');
const path = require('path');

const testDatabasePath = path.resolve(__dirname, '../../backend/database/test-e2e.sqlite');
const productionDatabasePath = path.resolve(__dirname, '../../backend/database/database.sqlite');

if (testDatabasePath === productionDatabasePath) {
  throw new Error('La base E2E no puede ser la base de producción');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = testDatabasePath;
process.env.PORT = process.env.PORT || '3100';
process.env.HOST = '127.0.0.1';

for (const suffix of ['', '-shm', '-wal']) {
  fs.rmSync(`${testDatabasePath}${suffix}`, { force: true });
}

const { sequelize } = require('../../backend/src/models');
const { createDatabaseOptimizations } = require('../../backend/src/database/optimizations');
const { seedTestData } = require('../backend/fixtures');

const start = async () => {
  await sequelize.sync({ force: true });
  await createDatabaseOptimizations({ resetSearch: true });
  await seedTestData();
  require('../../backend/server');
};

start().catch((error) => {
  console.error('No se pudo iniciar el servidor E2E:', error);
  process.exit(1);
});
