const { Categoria, Producto } = require('../models');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const listarCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });
    return res.json({ ok: true, data: categorias });
  } catch (error) {
    return sendError(res, 500, 'Error al listar categorias');
  }
};

const obtenerCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id, {
      include: [{ model: Producto, as: 'productos' }]
    });
    if (!categoria) return sendError(res, 404, 'Categoria no encontrada');
    return res.json({ ok: true, data: categoria });
  } catch (error) {
    return sendError(res, 500, 'Error al obtener categoria');
  }
};

const crearCategoria = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return sendError(res, 400, 'El nombre de la categoria es obligatorio');

    const categoria = await Categoria.create({ nombre: nombre.trim() });
    return res.status(201).json({ ok: true, data: categoria });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, 400, 'Ya existe una categoria con ese nombre');
    }
    return sendError(res, 500, 'Error al crear categoria');
  }
};

const actualizarCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id);
    if (!categoria) return sendError(res, 404, 'Categoria no encontrada');

    const { nombre } = req.body;
    if (nombre !== undefined && !String(nombre).trim()) {
      return sendError(res, 400, 'El nombre de la categoria es obligatorio');
    }

    await categoria.update({
      nombre: nombre !== undefined ? String(nombre).trim() : categoria.nombre
    });

    return res.json({ ok: true, data: categoria });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, 400, 'Ya existe una categoria con ese nombre');
    }
    return sendError(res, 500, 'Error al actualizar categoria');
  }
};

const eliminarCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id);
    if (!categoria) return sendError(res, 404, 'Categoria no encontrada');

    await categoria.destroy();
    return res.json({ ok: true, data: { id: Number(req.params.id) } });
  } catch (error) {
    return sendError(res, 500, 'No se pudo eliminar la categoria');
  }
};

module.exports = {
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
};
