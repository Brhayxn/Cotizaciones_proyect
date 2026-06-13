const {
  sequelize,
  Cliente,
  Producto,
  Cotizacion,
  DetalleCotizacion
} = require('../models');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const incluirCotizacionCompleta = [
  { model: Cliente, as: 'cliente' },
  {
    model: DetalleCotizacion,
    as: 'detalles',
    include: [{ model: Producto, as: 'producto' }]
  }
];

const listarCotizaciones = async (req, res) => {
  try {
    const cotizaciones = await Cotizacion.findAll({
      include: incluirCotizacionCompleta,
      order: [['id', 'DESC']]
    });
    return res.json({ ok: true, data: cotizaciones });
  } catch (error) {
    return sendError(res, 500, 'Error al listar cotizaciones');
  }
};

const obtenerCotizacion = async (req, res) => {
  try {
    const cotizacion = await Cotizacion.findByPk(req.params.id, {
      include: incluirCotizacionCompleta
    });
    if (!cotizacion) return sendError(res, 404, 'Cotizacion no encontrada');
    return res.json({ ok: true, data: cotizacion });
  } catch (error) {
    return sendError(res, 500, 'Error al obtener cotizacion');
  }
};

const crearCotizacion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { cliente, items } = req.body;

    if (!cliente || !cliente.nombre || !String(cliente.nombre).trim()) {
      await transaction.rollback();
      return sendError(res, 400, 'El cliente es obligatorio');
    }

    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return sendError(res, 400, 'La cotizacion debe tener al menos un item');
    }

    for (const item of items) {
      if (!item.Producto_id) {
        await transaction.rollback();
        return sendError(res, 400, 'Cada item debe tener Producto_id');
      }
      if (!Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        await transaction.rollback();
        return sendError(res, 400, 'La cantidad debe ser mayor a 0');
      }
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

    const idsProductos = [...new Set(items.map((item) => Number(item.Producto_id)))];
    const productos = await Producto.findAll({
      where: { id: idsProductos, activo: true },
      transaction
    });

    if (productos.length !== idsProductos.length) {
      await transaction.rollback();
      return sendError(res, 400, 'Uno o mas productos no existen o estan inactivos');
    }

    const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
    const detalles = items.map((item) => {
      const producto = productosPorId.get(Number(item.Producto_id));
      const cantidad = Number(item.cantidad);
      const precioUnitario = producto.precio;
      const subtotal = cantidad * precioUnitario;

      return {
        cantidad,
        nombre_producto: producto.nombre,
        precio_unitario: precioUnitario,
        subtotal,
        Producto_id: producto.id
      };
    });

    const totalCotizacion = detalles.reduce((total, item) => total + item.subtotal, 0);

    const cotizacion = await Cotizacion.create({
      totalCotizacion,
      Cliente_id: clienteCreado.id
    }, { transaction });

    await DetalleCotizacion.bulkCreate(
      detalles.map((detalle) => ({
        ...detalle,
        Cotizacion_id: cotizacion.id
      })),
      { transaction }
    );

    await transaction.commit();

    const cotizacionCompleta = await Cotizacion.findByPk(cotizacion.id, {
      include: incluirCotizacionCompleta
    });

    return res.status(201).json({ ok: true, data: cotizacionCompleta });
  } catch (error) {
    await transaction.rollback();
    return sendError(res, 500, 'Error al crear cotizacion');
  }
};

const eliminarCotizacion = async (req, res) => {
  try {
    const cotizacion = await Cotizacion.findByPk(req.params.id);
    if (!cotizacion) return sendError(res, 404, 'Cotizacion no encontrada');

    await cotizacion.destroy();
    return res.json({ ok: true, data: { id: Number(req.params.id) } });
  } catch (error) {
    return sendError(res, 500, 'Error al eliminar cotizacion');
  }
};

module.exports = {
  listarCotizaciones,
  obtenerCotizacion,
  crearCotizacion,
  eliminarCotizacion
};
