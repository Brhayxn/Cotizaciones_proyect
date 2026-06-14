const { sequelize, Producto, MovimientoInventario } = require('../models');

const sendError = (res, status, message) => res.status(status).json({ ok: false, message });

const listarMovimientos = async (req, res) => {
  try {
    const where = {};
    if (req.query.producto) where.Producto_id = req.query.producto;
    if (req.query.tipo) where.tipo_movimiento = req.query.tipo;

    const movimientos = await MovimientoInventario.findAll({
      where,
      include: [{ model: Producto, as: 'producto' }],
      order: [['id', 'DESC']]
    });

    return res.json({ ok: true, data: movimientos });
  } catch (error) {
    return sendError(res, 500, 'Error al listar movimientos de inventario');
  }
};

const registrarMovimientoManual = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
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
    return res.status(201).json({ ok: true, data: movimiento });
  } catch (error) {
    await transaction.rollback();
    return sendError(res, 500, 'Error al registrar movimiento de inventario');
  }
};

module.exports = {
  listarMovimientos,
  registrarMovimientoManual
};
