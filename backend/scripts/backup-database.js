const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const env = require('../src/config/env');

const backupDir = env.databaseBackupDir;
const retentionDays = Math.max(0, Number(process.env.DATABASE_BACKUP_RETENTION_DAYS) || 7);
const pad = (value) => String(value).padStart(2, '0');
const now = new Date();
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const temporaryPath = path.join(backupDir, `.database-${timestamp}.tmp.sqlite`);
const backupPath = path.join(backupDir, `database-${timestamp}.sqlite`);
const escapePath = (value) => value.replaceAll("'", "''");

const openDatabase = (filename, mode) => new Promise((resolve, reject) => {
  const database = new sqlite3.Database(filename, mode, (error) => {
    if (error) reject(error);
    else resolve(database);
  });
});

const closeDatabase = (database) => new Promise((resolve, reject) => {
  database.close((error) => error ? reject(error) : resolve());
});

const execute = (database, sql) => new Promise((resolve, reject) => {
  database.exec(sql, (error) => error ? reject(error) : resolve());
});

const get = (database, sql) => new Promise((resolve, reject) => {
  database.get(sql, (error, row) => error ? reject(error) : resolve(row));
});

const removeExpiredBackups = () => {
  if (retentionDays === 0) return;
  const expiration = Date.now() - retentionDays * 86400000;

  for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^database-.*\.sqlite$/.test(entry.name)) continue;
    const filename = path.join(backupDir, entry.name);
    if (fs.statSync(filename).mtimeMs < expiration) fs.unlinkSync(filename);
  }
};

const run = async () => {
  fs.mkdirSync(backupDir, { recursive: true });
  if (!fs.existsSync(env.databasePath)) throw new Error(`No existe la base: ${env.databasePath}`);

  let source;
  let backup;

  try {
    source = await openDatabase(env.databasePath, sqlite3.OPEN_READWRITE);
    source.configure('busyTimeout', env.sqliteBusyTimeout);
    await execute(source, `VACUUM INTO '${escapePath(temporaryPath)}'`);
    await closeDatabase(source);
    source = null;

    backup = await openDatabase(temporaryPath, sqlite3.OPEN_READONLY);
    const integrity = await get(backup, 'PRAGMA integrity_check');
    await closeDatabase(backup);
    backup = null;

    if (Object.values(integrity || {})[0] !== 'ok') throw new Error('El respaldo no supero la verificacion de integridad');

    fs.renameSync(temporaryPath, backupPath);
    removeExpiredBackups();
    console.log(`Respaldo creado correctamente:\n${backupPath}`);
  } catch (error) {
    if (source) await closeDatabase(source).catch(() => {});
    if (backup) await closeDatabase(backup).catch(() => {});
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
};

run().catch((error) => {
  console.error('Error al crear respaldo:', error.message);
  process.exit(1);
});
