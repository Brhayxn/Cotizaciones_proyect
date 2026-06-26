const { sequelize, Categoria, Producto, MovimientoInventario } = require('../src/models');
const {
  createDatabaseOptimizations,
  optimizeDatabaseStatistics
} = require('../src/database/optimizations');

const resetDatabase = async () => {
  await sequelize.sync({ force: true });
  await createDatabaseOptimizations({ resetSearch: true });
};

const seedBaseData = async () => {
  const madera = await Categoria.create({ nombre: 'Maderas' });
  const herramientas = await Categoria.create({ nombre: 'Herramientas' });
  const fijaciones = await Categoria.create({ nombre: 'Fijaciones' });

  const productos = await Producto.bulkCreate([
    {
      nombre: 'Terciado estructural 18mm',
      precio: 18990,
      descuento_maximo: 10,
      stock: 25,
      Categoria_id: madera.id
    },
    {
      nombre: 'Pino cepillado 2x3',
      precio: 3490,
      descuento_maximo: 5,
      stock: 80,
      Categoria_id: madera.id
    },
    {
      nombre: 'Taladro percutor 650W',
      precio: 44990,
      descuento_maximo: 8,
      stock: 12,
      Categoria_id: herramientas.id
    },
    {
      nombre: 'Martillo carpintero 16oz',
      precio: 7990,
      descuento_maximo: 15,
      stock: 30,
      Categoria_id: herramientas.id
    },
    {
      nombre: 'Tornillo madera 8x1 1/2 caja',
      precio: 3990,
      descuento_maximo: 20,
      stock: 100,
      Categoria_id: fijaciones.id
    }
  ]);

  await MovimientoInventario.bulkCreate(
    productos
      .filter((producto) => producto.stock > 0)
      .map((producto) => ({
        cantidad: producto.stock,
        tipo_movimiento: 'abastecimiento',
        Producto_id: producto.id
      }))
  );
};

const run = async () => {
  try {
    await resetDatabase();

    if (process.argv.includes('--seed')) {
      await seedBaseData();
    }

    await optimizeDatabaseStatistics();

    console.log('Base de datos recreada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('Error al recrear base de datos:', error.message);
    process.exit(1);
  }
};

run();
