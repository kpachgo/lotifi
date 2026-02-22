const db = require('../config/db');

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

    const saldo_acumulado =
      Number(contrato.prima) +
      Number(totales.capital_pagado) +
      Number(totales.interes_pagado) +
      Number(totales.mora_pagada);

    res.json({
      precio_total: contrato.precio_total,
      prima: contrato.prima,
      monto_financiado: contrato.monto_financiado,
      capital_pagado: totales.capital_pagado,
      interes_pagado: totales.interes_pagado,
      mora_pagada: totales.mora_pagada,
      total_abonado: totales.total_abonado,
      saldo_pendiente: contrato.capital_pendiente,
      saldo_acumulado
    });

  } catch (error) {
    console.error('Error resumen contrato:', error);
    res.status(500).json({ error: 'Error generando resumen' });
  }
};


