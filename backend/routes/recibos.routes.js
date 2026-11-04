const express = require('express');
const router = express.Router();

const {
  obtenerReciboPorPago,
  obtenerReciboPrima
} = require('../controllers/recibos.controller');

// ===============================
// RECIBO POR ID DE PAGO
// ===============================
// Devuelve los datos listos para imprimir
router.get('/pago/:id_pago', obtenerReciboPorPago);
router.get('/prima/:id_pago_prima', obtenerReciboPrima);

module.exports = router;
