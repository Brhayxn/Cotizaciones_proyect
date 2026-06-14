const express = require('express');
const controller = require('../controllers/inventario.controller');

const router = express.Router();

router.get('/movimientos', controller.listarMovimientos);
router.post('/movimientos', controller.registrarMovimientoManual);

module.exports = router;
