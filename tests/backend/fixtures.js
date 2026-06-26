const { Cliente, Categoria, Producto, MovimientoInventario } = require('../../backend/src/models');

const seedTestData = async () => {
  const cliente = await Cliente.create({ nombre: 'Cliente Prueba', telefono: '912345678' });
  const categoria = await Categoria.create({ nombre: 'Herramientas de prueba' });
  const producto = await Producto.create({
    nombre: 'Martillo de prueba',
    precio: 10000,
    descuento_maximo: 10,
    stock: 5,
    activo: true,
    Categoria_id: categoria.id
  });
  const productoSinStock = await Producto.create({
    nombre: 'Taladro sin stock',
    precio: 50000,
    descuento_maximo: 5,
    stock: 0,
    activo: true,
    Categoria_id: categoria.id
  });
  const productoInactivo = await Producto.create({
    nombre: 'Producto inactivo',
    precio: 1000,
    descuento_maximo: 0,
    stock: 10,
    activo: false,
    Categoria_id: categoria.id
  });

  await MovimientoInventario.create({
    cantidad: producto.stock,
    tipo_movimiento: 'abastecimiento',
    Producto_id: producto.id
  });

  return { cliente, categoria, producto, productoSinStock, productoInactivo };
};

module.exports = { seedTestData };
