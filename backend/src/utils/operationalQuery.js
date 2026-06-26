const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 40;
const MAX_SEARCH_LENGTH = 100;

const parseLimit = (value, { optional = false } = {}) => {
  if (value === undefined || value === '') return optional ? undefined : DEFAULT_LIMIT;
  if (!/^\d+$/.test(String(value))) throw new Error('LIMIT_INVALIDO');

  const limit = Number(value);
  if (limit < 1 || limit > MAX_LIMIT) throw new Error('LIMIT_INVALIDO');
  return limit;
};

const parseSearch = (value) => {
  if (value === undefined) return '';
  const search = String(value).trim();
  if (search.length > MAX_SEARCH_LENGTH) throw new Error('BUSQUEDA_INVALIDA');
  return search;
};

const buildMeta = (total, limit, count) => ({
  limit,
  total,
  hasMore: total > count
});

const sendQueryError = (res, error) => {
  if (error.message === 'LIMIT_INVALIDO') {
    res.status(400).json({ ok: false, message: 'El limite debe ser un entero entre 1 y 40' });
    return true;
  }
  if (error.message === 'BUSQUEDA_INVALIDA') {
    res.status(400).json({ ok: false, message: 'La busqueda no puede superar 100 caracteres' });
    return true;
  }
  return false;
};

module.exports = { parseLimit, parseSearch, buildMeta, sendQueryError };
