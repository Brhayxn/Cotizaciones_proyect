const {
  sequelize,
  Cliente,
  Producto,
  Venta,
  DetalleVenta,
  MovimientoInventario
} = require('../models');
const { Op, literal, Transaction } = require('sequelize');
const {
  isValidPaymentMethod,
  calculatePaymentTotals
} = require('../utils/payment');
const { parseLimit, buildMeta, sendQueryError } = require('../utils/operationalQuery');
const { emitStockUpdates } = require('../utils/stockRealtime');
const { acquireDatabaseWriteLock } = require('../utils/databaseWriteLock');

const ESTADOS_VENTA = ['cotizada', 'confirmada', 'anulada'];
const CHILE_TIME_ZONE = 'America/Santiago';

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const incluirVentaCompleta = [
  { model: Cliente, as: 'cliente' },
  {
    model: DetalleVenta,
    as: 'detalles',
    include: [{ model: Producto, as: 'producto' }]
  },
  {
    model: MovimientoInventario,
    as: 'movimientosInventario',
    include: [{ model: Producto, as: 'producto' }]
  }
];

const calcularSubtotal = (cantidad, precioUnitario, descuentoAplicado) => {
  const numerador = cantidad * precioUnitario * (100 - descuentoAplicado);
  return Math.floor((numerador + 50) / 100);
};

const validarEstado = (estado) => ESTADOS_VENTA.includes(estado);

const chileDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const chileOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const getTimeZoneOffset = (date) => {
  const parts = Object.fromEntries(
    chileOffsetFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return zonedAsUtc - date.getTime();
};

const getChileStartOfDay = (daysAgo = 0) => {
  const todayParts = Object.fromEntries(
    chileDateFormatter.formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const localTarget = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day - daysAgo);
  const offsetReference = new Date(localTarget + (12 * 60 * 60 * 1000));
  return new Date(localTarget - getTimeZoneOffset(offsetReference));
};

const listarVentasDesde = async (req, res, diasAtras) => {
  try {
    const limit = parseLimit(req.query.limit, { optional: true });
    const query = {
      where: {
        fecha: { [Op.gte]: getChileStartOfDay(diasAtras) }
      },
      include: incluirVentaCompleta,
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    };

    if (!limit) {
      const ventas = await Venta.findAll(query);
      return res.json({ ok: true, data: ventas });
    }

    const [count, rows] = await Promise.all([
      Venta.count({ where: query.where }),
      Venta.findAll({ ...query, limit })
    ]);
    return res.json({ ok: true, data: rows, meta: buildMeta(count, limit, rows.length) });
  } catch (error) {
    if (sendQueryError(res, error)) return undefined;
    return sendError(res, 500, 'Error al listar ventas por periodo');
  }
};

const listarVentasHoy = (req, res) => listarVentasDesde(req, res, 0);
const listarVentasUltimaSemana = (req, res) => listarVentasDesde(req, res, 6);
const listarVentasUltimoMes = (req, res) => listarVentasDesde(req, res, 29);

const obtenerCliente = async ({ cliente, Cliente_id }, transaction) => {
  if (Cliente_id) {
    const clienteExistente = await Cliente.findByPk(Cliente_id, { transaction });
    if (!clienteExistente) throw new Error('CLIENTE_NO_EXISTE');
    return clienteExistente;
  }

  if (!cliente || !cliente.nombre || !String(cliente.nombre).trim()) {
    return null;
  }

  const telefono = cliente.telefono || null;
  const [clienteCreado] = await Cliente.findOrCreate({
    where: {
      nombre: String(cliente.nombre).trim(),
      telefono
    },
    defaults: {
      nombre: String(cliente.nombre).trim(),
      telefono
    },
    transaction
  });

  return clienteCreado;
};

const prepararDetalles = async (items, transaction) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('ITEMS_REQUERIDOS');
  }

  for (const item of items) {
    if (!item.Producto_id) throw new Error('PRODUCTO_REQUERIDO');
    if (!Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
      throw new Error('CANTIDAD_INVALIDA');
    }
    const descuentoAplicado = item.descuento_aplicado === undefined ? 0 : Number(item.descuento_aplicado);
    if (!Number.isInteger(descuentoAplicado) || descuentoAplicado < 0 || descuentoAplicado > 100) {
      throw new Error('DESCUENTO_INVALIDO');
    }
  }

  const idsProductos = [...new Set(items.map((item) => Number(item.Producto_id)))];
  const productos = await Producto.findAll({
    where: { id: idsProductos, activo: true },
    transaction
  });

  if (productos.length !== idsProductos.length) {
    throw new Error('PRODUCTO_NO_DISPONIBLE');
  }

  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

  return items.map((item) => {
    const producto = productosPorId.get(Number(item.Producto_id));
    const cantidad = Number(item.cantidad);
    const descuentoAplicado = item.descuento_aplicado === undefined ? 0 : Number(item.descuento_aplicado);

    if (descuentoAplicado > producto.descuento_maximo) {
      throw new Error('DESCUENTO_SUPERA_MAXIMO');
    }

    const precioUnitario = producto.precio;
    const subtotal = calcularSubtotal(cantidad, precioUnitario, descuentoAplicado);

    return {
      cantidad,
      nombre_producto: producto.nombre,
      precio_unitario: precioUnitario,
      descuento_aplicado: descuentoAplicado,
      subtotal,
      Producto_id: producto.id
    };
  });
};

