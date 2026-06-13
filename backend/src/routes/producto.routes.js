const express = require('express');
const controller = require('../controllers/producto.controller');

const router = express.Router();

router.get('/', controller.listarProductos);
router.get('/:id', controller.obtenerProducto);
router.post('/', controller.crearProducto);
router.put('/:id', controller.actualizarProducto);
router.delete('/:id', controller.eliminarProducto);
router.patch('/:id/estado', controller.cambiarEstadoProducto);

module.exports = router;
