const db = require('../config/db');
const {
  InvalidImageError,
  R2ConfigurationError,
  R2StorageError,
  eliminarComprobante,
  guardarComprobante,
  obtenerUrlComprobante
} = require('../services/comprobantes.storage');

// SUBIR COMPROBANTE DE PAGO
exports.subirComprobante = async (req, res) => {
  let rutaArchivo;
  try {
    const { id_pago } = req.body;

    if (!req.file || !/^\d+$/.test(String(id_pago || ''))) {
      return res.status(400).json({ error: 'Archivo o pago inválido' });
    }

    const [[pago]] = await db.query(
      'SELECT id_pago FROM pagos WHERE id_pago = ?',
      [id_pago]
    );
    if (!pago) {
      return res.status(404).json({ error: 'No se encontró el pago para adjuntar el comprobante.' });
    }

    rutaArchivo = await guardarComprobante(req.file.buffer, id_pago);
    await db.query(
      `INSERT INTO documentos
      (id_pago, tipo_documento, ruta_archivo, fecha_subida)
      VALUES (?,?,?,NOW())`,
      [id_pago, 'comprobante', rutaArchivo]
    );

    return res.status(201).json({ ok: true });
  } catch (error) {
    if (rutaArchivo) {
      try {
        await eliminarComprobante(rutaArchivo);
      } catch (cleanupError) {
        console.error('ERROR LIMPIAR COMPROBANTE SIN REGISTRO:', cleanupError);
      }
    }
    if (error instanceof InvalidImageError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof R2ConfigurationError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof R2StorageError) {
      console.error('ERROR GUARDAR COMPROBANTE EN R2:', error.cause);
      return res.status(503).json({ error: error.message });
    }
    console.error('ERROR SUBIR COMPROBANTE:', error);
    return res.status(500).json({ error: 'Error al subir comprobante' });
  }
};

// Obtener URL temporal para ver un comprobante almacenado
exports.obtenerComprobantePorPago = async (req, res) => {
  try {
    const { idDocumento } = req.params;

    const [rows] = await db.query(
      `SELECT id_documento, ruta_archivo, fecha_subida
       FROM documentos
       WHERE id_documento = ? AND tipo_documento = 'comprobante'
       LIMIT 1`,
      [idDocumento]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró el comprobante.' });
    }

    const url = await obtenerUrlComprobante(rows[0].ruta_archivo);
    return res.json({ url });
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('ERROR OBTENER COMPROBANTE:', error);
    return res.status(500).json({ error: 'Error al obtener comprobante' });
  }
};