const confirmarVentaEnTransaccion = async (venta, metodoPago, transaction) => {
  if (!metodoPago) throw new Error('METODO_PAGO_REQUERIDO');
  if (!isValidPaymentMethod(metodoPago)) throw new Error('METODO_PAGO_INVALIDO');

  const ventaConDetalles = await Venta.findByPk(venta.id, {
    include: [{ model: DetalleVenta, as: 'detalles' }],
    transaction
  });

  if (!ventaConDetalles) throw new Error('VENTA_NO_EXISTE');
  if (ventaConDetalles.estado !== 'cotizada') throw new Error('VENTA_NO_CONFIRMABLE');

  for (const detalle of ventaConDetalles.detalles) {
    const producto = await Producto.findByPk(detalle.Producto_id, { transaction });
    if (!producto || !producto.activo) throw new Error('PRODUCTO_NO_DISPONIBLE');
    if (detalle.descuento_aplicado > producto.descuento_maximo) {
      throw new Error('DESCUENTO_SUPERA_MAXIMO');
    }
  }

  for (const detalle of ventaConDetalles.detalles) {
    const [updatedRows] = await Producto.update(
      { stock: literal(`stock - ${Number(detalle.cantidad)}`) },
      {
        where: {
          id: detalle.Producto_id,
          activo: true,
          stock: { [Op.gte]: detalle.cantidad }
        },
        transaction
      }
    );
    if (updatedRows !== 1) throw new Error('STOCK_INSUFICIENTE');
    await MovimientoInventario.create({
      cantidad: detalle.cantidad,
      tipo_movimiento: 'venta',
      Producto_id: detalle.Producto_id,
      Venta_id: ventaConDetalles.id,
      DetalleVenta_id: detalle.id
    }, { transaction });
  }

  const totalSinRedondeo = ventaConDetalles.detalles.reduce(
    (total, detalle) => total + Number(detalle.subtotal || 0),
    0
  );
  const paymentTotals = calculatePaymentTotals(totalSinRedondeo, metodoPago);

  await ventaConDetalles.update({
    estado: 'confirmada',
    metodo_pago: metodoPago,
    total_sin_redondeo: paymentTotals.unroundedTotal,
    ajuste_redondeo: paymentTotals.roundingAdjustment,
    totalVenta: paymentTotals.finalTotal
  }, { transaction });
  return ventaConDetalles;
};

