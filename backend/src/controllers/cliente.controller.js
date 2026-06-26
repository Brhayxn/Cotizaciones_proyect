const {
  Cliente,
  Producto,
  Venta,
  DetalleVenta
} = require('../models');
const { Op } = require('sequelize');
const { parseLimit, parseSearch, buildMeta, sendQueryError } = require('../utils/operationalQuery');
const { buildFtsIdCondition } = require('../utils/searchIndex');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const listarClientes = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const search = parseSearch(req.query.q);
    const ftsCondition = search ? await buildFtsIdCondition('clientes', search) : null;
    const where = search
      ? ftsCondition || {
        [Op.or]: [
          { nombre: { [Op.like]: `%${search}%` } },
          { telefono: { [Op.like]: `%${search}%` } }
        ]
      }
      : {};
    const { count, rows } = await Cliente.findAndCountAll({ where, order: [['id', 'DESC']], limit });
    return res.json({ ok: true, data: rows, meta: buildMeta(count, limit, rows.length) });
  } catch (error) {
    if (sendQueryError(res, error)) return undefined;
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

const listarVentasCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return sendError(res, 404, 'Cliente no encontrado');

    const limit = parseLimit(req.query.limit);
    const query = {
      where: { Cliente_id: cliente.id },
      include: [
        {
          model: DetalleVenta,
          as: 'detalles',
          include: [{ model: Producto, as: 'producto' }]
        }
      ],
      order: [['id', 'DESC']],
      limit
    };
    const [count, rows] = await Promise.all([
      Venta.count({ where: { Cliente_id: cliente.id } }),
      Venta.findAll(query)
    ]);

    return res.json({ ok: true, data: rows, meta: buildMeta(count, limit, rows.length) });
  } catch (error) {
    if (sendQueryError(res, error)) return undefined;
    return sendError(res, 500, 'Error al listar ventas del cliente');
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
  listarVentasCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente
};
