const db = require('../config/db');
const MORA_MENSUAL_INTERES_SALDO = 0.035;
const DIAS_BASE_MORA = 30;

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

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
        SUM(
          CASE
            WHEN DATEDIFF(CURDATE(), cu.fecha_vencimiento) > IFNULL(co.dias_gracia, 0)
            THEN 1 ELSE 0
          END
        ) AS cuotas_con_mora_gracia,
        SUM(
          CASE
            WHEN DATEDIFF(CURDATE(), cu.fecha_vencimiento) > IFNULL(co.dias_gracia, 0)
            THEN cu.monto_cuota ELSE 0
          END
        ) AS total_cuotas_con_mora_gracia,
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
      const cuotasVencidasCalendario = Number(r.cuotas_vencidas || 0);
      const totalVencidoCalendario = Number(r.total_cuotas_vencidas || 0);
      const cuotasConMora = Number(r.cuotas_con_mora_gracia || 0);
      const totalCuotasConMora = Number(r.total_cuotas_con_mora_gracia || 0);
      let cuotasVencidasMostrar = cuotasVencidasCalendario;
      let totalCuotasVencidasMostrar = totalVencidoCalendario;

      if (r.tipo_financiamiento === 'interes_saldo') {

        // Mora para interes_saldo:
        // total_cuotas_vencidas * 3.5% mensual, prorrateado por dias (max 30)
        const totalCuotasVencidas = Number(r.total_cuotas_vencidas || 0);
        const diasMora = Number(r.dias_mora_max || 0);
        const diasAplicados = Math.max(0, Math.min(diasMora, DIAS_BASE_MORA));

        const interesMora =
          totalCuotasVencidas *
          MORA_MENSUAL_INTERES_SALDO *
          (diasAplicados / DIAS_BASE_MORA);

        monto_mora = Number(interesMora.toFixed(2));

      } else if (r.tipo_financiamiento === 'penalizacion_fija') {

        // En deudores para penalizacion se reporta solo lo que ya supero gracia.
        cuotasVencidasMostrar = cuotasConMora;
        totalCuotasVencidasMostrar = round2(totalCuotasConMora);
        monto_mora =
          Number(r.penalizacion_fija || 0) *
          cuotasConMora;
      }

      return {
        id_contrato: r.id_contrato,
        id_lotificacion: r.id_lotificacion,
        cliente: r.cliente,
        lotificacion: r.lotificacion,
        lote: r.lote,
        tipo_financiamiento: r.tipo_financiamiento,
        cuotas_vencidas: cuotasVencidasMostrar,
        cuotas_con_mora_gracia: cuotasConMora,
        cuotas_vencidas_calendario: cuotasVencidasCalendario,
        valor_cuota: Number(r.valor_cuota || 0),
        total_cuotas_vencidas: totalCuotasVencidasMostrar,
        total_cuotas_vencidas_calendario: round2(totalVencidoCalendario),
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

