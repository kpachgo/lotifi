const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('El comprobante debe ser JPG, PNG o WebP.'));
    }
    cb(null, true);
  }
});

module.exports = (req, res, next) => {
  upload.single('comprobante')(req, res, error => {
    if (!error) return next();
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
      ? 413
      : 400;
    return res.status(status).json({ error: error.message || 'No se pudo recibir el comprobante.' });
  });
};
