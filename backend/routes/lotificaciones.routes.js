const express = require('express');
const router = express.Router();
const lotificacionesController = require('../controllers/lotificaciones.controller');

router.get('/', lotificacionesController.listar);
router.post('/', lotificacionesController.crear);
router.get('/:id', lotificacionesController.obtener);
router.put('/:id', lotificacionesController.actualizar);

module.exports = router;
