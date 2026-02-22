const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentosController = require('../controllers/documentos.controller');

const storage = multer.diskStorage({
  destination: 'backend/uploads',
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `pago_${Date.now()}.${ext}`);
  }
});
const upload = multer({ storage });
router.post(
  '/comprobante',
  upload.single('comprobante'),
  documentosController.subirComprobante
);

module.exports = router;
