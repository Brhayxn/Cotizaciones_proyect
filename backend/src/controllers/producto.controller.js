const { sequelize, Producto, Categoria, MovimientoInventario } = require('../models');
const { Op } = require('sequelize');
const { parseLimit, parseSearch, buildMeta, sendQueryError } = require('../utils/operationalQuery');
const { buildFtsIdCondition } = require('../utils/searchIndex');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const normalizarActivo = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === true || valor === 'true' || valor === '1' || valor === 1) return true;
  if (valor === false || valor === 'false' || valor === '0' || valor === 0) return false;
  return null;
};

const validarProducto = ({ nombre, precio, descuento_maximo, stock }) => {
  if (!nombre || !String(nombre).trim()) return 'El nombre del producto es obligatorio';
  if (!Number.isInteger(Number(precio)) || Number(precio) <= 0) {
    return 'El precio del producto debe ser mayor a 0';
  }
  if (descuento_maximo !== undefined && (!Number.isInteger(Number(descuento_maximo)) || Number(descuento_maximo) < 0 || Number(descuento_maximo) > 100)) {
    return 'El descuento maximo debe estar entre 0 y 100';
  }
  if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
    return 'El stock debe ser mayor o igual a 0';
  }
  return null;
};

const listarProductos = async (req, res) => {
  try {
    const where = {};
    const limit = parseLimit(req.query.limit);
    const search = parseSearch(req.query.q);

    if (search) {
      const ftsCondition = await buildFtsIdCondition('productos', search);
      Object.assign(where, ftsCondition || { nombre: { [Op.like]: `%${search}%` } });
    }

    if (req.query.categoria) {
      if (!/^\d+$/.test(String(req.query.categoria)) || Number(req.query.categoria) < 1) {
        return sendError(res, 400, 'La categoria debe ser un identificador valido');
      }
      where.Categoria_id = Number(req.query.categoria);
    }

    const activo = normalizarActivo(req.query.activo);
    if (activo === null) return sendError(res, 400, 'El filtro activo debe ser true o false');
    if (activo !== undefined) where.activo = activo;

    const { count, rows } = await Producto.findAndCountAll({
      where,
      include: [{ model: Categoria, as: 'categoria' }],
      order: [['id', 'DESC']],
      limit,
      distinct: true
    });

    return res.json({ ok: true, data: rows, meta: buildMeta(count, limit, rows.length) });
  } catch (error) {
    if (sendQueryError(res, error)) return undefined;
    return sendError(res, 500, 'Error al listar productos');
  }
};

const obtenerProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id, {
      include: [{ model: Categoria, as: 'categoria' }]
    });
    if (!producto) return sendError(res, 404, 'Producto no encontrado');
    return res.json({ ok: true, data: producto });
  } catch (error) {
    return sendError(res, 500, 'Error al obtener producto');
  }
};

const crearProducto = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { nombre, precio, descuento_maximo, stock, activo, Categoria_id } = req.body;
    const errorValidacion = validarProducto({ nombre, precio, descuento_maximo, stock });
    if (errorValidacion) {
      await transaction.rollback();
      return sendError(res, 400, errorValidacion);
    }

    const estadoActivo = normalizarActivo(activo);
    if (estadoActivo === null) {
      await transaction.rollback();
      return sendError(res, 400, 'El estado activo debe ser true o false');
    }

    if (Categoria_id) {
      const categoria = await Categoria.findByPk(Categoria_id, { transaction });
      if (!categoria) {
        await transaction.rollback();
        return sendError(res, 400, 'La categoria indicada no existe');
      }
    }

    const producto = await Producto.create({
      nombre: String(nombre).trim(),
      precio: Number(precio),
      descuento_maximo: descuento_maximo !== undefined ? Number(descuento_maximo) : 0,
      stock: stock !== undefined ? Number(stock) : 0,
      activo: estadoActivo !== undefined ? estadoActivo : true,
      Categoria_id: Categoria_id || null
    }, { transaction });

    if (producto.stock > 0) {
      await MovimientoInventario.create({
        cantidad: producto.stock,
        tipo_movimiento: 'abastecimiento',
        Producto_id: producto.id
      }, { transaction });
    }

    await transaction.commit();
    return res.status(201).json({ ok: true, data: producto });
  } catch (error) {
    await transaction.rollback();
    return sendError(res, 500, 'Error al crear producto');
  }
};

const actualizarProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return sendError(res, 404, 'Producto no encontrado');

    const nombre = req.body.nombre !== undefined ? req.body.nombre : producto.nombre;
    const precio = req.body.precio !== undefined ? req.body.precio : producto.precio;
    const descuento_maximo = req.body.descuento_maximo !== undefined ? req.body.descuento_maximo : producto.descuento_maximo;
    const stock = req.body.stock !== undefined ? req.body.stock : producto.stock;
    const errorValidacion = validarProducto({ nombre, precio, descuento_maximo, stock });
    if (errorValidacion) return sendError(res, 400, errorValidacion);

    if (req.body.Categoria_id) {
      const categoria = await Categoria.findByPk(req.body.Categoria_id);
      if (!categoria) return sendError(res, 400, 'La categoria indicada no existe');
    }

    const activo = normalizarActivo(req.body.activo);
    if (activo === null) return sendError(res, 400, 'El estado activo debe ser true o false');

    await producto.update({
      nombre: String(nombre).trim(),
      precio: Number(precio),
      descuento_maximo: Number(descuento_maximo),
      stock: Number(stock),
      activo: activo !== undefined ? activo : producto.activo,
      Categoria_id: req.body.Categoria_id !== undefined ? req.body.Categoria_id : producto.Categoria_id
    });

    return res.json({ ok: true, data: producto });
  } catch (error) {
    return sendError(res, 500, 'Error al actualizar producto');
  }
};

const eliminarProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return sendError(res, 404, 'Producto no encontrado');

    await producto.update({ activo: false });
    return res.json({ ok: true, data: producto });
  } catch (error) {
    return sendError(res, 500, 'Error al desactivar producto');
  }
};

const cambiarEstadoProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return sendError(res, 404, 'Producto no encontrado');

    const activo = normalizarActivo(req.body.activo);
    if (activo === null || activo === undefined) {
      return sendError(res, 400, 'Debe enviar activo como true o false');
    }

    await producto.update({ activo });
    return res.json({ ok: true, data: producto });
  } catch (error) {
    return sendError(res, 500, 'Error al cambiar estado del producto');
  }
};

module.exports = {
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  cambiarEstadoProducto
};
