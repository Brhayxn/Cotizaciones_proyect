const express = require('express');
const controller = require('../controllers/categoria.controller');

const router = express.Router();

router.get('/', controller.listarCategorias);
router.get('/:id', controller.obtenerCategoria);
router.post('/', controller.crearCategoria);
router.put('/:id', controller.actualizarCategoria);
router.delete('/:id', controller.eliminarCategoria);

module.exports = router;
