const db = require('../config/db');

// SUBIR COMPROBANTE DE PAGO
exports.subirComprobante = async (req, res) => {
  try {
    const { id_pago } = req.body;

    if (!req.file || !id_pago) {
      return res.status(400).json({ error: 'Archivo o pago inválido' });
    }

    await db.query(
      `INSERT INTO documentos
      (id_pago, tipo_documento, ruta_archivo, fecha_subida)
      VALUES (?,?,?,NOW())`,
      [
        id_pago,
        'comprobante',
        req.file.path.replace('backend/', '')
      ]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error('ERROR SUBIR COMPROBANTE:', error);
    res.status(500).json({ error: 'Error al subir comprobante' });
  }
};

// OBTENER COMPROBANTE POR PAGO
exports.obtenerComprobantePorPago = async (req, res) => {
  try {
    const { id_pago } = req.params;

    const [rows] = await db.query(
      `SELECT id_documento, ruta_archivo, fecha_subida
       FROM documentos
       WHERE id_pago = ?
       LIMIT 1`,
      [id_pago]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    res.json(rows[0]);

  } catch (error) {
    console.error('ERROR OBTENER COMPROBANTE:', error);
    res.status(500).json({ error: 'Error al obtener comprobante' });
  }
};
