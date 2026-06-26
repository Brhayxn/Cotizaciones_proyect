const { Op, QueryTypes, literal } = require('sequelize');
const sequelize = require('../config/database');

const SEARCH_INDEXES = {
  productos: 'productos_fts',
  clientes: 'clientes_fts'
};

const availabilityCache = new Map();

const clearSearchIndexCache = () => availabilityCache.clear();

const hasSearchIndex = async (entity) => {
  const table = SEARCH_INDEXES[entity];
  if (!table) throw new Error(`Indice de busqueda desconocido: ${entity}`);
  if (availabilityCache.has(table)) return availabilityCache.get(table);

  const rows = await sequelize.query(
    "SELECT 1 AS available FROM sqlite_master WHERE type = 'table' AND name = :table LIMIT 1",
    { replacements: { table }, type: QueryTypes.SELECT }
  );
  const available = rows.length > 0;
  availabilityCache.set(table, available);
  return available;
};

const toMatchPhrase = (search) => `"${search.replace(/"/g, '""')}"`;

const buildFtsIdCondition = async (entity, search) => {
  if (search.length < 3 || !(await hasSearchIndex(entity))) return null;

  const table = SEARCH_INDEXES[entity];
  const matchPhrase = sequelize.escape(toMatchPhrase(search));
  return {
    id: {
      [Op.in]: literal(`(SELECT rowid FROM ${table} WHERE ${table} MATCH ${matchPhrase})`)
    }
  };
};

module.exports = {
  buildFtsIdCondition,
  clearSearchIndexCache,
  hasSearchIndex
};
