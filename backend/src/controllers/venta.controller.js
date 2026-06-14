const {
  sequelize,
  Cliente,
  Producto,
  Venta,
  DetalleVenta,
  MovimientoInventario
} = require('../models');

const ESTADOS_VENTA = ['cotizada', 'confirmada', 'anulada'];

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
  return Math.round(cantidad * precioUnitario * ((100 - descuentoAplicado) / 100));
};

const validarEstado = (estado) => ESTADOS_VENTA.includes(estado);

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

const confirmarVentaEnTransaccion = async (venta, transaction) => {
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
    if (producto.stock < detalle.cantidad) throw new Error('STOCK_INSUFICIENTE');
  }

  for (const detalle of ventaConDetalles.detalles) {
    const producto = await Producto.findByPk(detalle.Producto_id, { transaction });
    await producto.update({ stock: producto.stock - detalle.cantidad }, { transaction });
    await MovimientoInventario.create({
      cantidad: detalle.cantidad,
      tipo_movimiento: 'venta',
      Producto_id: producto.id,
      Venta_id: ventaConDetalles.id,
      DetalleVenta_id: detalle.id
    }, { transaction });
  }

  await ventaConDetalles.update({ estado: 'confirmada' }, { transaction });
  return ventaConDetalles;
};

const listarVentas = async (req, res) => {
  try {
    const where = {};
    if (req.query.estado) {
      if (!validarEstado(req.query.estado)) return sendError(res, 400, 'Estado de venta invalido');
      where.estado = req.query.estado;
    }

    const ventas = await Venta.findAll({
      where,
      include: incluirVentaCompleta,
      order: [['id', 'DESC']]
    });
    return res.json({ ok: true, data: ventas });
  } catch (error) {
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
  const transaction = await sequelize.transaction();

  try {
    const estado = req.body.estado || 'cotizada';
    if (!['cotizada', 'confirmada'].includes(estado)) {
      await transaction.rollback();
      return sendError(res, 400, 'Una venta nueva solo puede iniciar como cotizada o confirmada');
    }

    const cliente = await obtenerCliente(req.body, transaction);
    const detalles = await prepararDetalles(req.body.items, transaction);
    const totalVenta = detalles.reduce((total, item) => total + item.subtotal, 0);

    const venta = await Venta.create({
      totalVenta,
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

    if (estado === 'confirmada') {
      await confirmarVentaEnTransaccion(venta, transaction);
    }

    await transaction.commit();

    const ventaCompleta = await Venta.findByPk(venta.id, {
      include: incluirVentaCompleta
    });

    return res.status(201).json({ ok: true, data: ventaCompleta });
  } catch (error) {
    await transaction.rollback();

    const mensajes = {
      CLIENTE_NO_EXISTE: 'El cliente indicado no existe',
      ITEMS_REQUERIDOS: 'La venta debe tener al menos un item',
      PRODUCTO_REQUERIDO: 'Cada item debe tener Producto_id',
      CANTIDAD_INVALIDA: 'La cantidad debe ser mayor a 0',
      DESCUENTO_INVALIDO: 'El descuento aplicado debe estar entre 0 y 100',
      PRODUCTO_NO_DISPONIBLE: 'Uno o mas productos no existen o estan inactivos',
      DESCUENTO_SUPERA_MAXIMO: 'El descuento aplicado supera el maximo permitido para un producto',
      STOCK_INSUFICIENTE: 'Stock insuficiente para confirmar la venta'
    };

    return sendError(res, mensajes[error.message] ? 400 : 500, mensajes[error.message] || 'Error al crear venta');
  }
};

const confirmarVenta = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const venta = await Venta.findByPk(req.params.id, { transaction });
    if (!venta) {
      await transaction.rollback();
      return sendError(res, 404, 'Venta no encontrada');
    }

    await confirmarVentaEnTransaccion(venta, transaction);
    await transaction.commit();

    const ventaCompleta = await Venta.findByPk(req.params.id, {
      include: incluirVentaCompleta
    });
    return res.json({ ok: true, data: ventaCompleta });
  } catch (error) {
    await transaction.rollback();

    const mensajes = {
      VENTA_NO_CONFIRMABLE: 'Solo una venta cotizada puede confirmarse',
      PRODUCTO_NO_DISPONIBLE: 'Uno o mas productos no existen o estan inactivos',
      DESCUENTO_SUPERA_MAXIMO: 'El descuento aplicado supera el maximo permitido para un producto',
      STOCK_INSUFICIENTE: 'Stock insuficiente para confirmar la venta'
    };

    return sendError(res, mensajes[error.message] ? 400 : 500, mensajes[error.message] || 'Error al confirmar venta');
  }
};

const anularVenta = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
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
      }
    }

    await venta.update({ estado: 'anulada' }, { transaction });
    await transaction.commit();

    const ventaCompleta = await Venta.findByPk(req.params.id, {
      include: incluirVentaCompleta
    });
    return res.json({ ok: true, data: ventaCompleta });
  } catch (error) {
    await transaction.rollback();
    return sendError(res, 500, 'Error al anular venta');
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
  obtenerVenta,
  crearVenta,
  confirmarVenta,
  anularVenta,
  eliminarVenta
};
