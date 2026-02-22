const db = require('../config/db');

// BUSCAR CLIENTE
exports.buscarCliente = async (req, res) => {
  try {
    const texto = `%${req.params.texto}%`;

    const [rows] = await db.query(
      `SELECT id_cliente, nombres, apellidos, dui
       FROM cliente
       WHERE nombres LIKE ? OR apellidos LIKE ?
       ORDER BY nombres`,
      [texto, texto]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json([]);
  }
};
// CONTRATOS POR CLIENTE (CORREGIDO)
exports.contratosPorCliente = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        c.id_contrato,
        l.numero_lote,
        p.nombre_poligono AS poligono,
        lo.nombre AS lotificacion,
        c.precio_total,
        c.plazo_meses,
        c.estado
      FROM contratos c
      JOIN lotes l ON l.id_lote = c.id_lote
      JOIN poligonos p ON p.id_poligono = l.id_poligono
      JOIN lotificaciones lo ON lo.id_lotificacion = p.id_lotificacion
      WHERE c.id_cliente = ?`,
      [req.params.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('ERROR contratosPorCliente:', error);
    res.status(500).json([]);
  }
};
exports.obtenerContratoDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const [[contrato]] = await db.query(
      `
      SELECT
        co.id_contrato,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente,
        c.dui,
        lo.nombre AS lotificacion,
        p.nombre_poligono AS poligono,
        l.numero_lote,
        co.plazo_meses,
        co.estado
      FROM contratos co
      JOIN cliente c ON co.id_cliente = c.id_cliente
      JOIN lotes l ON co.id_lote = l.id_lote
      JOIN poligonos p ON l.id_poligono = p.id_poligono
      JOIN lotificaciones lo ON p.id_lotificacion = lo.id_lotificacion
      WHERE co.id_contrato = ?
      `,
      [id]
    );

    if (!contrato) {
      return res.status(404).json({ message: 'Contrato no encontrado' });
    }

    res.json(contrato);

  } catch (error) {
    console.error('Error contrato detalle:', error);
    res.status(500).json({ message: 'Error al obtener contrato' });
  }
};
exports.crearContrato = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      id_cliente,
      id_lote,
      tipo_financiamiento,
      precio_total,
      prima,
      monto_financiado,
      plazo_meses,
      cuota,
      fecha_inicio,
      tasa_interes_anual,
      penalizacion_fija,
      dias_gracia
    } = req.body;

    if (!id_cliente || !id_lote) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!tipo_financiamiento) {
      return res.status(400).json({ error: 'Tipo de financiamiento requerido' });
    }

    await conn.beginTransaction();

    // Bloquea la fila del lote para evitar contratos duplicados por doble click/request concurrente
    const [[lote]] = await conn.query(
      `
      SELECT estado
      FROM lotes
      WHERE id_lote = ?
      FOR UPDATE
      `,
      [id_lote]
    );

    if (!lote) {
      await conn.rollback();
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    if (lote.estado !== 'disponible') {
      await conn.rollback();
      return res.status(409).json({ error: 'El lote ya no esta disponible' });
    }

    function sumarMeses(fecha, meses) {
      const f = new Date(fecha);
      f.setMonth(f.getMonth() + meses);
      return f.toISOString().split('T')[0];
    }

    const fechaVencimiento = sumarMeses(fecha_inicio, plazo_meses);

    // ===============================
    // DEFINIR ESTADOS SEGÚN TIPO DE PAGO
    // ===============================
    let estadoContrato = 'activo';
    let estadoLote = 'promesa_venta';

    if (Number(monto_financiado) <= 0) {
      estadoContrato = 'cancelado';
      estadoLote = 'vendido';
    }

    // ===============================
    // INSERTAR CONTRATO
    // ===============================
    const [result] = await conn.query(`
      INSERT INTO contratos (
        id_cliente,
        id_lote,
        tipo_financiamiento,
        precio_total,
        prima,
        monto_financiado,
        plazo_meses,
        cuota,
        fecha_inicio,
        fecha_vencimiento,
        estado,
        capital_pendiente,
        tasa_interes_anual,
        penalizacion_fija,
        dias_gracia
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      id_cliente,
      id_lote,
      tipo_financiamiento,
      precio_total,
      prima,
      monto_financiado,
      plazo_meses,
      cuota,
      fecha_inicio,
      fechaVencimiento,
      estadoContrato,
      Number(monto_financiado),
      tipo_financiamiento === 'interes_saldo' ? tasa_interes_anual : null,
      tipo_financiamiento === 'penalizacion_fija' ? penalizacion_fija : null,
      dias_gracia || 0
    ]);

    const id_contrato = result.insertId;

    // ===============================
    // ACTUALIZAR ESTADO DEL LOTE
    // ===============================
    await conn.query(`
      UPDATE lotes
      SET estado = ?
      WHERE id_lote = ?
    `, [estadoLote, id_lote]);

    // ===============================
    // GENERAR CUOTAS SOLO SI HAY FINANCIAMIENTO
    // ===============================
    if (Number(monto_financiado) > 0) {

      for (let i = 1; i <= plazo_meses; i++) {

        const fechaCuota = new Date(fecha_inicio);
        fechaCuota.setMonth(fechaCuota.getMonth() + i);

        const fechaFormateada = fechaCuota
          .toISOString()
          .split('T')[0];

        await conn.query(`
          INSERT INTO cuotas (
            id_contrato,
            numero_cuota,
            fecha_vencimiento,
            monto_cuota,
            capital_pendiente
          )
          VALUES (?,?,?,?,?)
        `, [
          id_contrato,
          i,
          fechaFormateada,
          cuota,
          cuota
        ]);
      }
    }

    await conn.commit();

    res.json({ ok: true });

  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error al crear contrato' });
  } finally {
    conn.release();
  }
};




