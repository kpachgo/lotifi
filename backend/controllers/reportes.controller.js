const db = require('../config/db');

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

exports.obtenerDashboard = async (req, res) => {
  try {
    const mes = String(req.query.mes || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return res.status(400).json({ error: 'Selecciona un mes válido en formato YYYY-MM.' });
    }

    const [year, month] = mes.split('-').map(Number);
    if (year < 1000) {
      return res.status(400).json({ error: 'Selecciona un mes válido en formato YYYY-MM.' });
    }
    const desde = `${mes}-01`;
    const siguienteMes = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const [
      [resumenMes],
      [tendencia],
      [metodos],
      [pagosRecientes],
      [operaciones],
      [pagosSinComprobante]
    ] = await Promise.all([
      db.query(`
        SELECT
          (
            SELECT COUNT(DISTINCT COALESCE(p.id_movimiento, p.id_pago))
            FROM pagos p WHERE p.fecha_abono >= ? AND p.fecha_abono < ?
          ) + (
            SELECT COUNT(*) FROM pagos_prima pp
            WHERE pp.fecha_abono >= ? AND pp.fecha_abono < ?
          ) AS transacciones,
          (
            SELECT COALESCE(SUM(p.monto_total), 0)
            FROM pagos p WHERE p.fecha_abono >= ? AND p.fecha_abono < ?
          ) + (
            SELECT COALESCE(SUM(pp.monto_total), 0) FROM pagos_prima pp
            WHERE pp.fecha_abono >= ? AND pp.fecha_abono < ?
          ) AS total
      `, [desde, siguienteMes, desde, siguienteMes, desde, siguienteMes, desde, siguienteMes]),
      db.query(`
        SELECT dia, SUM(total) AS total
        FROM (
          SELECT DAYOFMONTH(p.fecha_abono) AS dia, SUM(p.monto_total) AS total
          FROM pagos p
          WHERE p.fecha_abono >= ? AND p.fecha_abono < ?
          GROUP BY p.fecha_abono
          UNION ALL
          SELECT DAYOFMONTH(pp.fecha_abono) AS dia, SUM(pp.monto_total) AS total
          FROM pagos_prima pp
          WHERE pp.fecha_abono >= ? AND pp.fecha_abono < ?
          GROUP BY pp.fecha_abono
        ) cobros_dia
        GROUP BY dia
        ORDER BY dia
      `, [desde, siguienteMes, desde, siguienteMes]),
      db.query(`
        SELECT forma_pago, SUM(total) AS total, SUM(transacciones) AS transacciones
        FROM (
          SELECT p.forma_pago, SUM(p.monto_total) AS total,
            COUNT(DISTINCT COALESCE(p.id_movimiento, p.id_pago)) AS transacciones
          FROM pagos p
          WHERE p.fecha_abono >= ? AND p.fecha_abono < ?
          GROUP BY p.forma_pago
          UNION ALL
          SELECT pp.forma_pago, SUM(pp.monto_total) AS total, COUNT(*) AS transacciones
          FROM pagos_prima pp
          WHERE pp.fecha_abono >= ? AND pp.fecha_abono < ?
          GROUP BY pp.forma_pago
        ) cobros_metodo
        GROUP BY forma_pago
        ORDER BY total DESC
      `, [desde, siguienteMes, desde, siguienteMes]),
      db.query(`
        SELECT * FROM (
          SELECT pa.id_pago, NULL AS id_pago_prima, pa.fecha_abono, pa.monto_total, pa.forma_pago,
            pa.numero_recibo, d.id_documento, NULL AS id_documento_prima,
            'Cuota' AS tipo_transaccion, cu.numero_cuota,
            CONCAT(cl.nombres, ' ', COALESCE(cl.apellidos, '')) AS cliente,
            lo.nombre AS lotificacion, po.nombre_poligono AS poligono,
            lo2.numero_lote
          FROM pagos pa
          JOIN cuotas cu ON pa.id_cuota = cu.id_cuota
          JOIN contratos co ON cu.id_contrato = co.id_contrato
          JOIN cliente cl ON co.id_cliente = cl.id_cliente
          JOIN lotes lo2 ON co.id_lote = lo2.id_lote
          JOIN poligonos po ON lo2.id_poligono = po.id_poligono
          JOIN lotificaciones lo ON po.id_lotificacion = lo.id_lotificacion
          LEFT JOIN (
            SELECT id_pago, MAX(id_documento) AS id_documento
            FROM documentos
            WHERE tipo_documento = 'comprobante'
            GROUP BY id_pago
          ) d ON d.id_pago = pa.id_pago
          WHERE pa.fecha_abono >= ?
            AND pa.fecha_abono < ?
          UNION ALL
          SELECT pp.id_pago_prima AS id_pago, pp.id_pago_prima,
            pp.fecha_abono, pp.monto_total, pp.forma_pago, pp.numero_recibo,
            NULL AS id_documento, dp.id_documento_prima, 'Prima' AS tipo_transaccion,
            NULL AS numero_cuota,
            CONCAT(cl.nombres, ' ', COALESCE(cl.apellidos, '')) AS cliente,
            lo.nombre AS lotificacion, po.nombre_poligono AS poligono, l.numero_lote
          FROM pagos_prima pp
          JOIN contratos co ON pp.id_contrato = co.id_contrato
          JOIN cliente cl ON co.id_cliente = cl.id_cliente
          JOIN lotes l ON co.id_lote = l.id_lote
          JOIN poligonos po ON l.id_poligono = po.id_poligono
          JOIN lotificaciones lo ON po.id_lotificacion = lo.id_lotificacion
          LEFT JOIN documentos_prima dp ON dp.id_pago_prima = pp.id_pago_prima
          WHERE pp.fecha_abono >= ?
            AND pp.fecha_abono < ?
        ) transacciones_mes
        ORDER BY fecha_abono DESC, id_pago DESC
        LIMIT 12
      `, [desde, siguienteMes, desde, siguienteMes]),
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM cliente) AS clientes,
          (SELECT COUNT(*) FROM contratos WHERE estado = 'activo') AS contratos_activos,
          (SELECT COALESCE(SUM(capital_pendiente), 0) FROM contratos WHERE estado = 'activo') AS saldo_activo,
          (SELECT COUNT(*) FROM lotes WHERE estado = 'disponible') AS lotes_disponibles,
          (SELECT COUNT(*) FROM lotes WHERE estado = 'vendido') AS lotes_vendidos,
          (SELECT COUNT(*) FROM lotes WHERE estado = 'promesa_venta') AS lotes_en_promesa,
          (SELECT COUNT(*) FROM cuotas
            WHERE capital_pendiente > 0
              AND fecha_vencimiento < CURDATE()
              AND estado IN ('pendiente', 'atrasada')) AS cuotas_vencidas,
          (SELECT COALESCE(SUM(capital_pendiente), 0) FROM cuotas
            WHERE capital_pendiente > 0
              AND fecha_vencimiento < CURDATE()
              AND estado IN ('pendiente', 'atrasada')) AS saldo_vencido
      `),
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM pagos p
           WHERE NOT EXISTS (
             SELECT 1 FROM documentos d
             WHERE d.id_pago = p.id_pago AND d.tipo_documento = 'comprobante'
           ))
          +
          (SELECT COUNT(*) FROM pagos_prima pp
           WHERE NOT EXISTS (
             SELECT 1 FROM documentos_prima dp
             WHERE dp.id_pago_prima = pp.id_pago_prima
           )) AS cantidad
      `)
    ]);

    const diasEnMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const tendenciaMap = new Map(tendencia.map(item => [Number(item.dia), round2(item.total)]));
    const tendenciaCompleta = Array.from({ length: diasEnMes }, (_, index) => {
      const dia = index + 1;
      return { dia, total: tendenciaMap.get(dia) || 0 };
    });
    const totalMes = round2(resumenMes[0].total);
    const transaccionesMes = Number(resumenMes[0].transacciones);

    return res.json({
      mes,
      resumen_mes: {
        total: totalMes,
        transacciones: transaccionesMes,
        promedio_diario: round2(totalMes / diasEnMes)
      },
      tendencia: tendenciaCompleta,
      metodos: metodos.map(item => ({
        forma_pago: item.forma_pago,
        total: round2(item.total),
        transacciones: Number(item.transacciones)
      })),
      pagos_recientes: pagosRecientes,
      operaciones: {
        clientes: Number(operaciones[0].clientes),
        contratos_activos: Number(operaciones[0].contratos_activos),
        saldo_activo: round2(operaciones[0].saldo_activo),
        lotes_disponibles: Number(operaciones[0].lotes_disponibles),
        lotes_vendidos: Number(operaciones[0].lotes_vendidos),
        lotes_en_promesa: Number(operaciones[0].lotes_en_promesa),
        cuotas_vencidas: Number(operaciones[0].cuotas_vencidas),
        saldo_vencido: round2(operaciones[0].saldo_vencido),
        pagos_sin_comprobante: Number(pagosSinComprobante[0].cantidad)
      }
    });
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    return res.status(500).json({ error: 'No se pudo cargar el panel principal.' });
  }
};

