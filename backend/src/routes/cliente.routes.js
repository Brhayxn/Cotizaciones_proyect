const express = require('express');
const controller = require('../controllers/cliente.controller');

const router = express.Router();

router.get('/', controller.listarClientes);
router.get('/:id/ventas', controller.listarVentasCliente);
router.get('/:id', controller.obtenerCliente);
router.post('/', controller.crearCliente);
router.put('/:id', controller.actualizarCliente);
router.delete('/:id', controller.eliminarCliente);

module.exports = router;
