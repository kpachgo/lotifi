const db = require('../config/db');

exports.obtenerDeudores = async (req, res) => {
  try {

    const [rows] = await db.query(`
      SELECT
        co.id_contrato,
        co.tipo_financiamiento,
        co.capital_pendiente,
        co.tasa_interes_anual,
        co.penalizacion_fija,
        co.dias_gracia,

        c.id_cliente,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente,

        lo.id_lotificacion,
        lo.nombre AS lotificacion,
        CONCAT('Pol. ', p.nombre_poligono, ' / Lote ', l.numero_lote) AS lote,

        COUNT(cu.id_cuota) AS cuotas_vencidas,
        MAX(cu.monto_cuota) AS valor_cuota,
        SUM(cu.monto_cuota) AS total_cuotas_vencidas,
        MAX(DATEDIFF(CURDATE(), cu.fecha_vencimiento)) AS dias_mora_max

      FROM cuotas cu
      JOIN contratos co ON cu.id_contrato = co.id_contrato
      JOIN cliente c ON co.id_cliente = c.id_cliente
      JOIN lotes l ON co.id_lote = l.id_lote
      JOIN poligonos p ON l.id_poligono = p.id_poligono
      JOIN lotificaciones lo ON p.id_lotificacion = lo.id_lotificacion

      WHERE cu.estado != 'pagada'
        AND cu.fecha_vencimiento < CURDATE()
        AND co.estado = 'activo'

      GROUP BY co.id_contrato

      ORDER BY dias_mora_max DESC
    `);

    // ===============================
    // CALCULAR MORA SEGÚN TIPO
    // ===============================
    const resultado = rows.map(r => {

      let monto_mora = 0;

      if (r.tipo_financiamiento === 'interes_saldo') {

        const tasa = r.tasa_interes_anual / 100;

        const interes =
          (Number(r.capital_pendiente) * tasa * 30) / 360;

        monto_mora = Number(interes.toFixed(2));

      } else if (r.tipo_financiamiento === 'penalizacion_fija') {

        if (r.dias_mora_max > r.dias_gracia) {
          monto_mora =
            Number(r.penalizacion_fija || 0) *
            Number(r.cuotas_vencidas);
        }
      }

      return {
        id_contrato: r.id_contrato,
        id_lotificacion: r.id_lotificacion,
        cliente: r.cliente,
        lotificacion: r.lotificacion,
        lote: r.lote,
        tipo_financiamiento: r.tipo_financiamiento,
        cuotas_vencidas: r.cuotas_vencidas,
        valor_cuota: Number(r.valor_cuota || 0),
        total_cuotas_vencidas: Number(r.total_cuotas_vencidas || 0),
        dias_mora: r.dias_mora_max,
        monto_mora: Number(monto_mora.toFixed(2)),
        capital_pendiente: Number(r.capital_pendiente)
      };
    });

    res.json(resultado);

  } catch (error) {
    console.error('Error al obtener deudores:', error);
    res.status(500).json({ message: 'Error al obtener deudores' });
  }
};

