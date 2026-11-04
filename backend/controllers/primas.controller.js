const db = require('../config/db');
const {
  InvalidImageError,
  R2ConfigurationError,
  R2StorageError,
  eliminarComprobante,
  guardarComprobante,
  obtenerUrlComprobante
} = require('../services/comprobantes.storage');

const paymentMethods = ['Efectivo', 'Remesa', 'Transferencia', 'Cheque'];

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

exports.obtenerPrimaPorContrato = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pp.id_pago_prima, pp.id_contrato, pp.fecha_abono, pp.fecha_recibo,
        pp.forma_pago, pp.banco, pp.monto_total, pp.numero_recibo,
        dp.id_documento_prima
       FROM pagos_prima pp
       LEFT JOIN documentos_prima dp ON dp.id_pago_prima = pp.id_pago_prima
       WHERE pp.id_contrato = ?
       LIMIT 1`,
      [req.params.idContrato]
    );
    return res.json(rows[0] || null);
  } catch (error) {
    console.error('ERROR OBTENER PAGO DE PRIMA:', error);
    return res.status(500).json({ error: 'No se pudo obtener el pago de prima.' });
  }
};

exports.registrarPrima = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const {
      id_contrato,
      fecha_abono,
      fecha_recibo,
      forma_pago,
      banco,
      numero_recibo
    } = req.body;
    const idContrato = Number(id_contrato);

    if (!Number.isInteger(idContrato) || idContrato <= 0) {
      return res.status(400).json({ error: 'Selecciona un contrato válido.' });
    }
    if (!isValidDate(fecha_abono) || !isValidDate(fecha_recibo)) {
      return res.status(400).json({ error: 'Ingresa fechas válidas para el abono y el recibo.' });
    }
    if (!paymentMethods.includes(forma_pago)) {
      return res.status(400).json({ error: 'Selecciona una forma de pago válida.' });
    }
    if (forma_pago !== 'Efectivo' && !String(banco || '').trim()) {
      return res.status(400).json({ error: 'El banco es obligatorio para esta forma de pago.' });
    }
    if (!String(numero_recibo || '').trim()) {
      return res.status(400).json({ error: 'El número de recibo es obligatorio.' });
    }
    if (String(numero_recibo).trim().length > 30) {
      return res.status(400).json({ error: 'El número de recibo no puede superar 30 caracteres.' });
    }
    if (String(banco || '').trim().length > 100) {
      return res.status(400).json({ error: 'El nombre del banco no puede superar 100 caracteres.' });
    }

    await conn.beginTransaction();
    const [[contrato]] = await conn.query(
      `SELECT id_contrato, prima, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio
       FROM contratos WHERE id_contrato = ? FOR UPDATE`,
      [idContrato]
    );
    if (!contrato) {
      await conn.rollback();
      return res.status(404).json({ error: 'No se encontró el contrato.' });
    }

    const montoPrima = Number(contrato.prima || 0);
    if (!Number.isFinite(montoPrima) || montoPrima <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Este contrato no tiene una prima pendiente de registrar.' });
    }

    const fechaInicio = contrato.fecha_inicio;
    const [[fechaActual]] = await conn.query(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy"
    );
    if (
      fecha_abono < fechaInicio ||
      fecha_abono > fechaActual.hoy ||
      fecha_recibo < fechaInicio ||
      fecha_recibo > fechaActual.hoy
    ) {
      await conn.rollback();
      return res.status(400).json({
        error: `Las fechas del pago deben estar entre el inicio del contrato (${fechaInicio}) y hoy (${fechaActual.hoy}).`
      });
    }

    const [[existente]] = await conn.query(
      'SELECT id_pago_prima FROM pagos_prima WHERE id_contrato = ?',
      [idContrato]
    );
    if (existente) {
      await conn.rollback();
      return res.status(409).json({ error: 'La prima de este contrato ya fue registrada.' });
    }

    const [result] = await conn.query(
      `INSERT INTO pagos_prima
        (id_contrato, fecha_abono, fecha_recibo, forma_pago, banco, monto_total, numero_recibo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idContrato,
        fecha_abono,
        fecha_recibo,
        forma_pago,
        String(banco || '').trim() || null,
        montoPrima,
        String(numero_recibo).trim()
      ]
    );
    await conn.commit();
    return res.status(201).json({
      ok: true,
      id_pago_prima: result.insertId,
      monto_total: montoPrima
    });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('ERROR REVERTIR REGISTRO DE PRIMA:', rollbackError);
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La prima de este contrato ya fue registrada.' });
    }
    console.error('ERROR REGISTRAR PAGO DE PRIMA:', error);
    return res.status(500).json({ error: 'No se pudo registrar el pago de prima.' });
  } finally {
    conn.release();
  }
};

exports.subirComprobantePrima = async (req, res) => {
  let rutaArchivo;
  try {
    const idPagoPrima = String(req.body.id_pago_prima || '');
    if (!req.file || !/^\d+$/.test(idPagoPrima)) {
      return res.status(400).json({ error: 'Archivo o pago de prima inválido.' });
    }

    const [[pago]] = await db.query(
      'SELECT id_pago_prima FROM pagos_prima WHERE id_pago_prima = ?',
      [idPagoPrima]
    );
    if (!pago) {
      return res.status(404).json({ error: 'No se encontró el pago de prima.' });
    }
    const [[documento]] = await db.query(
      'SELECT id_documento_prima FROM documentos_prima WHERE id_pago_prima = ?',
      [idPagoPrima]
    );
    if (documento) {
      return res.status(409).json({ error: 'Este pago de prima ya tiene un comprobante.' });
    }

    rutaArchivo = await guardarComprobante(req.file.buffer, `prima-${idPagoPrima}`);
    await db.query(
      `INSERT INTO documentos_prima (id_pago_prima, ruta_archivo, fecha_subida)
       VALUES (?, ?, NOW())`,
      [idPagoPrima, rutaArchivo]
    );
    return res.status(201).json({ ok: true });
  } catch (error) {
    if (rutaArchivo) {
      try {
        await eliminarComprobante(rutaArchivo);
      } catch (cleanupError) {
        console.error('ERROR LIMPIAR COMPROBANTE DE PRIMA SIN REGISTRO:', cleanupError);
      }
    }
    if (error instanceof InvalidImageError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof R2ConfigurationError || error instanceof R2StorageError) {
      if (error instanceof R2StorageError) {
        console.error('ERROR GUARDAR COMPROBANTE DE PRIMA EN R2:', error.cause);
      }
      return res.status(503).json({ error: error.message });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este pago de prima ya tiene un comprobante.' });
    }
    console.error('ERROR SUBIR COMPROBANTE DE PRIMA:', error);
    return res.status(500).json({ error: 'No se pudo subir el comprobante de la prima.' });
  }
};

exports.obtenerComprobantePrima = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ruta_archivo
       FROM documentos_prima
       WHERE id_documento_prima = ?
       LIMIT 1`,
      [req.params.idDocumento]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'No se encontró el comprobante de prima.' });
    }
    return res.json({ url: await obtenerUrlComprobante(rows[0].ruta_archivo) });
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('ERROR OBTENER COMPROBANTE DE PRIMA:', error);
    return res.status(500).json({ error: 'No se pudo obtener el comprobante de prima.' });
  }
};
