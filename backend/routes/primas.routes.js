const express = require('express');
const router = express.Router();
const primasController = require('../controllers/primas.controller');
const recibirComprobante = require('../middleware/recibir-comprobante');

router.get('/contrato/:idContrato', primasController.obtenerPrimaPorContrato);
router.post('/', primasController.registrarPrima);
router.get('/comprobante/:idDocumento', primasController.obtenerComprobantePrima);
router.post('/comprobante', recibirComprobante, primasController.subirComprobantePrima);

module.exports = router;
