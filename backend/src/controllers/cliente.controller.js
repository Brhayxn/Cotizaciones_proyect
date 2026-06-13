const {
  Cliente,
  Producto,
  Cotizacion,
  DetalleCotizacion
} = require('../models');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const listarClientes = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({ order: [['id', 'DESC']] });
    return res.json({ ok: true, data: clientes });
  } catch (error) {
    return sendError(res, 500, 'Error al listar clientes');
  }
};

const obtenerCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return sendError(res, 404, 'Cliente no encontrado');
    return res.json({ ok: true, data: cliente });
  } catch (error) {
    return sendError(res, 500, 'Error al obtener cliente');
  }
};

const listarCotizacionesCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return sendError(res, 404, 'Cliente no encontrado');

    const cotizaciones = await Cotizacion.findAll({
      where: { Cliente_id: cliente.id },
      include: [
        {
          model: DetalleCotizacion,
          as: 'detalles',
          include: [{ model: Producto, as: 'producto' }]
        }
      ],
      order: [['id', 'DESC']]
    });

    return res.json({ ok: true, data: cotizaciones });
  } catch (error) {
    return sendError(res, 500, 'Error al listar cotizaciones del cliente');
  }
};

const crearCliente = async (req, res) => {
  try {
    const { nombre, telefono } = req.body;
    if (!nombre || !nombre.trim()) return sendError(res, 400, 'El nombre del cliente es obligatorio');

    const cliente = await Cliente.create({ nombre: nombre.trim(), telefono });
    return res.status(201).json({ ok: true, data: cliente });
  } catch (error) {
    return sendError(res, 500, 'Error al crear cliente');
  }
};

const actualizarCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return sendError(res, 404, 'Cliente no encontrado');

    const { nombre, telefono } = req.body;
    if (nombre !== undefined && !String(nombre).trim()) {
      return sendError(res, 400, 'El nombre del cliente es obligatorio');
    }

    await cliente.update({
      nombre: nombre !== undefined ? String(nombre).trim() : cliente.nombre,
      telefono: telefono !== undefined ? telefono : cliente.telefono
    });

    return res.json({ ok: true, data: cliente });
  } catch (error) {
    return sendError(res, 500, 'Error al actualizar cliente');
  }
};

const eliminarCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return sendError(res, 404, 'Cliente no encontrado');

    await cliente.destroy();
    return res.json({ ok: true, data: { id: Number(req.params.id) } });
  } catch (error) {
    return sendError(res, 500, 'No se pudo eliminar el cliente');
  }
};

module.exports = {
  listarClientes,
  obtenerCliente,
  listarCotizacionesCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente
};
