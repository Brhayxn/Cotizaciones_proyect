const { sequelize, Producto, MovimientoInventario } = require('../models');
const { Op, Transaction } = require('sequelize');
const { parseLimit, parseSearch, buildMeta, sendQueryError } = require('../utils/operationalQuery');
const { buildFtsIdCondition } = require('../utils/searchIndex');
const { emitStockUpdates } = require('../utils/stockRealtime');
const { acquireDatabaseWriteLock } = require('../utils/databaseWriteLock');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const obtenerResumen = async (_req, res) => {
  try {
    const [productos, stockTotal, stockBajo] = await Promise.all([
      Producto.count(),
      Producto.sum('stock'),
      Producto.count({ where: { stock: { [Op.lte]: 3 } } })
    ]);
    return res.json({
      ok: true,
      data: { productos, stockTotal: Number(stockTotal || 0), stockBajo }
    });
  } catch (error) {
    return sendError(res, 500, 'Error al obtener el resumen de inventario');
  }
};

const listarMovimientos = async (req, res) => {
  try {
    const where = {};
    const limit = parseLimit(req.query.limit);
    const search = parseSearch(req.query.q);
    const productSearchWhere = search
      ? (await buildFtsIdCondition('productos', search)) || { nombre: { [Op.like]: `%${search}%` } }
      : undefined;
    if (req.query.producto) {
      if (!/^\d+$/.test(String(req.query.producto)) || Number(req.query.producto) < 1) {
        return sendError(res, 400, 'El producto debe ser un identificador valido');
      }
      where.Producto_id = Number(req.query.producto);
    }
    if (req.query.tipo) {
      if (!['ajuste', 'venta', 'abastecimiento', 'anulacion'].includes(req.query.tipo)) {
        return sendError(res, 400, 'El tipo de movimiento no es valido');
      }
      where.tipo_movimiento = req.query.tipo;
    }

    const { count, rows } = await MovimientoInventario.findAndCountAll({
      where,
      include: [{
        model: Producto,
        as: 'producto',
        where: productSearchWhere,
        required: Boolean(search)
      }],
      order: [['fecha_hora', 'DESC'], ['id', 'DESC']],
      limit,
      distinct: true
    });

    return res.json({ ok: true, data: rows, meta: buildMeta(count, limit, rows.length) });
  } catch (error) {
    if (sendQueryError(res, error)) return undefined;
    return sendError(res, 500, 'Error al listar movimientos de inventario');
  }
};

const registrarMovimientoManual = async (req, res) => {
  const releaseWriteLock = await acquireDatabaseWriteLock();
  let transaction;

  try {
    transaction = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    const { Producto_id, cantidad, tipo_movimiento } = req.body;

    if (!Producto_id) {
      await transaction.rollback();
      return sendError(res, 400, 'Debe enviar Producto_id');
    }

    if (!Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
      await transaction.rollback();
      return sendError(res, 400, 'La cantidad debe ser mayor a 0');
    }

    if (!['abastecimiento', 'ajuste'].includes(tipo_movimiento)) {
      await transaction.rollback();
      return sendError(res, 400, 'Solo se permiten movimientos manuales de abastecimiento o ajuste');
    }

    const producto = await Producto.findByPk(Producto_id, { transaction });
    if (!producto) {
      await transaction.rollback();
      return sendError(res, 404, 'Producto no encontrado');
    }

    const cantidadMovimiento = Number(cantidad);
    const nuevoStock = tipo_movimiento === 'abastecimiento'
      ? producto.stock + cantidadMovimiento
      : cantidadMovimiento;

    await producto.update({ stock: nuevoStock }, { transaction });
    const movimiento = await MovimientoInventario.create({
      cantidad: cantidadMovimiento,
      tipo_movimiento,
      Producto_id: producto.id
    }, { transaction });

    await transaction.commit();
    await emitStockUpdates(req, [producto.id], tipo_movimiento);
    return res.status(201).json({ ok: true, data: movimiento });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return sendError(res, 500, 'Error al registrar movimiento de inventario');
  } finally {
    releaseWriteLock();
  }
};

module.exports = {
  obtenerResumen,
  listarMovimientos,
  registrarMovimientoManual
};