exports.obtenerReporteContratos = async (req, res) => {
  try {
    const { cliente, lote, desde, hasta, estado } = req.query;

    // =========================
    // 🔹 WHERE PARA CONTRATOS
    // =========================
    let whereContratos = 'WHERE 1 = 1';
    const paramsContratos = [];

    if (cliente) {
      whereContratos += `
        AND (
          CONCAT(c.nombres, ' ', c.apellidos) LIKE ?
          OR c.dui LIKE ?
        )
      `;
      paramsContratos.push(`%${cliente}%`, `%${cliente}%`);
    }

    if (lote) {
      whereContratos += ' AND l.numero_lote LIKE ?';
      paramsContratos.push(`%${lote}%`);
    }

    if (desde) {
      whereContratos += ' AND co.fecha_inicio >= ?';
      paramsContratos.push(desde);
    }

    if (hasta) {
      whereContratos += ' AND co.fecha_inicio <= ?';
      paramsContratos.push(hasta);
    }

    if (estado) {
      whereContratos += ' AND co.estado = ?';
      paramsContratos.push(estado.toLowerCase());
    }

    // =========================
    // 📋 CONTRATOS FILTRADOS
    // =========================
    const [contratos] = await db.query(
      `
      SELECT
        co.id_contrato,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente,
        c.dui,
        CONCAT(
          lo.nombre, ' / Pol. ', p.nombre_poligono,
          ' / Lote ', l.numero_lote
        ) AS lote,
        co.fecha_inicio,
        co.precio_total,
        co.estado
      FROM contratos co
      JOIN cliente c ON co.id_cliente = c.id_cliente
      JOIN lotes l ON co.id_lote = l.id_lote
      JOIN poligonos p ON l.id_poligono = p.id_poligono
      JOIN lotificaciones lo ON p.id_lotificacion = lo.id_lotificacion
      ${whereContratos}
      ORDER BY co.fecha_inicio DESC
      `,
      paramsContratos
    );

    // =========================
    // 🛑 SI NO HAY CONTRATOS
    // =========================
    if (contratos.length === 0) {
      return res.json({
        resumen: {
          total_pagado: 0,
          total_pendiente: 0,
          contratos: 0,
          cuotas_mora: 0
        },
        contratos: []
      });
    }

    // =========================
    // 🔑 IDS DE CONTRATOS
    // =========================
    const idsContratos = contratos.map(c => c.id_contrato);

    // =========================
    // 📊 TOTAL PAGADO
    // =========================
    const [[pagado]] = await db.query(
      `
      SELECT IFNULL(SUM(p.monto_total), 0) AS total_pagado
      FROM pagos p
      JOIN cuotas cu ON p.id_cuota = cu.id_cuota
      WHERE cu.id_contrato IN (?)
      `,
      [idsContratos]
    );

    // =========================
    // 📊 TOTAL PENDIENTE
    // =========================
    const [[pendiente]] = await db.query(
      `
      SELECT IFNULL(SUM(co.capital_pendiente), 0) AS total_pendiente
      FROM contratos co
      WHERE co.id_contrato IN (?)
      `,
      [idsContratos]
    );

// =========================
// 📊 CUOTAS EN MORA (con gracia y saldo pendiente real)
// =========================
const [[mora]] = await db.query(
  `
  SELECT COUNT(*) AS cuotas_mora
  FROM cuotas cu
  WHERE cu.id_contrato IN (?)
    AND cu.capital_pendiente > 0
    AND cu.fecha_vencimiento < CURDATE()
    AND cu.estado IN ('pendiente', 'atrasada')
  `,
  [idsContratos]
);


    // =========================
    // 📤 RESPUESTA FINAL
    // =========================
    res.json({
      resumen: {
        total_pagado: pagado.total_pagado,
        total_pendiente: pendiente.total_pendiente,
        contratos: contratos.length,
        cuotas_mora: mora.cuotas_mora
      },
      contratos
    });

  } catch (error) {
    console.error('Error reporte contratos:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
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
exports.resumenContrato = async (req, res) => {
  try {
    const { idContrato } = req.params;

    // 🔹 Datos del contrato
    const [[contrato]] = await db.query(
      `SELECT 
        precio_total,
        prima,
        monto_financiado,
        capital_pendiente
       FROM contratos
       WHERE id_contrato = ?`,
      [idContrato]
    );

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // 🔹 Totales de pagos
    const [[totales]] = await db.query(
      `SELECT
        IFNULL(SUM(p.abono_capital),0) AS capital_pagado,
        IFNULL(SUM(p.abono_interes),0) AS interes_pagado,
        IFNULL(SUM(p.abono_mora),0) AS mora_pagada,
        IFNULL(SUM(p.monto_total),0) AS total_abonado
       FROM pagos p
       JOIN cuotas c ON p.id_cuota = c.id_cuota
       WHERE c.id_contrato = ?`,
      [idContrato]
    );

    const prima = round2(contrato.prima);
    const montoFinanciado = round2(contrato.monto_financiado);
    const capitalPagado = round2(totales.capital_pagado);
    const interesPagado = round2(totales.interes_pagado);
    const moraPagada = round2(totales.mora_pagada);
    const totalPagos = round2(totales.total_abonado);

    // Regla contable real:
    // saldo pendiente = monto financiado - capital pagado
    const saldoPendienteReal = round2(
      Math.max(0, montoFinanciado - capitalPagado)
    );

    // saldo acumulado (patrimonio del cliente) = prima + capital pagado
    const saldoAcumuladoReal = round2(prima + capitalPagado);

    // total abonado global = prima + pagos registrados (capital+interes+mora)
    const totalAbonadoReal = round2(prima + totalPagos);

    res.json({
      precio_total: contrato.precio_total,
      prima,
      monto_financiado: montoFinanciado,
      capital_pagado: capitalPagado,
      interes_pagado: interesPagado,
      mora_pagada: moraPagada,
      total_abonado: totalAbonadoReal,
      total_pagos: totalPagos,
      saldo_pendiente: saldoPendienteReal,
      saldo_acumulado: saldoAcumuladoReal,
      capital_pendiente_contrato: round2(contrato.capital_pendiente)
    });

  } catch (error) {
    console.error('Error resumen contrato:', error);
    res.status(500).json({ error: 'Error generando resumen' });
  }
};