const listarVentas = async (req, res) => {
  try {
    const where = {};
    const limit = parseLimit(req.query.limit);
    if (req.query.estado) {
      if (!validarEstado(req.query.estado)) return sendError(res, 400, 'Estado de venta invalido');
      where.estado = req.query.estado;
    }

    const query = {
      where,
      include: incluirVentaCompleta,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit
    };
    const [count, rows] = await Promise.all([
      Venta.count({ where }),
      Venta.findAll(query)
    ]);
    return res.json({ ok: true, data: rows, meta: buildMeta(count, limit, rows.length) });
  } catch (error) {
    if (sendQueryError(res, error)) return undefined;
    return sendError(res, 500, 'Error al listar ventas');
  }
};

const obtenerVenta = async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id, {
      include: incluirVentaCompleta
    });
    if (!venta) return sendError(res, 404, 'Venta no encontrada');
    return res.json({ ok: true, data: venta });
  } catch (error) {
    return sendError(res, 500, 'Error al obtener venta');
  }
};

const crearVenta = async (req, res) => {
  const releaseWriteLock = await acquireDatabaseWriteLock();
  let transaction;

  try {
    transaction = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    const estado = req.body.estado || 'cotizada';
    if (!['cotizada', 'confirmada'].includes(estado)) {
      await transaction.rollback();
      return sendError(res, 400, 'Una venta nueva solo puede iniciar como cotizada o confirmada');
    }

    const metodoPago = estado === 'confirmada' ? req.body.metodo_pago : null;
    if (estado === 'confirmada' && !metodoPago) throw new Error('METODO_PAGO_REQUERIDO');
    if (metodoPago && !isValidPaymentMethod(metodoPago)) throw new Error('METODO_PAGO_INVALIDO');

    const cliente = await obtenerCliente(req.body, transaction);
    const detalles = await prepararDetalles(req.body.items, transaction);
    const totalSinRedondeo = detalles.reduce((total, item) => total + item.subtotal, 0);

    const venta = await Venta.create({
      totalVenta: totalSinRedondeo,
      total_sin_redondeo: totalSinRedondeo,
      ajuste_redondeo: 0,
      metodo_pago: null,
      estado: 'cotizada',
      Cliente_id: cliente ? cliente.id : null
    }, { transaction });

    await DetalleVenta.bulkCreate(
      detalles.map((detalle) => ({
        ...detalle,
        Venta_id: venta.id
      })),
      { transaction }
    );

    const ventaConfirmada = estado === 'confirmada'
      ? await confirmarVentaEnTransaccion(venta, metodoPago, transaction)
      : null;

    await transaction.commit();

    if (ventaConfirmada) {
      await emitStockUpdates(
        req,
        ventaConfirmada.detalles.map((detalle) => detalle.Producto_id),
        'venta'
      );
    }

    const ventaCompleta = await Venta.findByPk(venta.id, {
      include: incluirVentaCompleta
    });

    return res.status(201).json({ ok: true, data: ventaCompleta });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();

    const mensajes = {
      CLIENTE_NO_EXISTE: 'El cliente indicado no existe',
      ITEMS_REQUERIDOS: 'La venta debe tener al menos un item',
      PRODUCTO_REQUERIDO: 'Cada item debe tener Producto_id',
      CANTIDAD_INVALIDA: 'La cantidad debe ser mayor a 0',
      DESCUENTO_INVALIDO: 'El descuento aplicado debe estar entre 0 y 100',
      PRODUCTO_NO_DISPONIBLE: 'Uno o mas productos no existen o estan inactivos',
      DESCUENTO_SUPERA_MAXIMO: 'El descuento aplicado supera el maximo permitido para un producto',
      STOCK_INSUFICIENTE: 'Stock insuficiente para confirmar la venta',
      METODO_PAGO_REQUERIDO: 'Debes seleccionar un metodo de pago para confirmar la venta',
      METODO_PAGO_INVALIDO: 'El metodo de pago no es valido'
    };

    return sendError(res, mensajes[error.message] ? 400 : 500, mensajes[error.message] || 'Error al crear venta');
  } finally {
    releaseWriteLock();
  }
};

