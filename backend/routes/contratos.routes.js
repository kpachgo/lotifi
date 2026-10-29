const express = require('express');
const router = express.Router();
const contratosController = require('../controllers/contratos.controller');

// Buscar cliente
router.get('/buscar-cliente/:texto', contratosController.buscarCliente);

// Contratos por cliente
router.get('/cliente/:id', contratosController.contratosPorCliente);

// 🔥 DETALLE DE CONTRATO (ESTA FALTABA / ESTABA MAL)
router.get('/detalle/:id', contratosController.obtenerContratoDetalle);

// Crear contrato
router.post('/', contratosController.crearContrato);

// Editar datos no financieros
router.put('/:id', contratosController.actualizarContrato);

module.exports = router;
