const express = require('express');
const controller = require('../controllers/venta.controller');

const router = express.Router();

router.get('/', controller.listarVentas);
router.get('/hoy', controller.listarVentasHoy);
router.get('/ultima-semana', controller.listarVentasUltimaSemana);
router.get('/ultimo-mes', controller.listarVentasUltimoMes);
router.get('/:id', controller.obtenerVenta);
router.post('/', controller.crearVenta);
router.patch('/:id/confirmar', controller.confirmarVenta);
router.patch('/:id/anular', controller.anularVenta);
router.delete('/:id', controller.eliminarVenta);

module.exports = router;