const confirmarVenta = async (req, res) => {
  const releaseWriteLock = await acquireDatabaseWriteLock();
  let transaction;

  try {
    transaction = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    const venta = await Venta.findByPk(req.params.id, { transaction });
    if (!venta) {
      await transaction.rollback();
      return sendError(res, 404, 'Venta no encontrada');
    }

    const ventaConfirmada = await confirmarVentaEnTransaccion(venta, req.body.metodo_pago, transaction);
    await transaction.commit();

    await emitStockUpdates(
      req,
      ventaConfirmada.detalles.map((detalle) => detalle.Producto_id),
      'venta'
    );

    const ventaCompleta = await Venta.findByPk(req.params.id, {
      include: incluirVentaCompleta
    });
    return res.json({ ok: true, data: ventaCompleta });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();

    const mensajes = {
      VENTA_NO_CONFIRMABLE: 'Solo una venta cotizada puede confirmarse',
      PRODUCTO_NO_DISPONIBLE: 'Uno o mas productos no existen o estan inactivos',
      DESCUENTO_SUPERA_MAXIMO: 'El descuento aplicado supera el maximo permitido para un producto',
      STOCK_INSUFICIENTE: 'Stock insuficiente para confirmar la venta',
      METODO_PAGO_REQUERIDO: 'Debes seleccionar un metodo de pago para confirmar la venta',
      METODO_PAGO_INVALIDO: 'El metodo de pago no es valido'
    };

    return sendError(res, mensajes[error.message] ? 400 : 500, mensajes[error.message] || 'Error al confirmar venta');
  } finally {
    releaseWriteLock();
  }
};

const anularVenta = async (req, res) => {
  const releaseWriteLock = await acquireDatabaseWriteLock();
  let transaction;

  try {
    transaction = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    const venta = await Venta.findByPk(req.params.id, {
      include: [{ model: DetalleVenta, as: 'detalles' }],
      transaction
    });

    if (!venta) {
      await transaction.rollback();
      return sendError(res, 404, 'Venta no encontrada');
    }

    if (venta.estado === 'anulada') {
      await transaction.rollback();
      return sendError(res, 400, 'La venta ya esta anulada');
    }

    const restoredProductIds = [];
    if (venta.estado === 'confirmada') {
      for (const detalle of venta.detalles) {
        const producto = await Producto.findByPk(detalle.Producto_id, { transaction });
        if (!producto) throw new Error('PRODUCTO_NO_EXISTE');

        await producto.update({ stock: producto.stock + detalle.cantidad }, { transaction });
        await MovimientoInventario.create({
          cantidad: detalle.cantidad,
          tipo_movimiento: 'anulacion',
          Producto_id: producto.id,
          Venta_id: venta.id,
          DetalleVenta_id: detalle.id
        }, { transaction });
        restoredProductIds.push(producto.id);
      }
    }

    await venta.update({ estado: 'anulada' }, { transaction });
    await transaction.commit();

    await emitStockUpdates(req, restoredProductIds, 'anulacion');

    const ventaCompleta = await Venta.findByPk(req.params.id, {
      include: incluirVentaCompleta
    });
    return res.json({ ok: true, data: ventaCompleta });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return sendError(res, 500, 'Error al anular venta');
  } finally {
    releaseWriteLock();
  }
};

const eliminarVenta = async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id);
    if (!venta) return sendError(res, 404, 'Venta no encontrada');
    if (venta.estado === 'confirmada') {
      return sendError(res, 400, 'No se puede eliminar una venta confirmada; debe anularse');
    }

    await venta.destroy();
    return res.json({ ok: true, data: { id: Number(req.params.id) } });
  } catch (error) {
    return sendError(res, 500, 'Error al eliminar venta');
  }
};

module.exports = {
  listarVentas,
  listarVentasHoy,
  listarVentasUltimaSemana,
  listarVentasUltimoMes,
  obtenerVenta,
  crearVenta,
  confirmarVenta,
  anularVenta,
  eliminarVenta
};
