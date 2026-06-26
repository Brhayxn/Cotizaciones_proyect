const os = require('os');
const path = require('path');

// Entorno aislado para todas las pruebas de API.
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(os.tmpdir(), `cotizaciones-api-${process.pid}.sqlite`);
