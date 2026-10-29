const db = require('../config/db');

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function sumarMesesISO(fechaISO, meses) {
  const [y, m, d] = String(fechaISO).split('-').map(Number);
  if (!y || !m || !d) return fechaISO;

  const base = new Date(y, m - 1, d);
  const day = base.getDate();

  const target = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDiaMes = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(Math.min(day, ultimoDiaMes));

  const yy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');

  return `${yy}-${mm}-${dd}`;
}

function calcularCuotaPMT(monto, plazoMeses, tasaAnual, tipoFinanciamiento) {
  const P = Number(monto || 0);
  const n = Number(plazoMeses || 0);
  if (P <= 0 || n <= 0) return 0;

  if (tipoFinanciamiento !== 'interes_saldo') {
    return round2(P / n);
  }

  const tasa = Number(tasaAnual || 16) / 100;
  const r = tasa / 12;

  if (r <= 0) {
    return round2(P / n);
  }

  const factor = Math.pow(1 + r, n);
  const cuota = P * ((r * factor) / (factor - 1));
  return round2(cuota);
}

function generarPlanCapital({
  montoFinanciado,
  plazoMeses,
  cuotaMensual,
  tipoFinanciamiento,
  tasaInteresAnual
}) {
  const plan = [];
  let saldo = round2(montoFinanciado);
  const n = Number(plazoMeses || 0);
  const cuota = round2(cuotaMensual);
  const tasaMensual = Number(tasaInteresAnual || 16) / 100 / 12;

  for (let i = 1; i <= n; i += 1) {
    if (saldo <= 0) {
      plan.push({
        numero_cuota: i,
        capital_programado: 0
      });
      continue;
    }

    let interesMes = 0;
    if (tipoFinanciamiento === 'interes_saldo') {
      interesMes = round2(saldo * tasaMensual);
    }

    let capitalMes = round2(cuota - interesMes);
    if (tipoFinanciamiento !== 'interes_saldo') {
      capitalMes = round2(cuota);
    }

    if (capitalMes <= 0) {
      capitalMes = saldo;
    }

    if (i === n || capitalMes > saldo) {
      capitalMes = saldo;
    }

    saldo = round2(saldo - capitalMes);

    plan.push({
      numero_cuota: i,
      capital_programado: capitalMes
    });
  }

  return plan;
}

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
        co.estado,
        co.id_cliente,
        DATE_FORMAT(co.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
        co.dias_gracia,
        (SELECT COUNT(*) FROM pagos pa
          JOIN cuotas cu ON cu.id_cuota = pa.id_cuota
          WHERE cu.id_contrato = co.id_contrato) AS total_pagos
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

    const montoFinanciadoNum = round2(monto_financiado);
    const plazoMesesNum = Number(plazo_meses || 0);
    if (!Number.isInteger(plazoMesesNum) || plazoMesesNum <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Plazo de meses invalido' });
    }

    const tasaAnualContrato = round2(
      tipo_financiamiento === 'interes_saldo'
        ? (tasa_interes_anual ?? 16)
        : 0
    );
    const cuotaCalculada = calcularCuotaPMT(
      montoFinanciadoNum,
      plazoMesesNum,
      tasaAnualContrato,
      tipo_financiamiento
    );
    if (montoFinanciadoNum > 0 && cuotaCalculada <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No se pudo calcular la cuota' });
    }

    const fechaVencimiento = sumarMesesISO(fecha_inicio, plazoMesesNum);

    // ===============================
    // DEFINIR ESTADOS SEGÚN TIPO DE PAGO
    // ===============================
    let estadoContrato = 'activo';
    let estadoLote = 'promesa_venta';

    if (montoFinanciadoNum <= 0) {
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
      montoFinanciadoNum,
      plazoMesesNum,
      cuotaCalculada,
      fecha_inicio,
      fechaVencimiento,
      estadoContrato,
      montoFinanciadoNum,
      tipo_financiamiento === 'interes_saldo' ? tasaAnualContrato : null,
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
    if (montoFinanciadoNum > 0) {
      const plan = generarPlanCapital({
        montoFinanciado: montoFinanciadoNum,
        plazoMeses: plazoMesesNum,
        cuotaMensual: cuotaCalculada,
        tipoFinanciamiento: tipo_financiamiento,
        tasaInteresAnual: tasaAnualContrato
      });

      for (let i = 1; i <= plazoMesesNum; i += 1) {
        const fechaFormateada = sumarMesesISO(fecha_inicio, i);
        const tramo = plan[i - 1];
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
          cuotaCalculada,
          round2(tramo?.capital_programado || 0)
        ]);
      }
    }

    await conn.commit();

    res.json({
      ok: true,
      cuota_calculada: cuotaCalculada
    });

  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error al crear contrato' });
  } finally {
    conn.release();
  }
};

// EDITAR CONTRATO (solo datos no financieros: cliente, fecha de inicio, dias de gracia)
exports.actualizarContrato = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { id_cliente, fecha_inicio, dias_gracia } = req.body;
    const diasGraciaNum = Number(dias_gracia || 0);

    if (!id_cliente || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_inicio || ''))) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!Number.isInteger(diasGraciaNum) || diasGraciaNum < 0) {
      return res.status(400).json({ error: 'Dias de gracia invalidos' });
    }

    await conn.beginTransaction();

    const [[contrato]] = await conn.query(
      `SELECT id_contrato, plazo_meses,
              DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio
       FROM contratos WHERE id_contrato = ? FOR UPDATE`,
      [req.params.id]
    );

    if (!contrato) {
      await conn.rollback();
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const [[cliente]] = await conn.query(
      'SELECT id_cliente FROM cliente WHERE id_cliente = ?',
      [id_cliente]
    );

    if (!cliente) {
      await conn.rollback();
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (fecha_inicio !== contrato.fecha_inicio) {
      // Las fechas de cuotas, mora e interes dependen de esta fecha
      const [[{ total }]] = await conn.query(
        `SELECT COUNT(*) AS total FROM pagos p
         JOIN cuotas cu ON cu.id_cuota = p.id_cuota
         WHERE cu.id_contrato = ?`,
        [contrato.id_contrato]
      );

      if (total > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: 'El contrato ya tiene pagos: la fecha de inicio no se puede cambiar'
        });
      }

      const [cuotas] = await conn.query(
        'SELECT id_cuota, numero_cuota FROM cuotas WHERE id_contrato = ?',
        [contrato.id_contrato]
      );

      for (const cuota of cuotas) {
        await conn.query(
          'UPDATE cuotas SET fecha_vencimiento = ? WHERE id_cuota = ?',
          [sumarMesesISO(fecha_inicio, Number(cuota.numero_cuota)), cuota.id_cuota]
        );
      }
    }

    await conn.query(
      `UPDATE contratos SET
        id_cliente = ?, fecha_inicio = ?, fecha_vencimiento = ?, dias_gracia = ?
       WHERE id_contrato = ?`,
      [
        id_cliente,
        fecha_inicio,
        sumarMesesISO(fecha_inicio, Number(contrato.plazo_meses)),
        diasGraciaNum,
        contrato.id_contrato
      ]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    console.error('ERROR ACTUALIZAR CONTRATO:', error);
    res.status(500).json({ error: 'Error al actualizar contrato' });
  } finally {
    conn.release();
  }
};




