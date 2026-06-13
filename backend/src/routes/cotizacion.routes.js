const express = require('express');
const controller = require('../controllers/cotizacion.controller');

const router = express.Router();

router.get('/', controller.listarCotizaciones);
router.get('/:id', controller.obtenerCotizacion);
router.post('/', controller.crearCotizacion);
router.delete('/:id', controller.eliminarCotizacion);

module.exports = router;
