const express = require('express');
const router = express.Router();
const documentosController = require('../controllers/documentos.controller');
const recibirComprobante = require('../middleware/recibir-comprobante');

router.get('/comprobante/:idDocumento', documentosController.obtenerComprobantePorPago);
router.post('/comprobante', recibirComprobante, documentosController.subirComprobante);

module.exports = router;
