const { sequelize, Categoria, Producto } = require('../src/models');

const seed = async () => {
  try {
    await sequelize.sync({ force: true });

    const madera = await Categoria.create({ nombre: 'Maderas' });
    const herramientas = await Categoria.create({ nombre: 'Herramientas' });
    const fijaciones = await Categoria.create({ nombre: 'Fijaciones' });

    await Producto.bulkCreate([
      {
        nombre: 'Terciado estructural 18mm',
        precio: 18990,
        Categoria_id: madera.id
      },
      {
        nombre: 'Pino cepillado 2x3',
        precio: 3490,
        Categoria_id: madera.id
      },
      {
        nombre: 'Taladro percutor 650W',
        precio: 44990,
        Categoria_id: herramientas.id
      },
      {
        nombre: 'Martillo carpintero 16oz',
        precio: 7990,
        Categoria_id: herramientas.id
      },
      {
        nombre: 'Tornillo madera 8x1 1/2 caja',
        precio: 3990,
        Categoria_id: fijaciones.id
      }
    ]);

    console.log('Seeder ejecutado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar seeder:', error.message);
    process.exit(1);
  }
};

seed();
