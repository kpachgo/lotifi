const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');

router.get('/estado/:idContrato', pagosController.estadoCuentaContrato);
router.post('/', pagosController.registrarPago);
router.post('/masivo', pagosController.registrarPagoMasivo);
router.post('/por-codigo', pagosController.buscarPorCodigoLote);
router.get('/contrato/:id', pagosController.pagosPorContrato);
router.get('/ultimo/:idContrato', pagosController.ultimoPago);
router.post('/anular-ultimo/:idContrato', pagosController.anularUltimoPago);

module.exports = router;



