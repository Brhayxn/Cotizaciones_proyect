const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });

const parsePort = (value) => {
  const port = Number(value || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un numero entero entre 1 y 65535');
  }

  return port;
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === 'true';
};

const parseNonNegativeInteger = (value, defaultValue, name) => {
  const number = Number(value === undefined ? defaultValue : value);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${name} debe ser un numero entero mayor o igual a 0`);
  }

  return number;
};

const parseJournalMode = (value) => {
  const mode = String(value || 'WAL').toUpperCase();
  const validModes = ['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF'];

  if (!validModes.includes(mode)) {
    throw new Error(`SQLITE_JOURNAL_MODE debe ser uno de: ${validModes.join(', ')}`);
  }

  return mode;
};

const parseOrigins = (value) => {
  if (!value || value.trim() === '*') return '*';
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const resolveFromBackend = (value, defaultPath) => {
  const selectedPath = value || defaultPath;
  return path.isAbsolute(selectedPath)
    ? selectedPath
    : path.resolve(backendRoot, selectedPath);
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: parsePort(process.env.PORT),
  databasePath: resolveFromBackend(
    process.env.DATABASE_PATH,
    './database/database.sqlite'
  ),
  databaseLogging: parseBoolean(process.env.DATABASE_LOGGING),
  sqliteJournalMode: parseJournalMode(process.env.SQLITE_JOURNAL_MODE),
  sqliteBusyTimeout: parseNonNegativeInteger(
    process.env.SQLITE_BUSY_TIMEOUT,
    5000,
    'SQLITE_BUSY_TIMEOUT'
  ),
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN),
  socketCorsOrigin: parseOrigins(
    process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN
  ),
  frontendDistPath: resolveFromBackend(
    process.env.FRONTEND_DIST_PATH,
    '../frontend/dist'
  ),
  databaseBackupDir: resolveFromBackend(
    process.env.DATABASE_BACKUP_DIR,
    './backups/database'
  )
};

if (env.nodeEnv === 'test' && !process.env.DATABASE_PATH) {
  throw new Error('DATABASE_PATH es obligatorio cuando NODE_ENV=test');
}

module.exports = env;
