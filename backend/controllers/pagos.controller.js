const db = require('../config/db');

function normalizarFechaYMD(valor) {
  if (!valor) return null;

  if (typeof valor === 'string') {
    const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}

exports.estadoCuentaContrato = async (req, res) => {
  const { idContrato } = req.params;
  const conn = await db.getConnection();

  try {
    
    const [[contrato]] = await conn.query(`
      SELECT *
      FROM contratos
      WHERE id_contrato = ?
    `, [idContrato]);

    if (!contrato) {
      console.log("PARAMS:", req.params);
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const [[cuota]] = await conn.query(`
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
      AND estado != 'pagada'
      ORDER BY numero_cuota
      LIMIT 1
    `, [idContrato]);

    if (!cuota) {
      return res.json({ cuota: null });
    }

    const hoy = new Date();
    const fechaVenc = new Date(cuota.fecha_vencimiento);

    let diasAtraso = Math.max(
      0,
      Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24))
    );

    let penalizacion = 0;
    let estadoCuota = 'pendiente';

    if (diasAtraso > 0) {
      estadoCuota = 'atrasada';

      if (contrato.tipo_financiamiento === 'penalizacion_fija') {
        if (diasAtraso > contrato.dias_gracia) {
          penalizacion = contrato.penalizacion_fija || 0;
        }
      }
      if (contrato.tipo_financiamiento === 'interes_saldo') {

  if (diasAtraso > contrato.dias_gracia) {

    const tasa = contrato.tasa_interes_anual / 100;

    penalizacion = (Number(cuota.monto_cuota) * tasa * diasAtraso) / 360;

    penalizacion = Number(penalizacion.toFixed(2));
  }

}
    }
    const total = Number(
      (Number(cuota.monto_cuota) + Number(penalizacion)).toFixed(2)
    );

    res.json({
      contrato,
      cuota,
      penalizacion,
      dias_atraso: diasAtraso,
      estado_cuota: estadoCuota,
      total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error calculando estado de cuenta' });
  } finally {
    conn.release();
  }
};
// REGISTRAR PAGO (VERSIÓN PROFESIONAL)
// ===============================
exports.registrarPago = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      id_cuota,
      monto_pagado,
      fecha_abono,
      fecha_recibo,
      forma_pago,
      banco,
      numero_recibo
    } = req.body;
    const fechaAbonoYMD = normalizarFechaYMD(fecha_abono);

    if (!id_cuota || !monto_pagado || !fecha_abono || !forma_pago) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!fechaAbonoYMD) {
      return res.status(400).json({ error: 'Fecha de abono invalida' });
    }

    if (forma_pago !== 'Efectivo' && !banco) {
      return res.status(400).json({
        error: 'Banco obligatorio para esta forma de pago'
      });
    }

    if (Number(monto_pagado) <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    await conn.beginTransaction();

    // 🔹 Obtener cuota
    const [[cuota]] = await conn.query(
      `SELECT * FROM cuotas WHERE id_cuota = ? FOR UPDATE`,
      [id_cuota]
    );

    if (!cuota) {
      await conn.rollback();
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    // 🔹 Obtener contrato
    const [[contrato]] = await conn.query(
      `SELECT * FROM contratos WHERE id_contrato = ? FOR UPDATE`,
      [cuota.id_contrato]
    );

    if (!contrato) {
      await conn.rollback();
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // 🔹 Obtener lo ya pagado en esa cuota
    const [[ultimoPagoContrato]] = await conn.query(
      `
      SELECT DATE_FORMAT(MAX(p.fecha_abono), '%Y-%m-%d') AS ultima_fecha_abono
      FROM pagos p
      JOIN cuotas cu ON cu.id_cuota = p.id_cuota
      WHERE cu.id_contrato = ?
      `,
      [contrato.id_contrato]
    );

    if (
      ultimoPagoContrato?.ultima_fecha_abono &&
      fechaAbonoYMD < ultimoPagoContrato.ultima_fecha_abono
    ) {
      await conn.rollback();
      return res.status(400).json({
        error:
          `La fecha de abono no puede ser menor al ultimo pago registrado ` +
          `(${ultimoPagoContrato.ultima_fecha_abono})`
      });
    }

    const [[pagosPrevios]] = await conn.query(
      `
      SELECT
        IFNULL(SUM(abono_interes),0) AS interes_pagado,
        IFNULL(SUM(abono_mora),0) AS mora_pagada
      FROM pagos
      WHERE id_cuota = ?
      `,
      [id_cuota]
    );

    let restante = Number(monto_pagado);
    let abono_interes = 0;
    let abono_mora = 0;
    let abono_capital = 0;

    const fechaPago = new Date(fecha_abono);
    const vencimiento = new Date(cuota.fecha_vencimiento);

    let diasAtraso = 0;

    if (fechaPago > vencimiento) {
      diasAtraso = Math.floor(
        (fechaPago - vencimiento) / (1000 * 60 * 60 * 24)
      );
    }

    // ======================================================
    // 1️⃣ INTERÉS SOBRE SALDO (30/360)
    // ======================================================
    if (
      contrato.tipo_financiamiento === 'interes_saldo' &&
      diasAtraso > contrato.dias_gracia
    ) {
      const tasa = contrato.tasa_interes_anual / 100;

      const interesTotalGenerado =
        (Number(cuota.capital_pendiente) * tasa * diasAtraso) / 360;

      const interesPendiente =
        Number(interesTotalGenerado.toFixed(2)) -
        Number(pagosPrevios.interes_pagado);

      if (interesPendiente > 0) {
        abono_interes = Math.min(restante, interesPendiente);
        restante -= abono_interes;
      }
    }

    // ======================================================
    // 2️⃣ PENALIZACIÓN FIJA
    // ======================================================
    if (
      contrato.tipo_financiamiento === 'penalizacion_fija' &&
      diasAtraso > contrato.dias_gracia
    ) {
      const moraTotalGenerada =
        Number(contrato.penalizacion_fija || 0);

      const moraPendiente =
        moraTotalGenerada -
        Number(pagosPrevios.mora_pagada);

      if (moraPendiente > 0) {
        abono_mora = Math.min(restante, moraPendiente);
        restante -= abono_mora;
      }
    }

    // ======================================================
    // 3️⃣ CAPITAL
    // ======================================================
    if (restante > 0) {
      abono_capital = Math.min(
        restante,
        Number(cuota.capital_pendiente)
      );
      restante -= abono_capital;
    }
    // ======================================================
// ✅ BLOQUEAR PAGO DE MÁS (especialmente en último pago)
// ======================================================

// Si quedó "restante" significa que el cliente pagó más de lo que se podía aplicar
// (ya se cubrió interés/mora/capital y aún sobra dinero)
if (restante > 0) {
  // total exacto que sí se podía cobrar en esta operación
  const totalNecesario = Number(
    (abono_interes + abono_mora + abono_capital).toFixed(2)
  );

  await conn.rollback();
  return res.status(400).json({
    error: 'Monto excede el saldo. Debe pagar el monto exacto para finalizar.',
    total_necesario: totalNecesario,
    excedente: Number(restante.toFixed(2))
  });
}


    // ======================================================
    // ACTUALIZAR CAPITAL CUOTA
    // ======================================================
    let nuevoCapitalCuota =
      Number(cuota.capital_pendiente) - abono_capital;

    if (nuevoCapitalCuota < 0) nuevoCapitalCuota = 0;

    await conn.query(
      `
      UPDATE cuotas
      SET capital_pendiente = ?,
          estado = ?
      WHERE id_cuota = ?
      `,
      [
        nuevoCapitalCuota,
        nuevoCapitalCuota === 0 ? 'pagada' : 'pendiente',
        id_cuota
      ]
    );

    // ======================================================
    // ACTUALIZAR CAPITAL CONTRATO
    // ======================================================
    let nuevoCapitalContrato =
      Number(contrato.capital_pendiente) - abono_capital;

    if (nuevoCapitalContrato < 0) nuevoCapitalContrato = 0;

    await conn.query(
      `
      UPDATE contratos
      SET capital_pendiente = ?
      WHERE id_contrato = ?
      `,
      [nuevoCapitalContrato, contrato.id_contrato]
    );

    // ======================================================
    // INSERTAR PAGO
    // ======================================================
    const [pagoResult] = await conn.query(
      `
      INSERT INTO pagos
      (id_cuota, fecha_abono, fecha_recibo,
       forma_pago, banco,
       abono_capital, abono_interes, abono_mora,
       monto_total, numero_recibo)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      `,
      [
        id_cuota,
        fecha_abono,
        fecha_recibo || fecha_abono,
        forma_pago,
        banco || null,
        abono_capital,
        abono_interes,
        abono_mora,
        monto_pagado,
        numero_recibo || null
      ]
    );

    // ======================================================
    // CANCELAR CONTRATO SI SE LIQUIDA
    // ======================================================
    if (nuevoCapitalContrato === 0) {
      await conn.query(
        `UPDATE contratos SET estado = 'cancelado' WHERE id_contrato = ?`,
        [contrato.id_contrato]
      );

      await conn.query(
        `UPDATE lotes SET estado = 'vendido' WHERE id_lote = ?`,
        [contrato.id_lote]
      );
    }

    await conn.commit();

    res.json({
      ok: true,
      id_pago: pagoResult.insertId,
      detalle: {
        abono_capital,
        abono_interes,
        abono_mora
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('ERROR REGISTRAR PAGO:', error);
    res.status(500).json({ error: 'Error al registrar pago' });
  } finally {
    conn.release();
  }
};

// ===============================
// REGISTRAR PAGO MASIVO
// ===============================
exports.registrarPagoMasivo = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      id_contrato,
      cuota_desde,
      cuota_hasta,
      fecha_abono,
      fecha_recibo,
      forma_pago,
      banco,
      numero_recibo,
      mora_total_manual,
      interes_total_manual
    } = req.body;
    const fechaAbonoBaseYMD = normalizarFechaYMD(fecha_abono);

    if (!id_contrato || !cuota_hasta || !fecha_abono || !forma_pago) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!fechaAbonoBaseYMD) {
      return res.status(400).json({ error: 'Fecha de abono invalida' });
    }

    if (forma_pago !== 'Efectivo' && !banco) {
      return res.status(400).json({
        error: 'Banco obligatorio para esta forma de pago'
      });
    }

    const idContrato = Number(id_contrato);
    const cuotaDesdeSolicitada = Number(cuota_desde || 0);
    const cuotaHasta = Number(cuota_hasta);

    if (!Number.isInteger(cuotaHasta) || cuotaHasta <= 0) {
      return res.status(400).json({ error: 'Cuota final invalida' });
    }

    let moraRestante = Number(mora_total_manual || 0);
    let interesRestante = Number(interes_total_manual || 0);

    if (isNaN(moraRestante) || moraRestante < 0) {
      return res.status(400).json({ error: 'Mora manual invalida' });
    }
    if (isNaN(interesRestante) || interesRestante < 0) {
      return res.status(400).json({ error: 'Interes manual invalido' });
    }

    moraRestante = Number(moraRestante.toFixed(2));
    interesRestante = Number(interesRestante.toFixed(2));

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

    await conn.beginTransaction();

    const [[contrato]] = await conn.query(
      `SELECT * FROM contratos WHERE id_contrato = ? FOR UPDATE`,
      [idContrato]
    );

    if (!contrato) {
      await conn.rollback();
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (Number(contrato.capital_pendiente) <= 0) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Este contrato ya no tiene saldo pendiente'
      });
    }

    const [[ultimoPagoContrato]] = await conn.query(
      `
      SELECT DATE_FORMAT(MAX(p.fecha_abono), '%Y-%m-%d') AS ultima_fecha_abono
      FROM pagos p
      JOIN cuotas cu ON cu.id_cuota = p.id_cuota
      WHERE cu.id_contrato = ?
      `,
      [idContrato]
    );

    if (
      ultimoPagoContrato?.ultima_fecha_abono &&
      fechaAbonoBaseYMD < ultimoPagoContrato.ultima_fecha_abono
    ) {
      await conn.rollback();
      return res.status(400).json({
        error:
          `La fecha inicial de abono no puede ser menor al ultimo pago registrado ` +
          `(${ultimoPagoContrato.ultima_fecha_abono})`
      });
    }

    const [[primeraPendiente]] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND estado IN ('pendiente', 'atrasada')
        AND capital_pendiente > 0
      ORDER BY numero_cuota
      LIMIT 1
      FOR UPDATE
      `,
      [idContrato]
    );

    if (!primeraPendiente) {
      await conn.rollback();
      return res.status(400).json({
        error: 'No existen cuotas pendientes para este contrato'
      });
    }

    const cuotaDesdeReal = Number(primeraPendiente.numero_cuota);

    if (cuotaDesdeSolicitada && cuotaDesdeSolicitada !== cuotaDesdeReal) {
      await conn.rollback();
      return res.status(400).json({
        error: `Debe iniciar desde la primera cuota pendiente (${cuotaDesdeReal})`
      });
    }

    if (cuotaHasta < cuotaDesdeReal) {
      await conn.rollback();
      return res.status(400).json({
        error: `La cuota final debe ser mayor o igual a ${cuotaDesdeReal}`
      });
    }

    const [cuotasRango] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND numero_cuota BETWEEN ? AND ?
      ORDER BY numero_cuota
      FOR UPDATE
      `,
      [idContrato, cuotaDesdeReal, cuotaHasta]
    );

    if (!cuotasRango.length) {
      await conn.rollback();
      return res.status(400).json({
        error: 'No hay cuotas en el rango solicitado'
      });
    }

    let esperada = cuotaDesdeReal;
    for (const cuota of cuotasRango) {
      if (Number(cuota.numero_cuota) !== esperada) {
        await conn.rollback();
        return res.status(400).json({
          error: `No se permiten saltos de cuotas. Falta la cuota ${esperada}`
        });
      }
      esperada += 1;
    }

    for (const cuota of cuotasRango) {
      if (cuota.estado === 'pagada' || Number(cuota.capital_pendiente) <= 0) {
        await conn.rollback();
        return res.status(400).json({
          error: 'El rango contiene cuotas ya pagadas; no se puede dejar huecos'
        });
      }
    }

    const pagosInsertados = [];
    let capitalTotalAplicado = 0;
    let montoTotalPagado = 0;
    let totalMoraAplicada = 0;
    let totalInteresAplicado = 0;

    for (let i = 0; i < cuotasRango.length; i += 1) {
      const cuota = cuotasRango[i];
      const capitalCuota = Number(cuota.capital_pendiente || 0);
      const topeExtrasCuota = Number(cuota.monto_cuota || capitalCuota);
      const fechaAbonoFila = sumarMesesISO(fecha_abono, i);
      const fechaReciboBase = fecha_recibo || fecha_abono;
      const fechaReciboFila = sumarMesesISO(fechaReciboBase, i);

      let abonoMora = 0;
      if (moraRestante > 0) {
        abonoMora = Math.min(moraRestante, topeExtrasCuota);
        abonoMora = Number(abonoMora.toFixed(2));
        moraRestante = Number((moraRestante - abonoMora).toFixed(2));
      }

      let abonoInteres = 0;
      const capacidadInteres = Number((topeExtrasCuota - abonoMora).toFixed(2));
      if (interesRestante > 0 && capacidadInteres > 0) {
        abonoInteres = Math.min(interesRestante, capacidadInteres);
        abonoInteres = Number(abonoInteres.toFixed(2));
        interesRestante = Number((interesRestante - abonoInteres).toFixed(2));
      }

      const montoTotalFila = Number(
        (capitalCuota + abonoMora + abonoInteres).toFixed(2)
      );

      const numeroReciboFila = numero_recibo
        ? `${numero_recibo}-C${cuota.numero_cuota}`
        : null;

      const [pagoResult] = await conn.query(
        `
        INSERT INTO pagos
        (id_cuota, fecha_abono, fecha_recibo,
         forma_pago, banco,
         abono_capital, abono_interes, abono_mora,
         monto_total, numero_recibo)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
          cuota.id_cuota,
          fechaAbonoFila,
          fechaReciboFila,
          forma_pago,
          banco || null,
          capitalCuota,
          abonoInteres,
          abonoMora,
          montoTotalFila,
          numeroReciboFila
        ]
      );

      await conn.query(
        `
        UPDATE cuotas
        SET capital_pendiente = 0,
            estado = 'pagada'
        WHERE id_cuota = ?
        `,
        [cuota.id_cuota]
      );

      capitalTotalAplicado = Number((capitalTotalAplicado + capitalCuota).toFixed(2));
      montoTotalPagado = Number((montoTotalPagado + montoTotalFila).toFixed(2));
      totalMoraAplicada = Number((totalMoraAplicada + abonoMora).toFixed(2));
      totalInteresAplicado = Number((totalInteresAplicado + abonoInteres).toFixed(2));

      pagosInsertados.push({
        id_pago: pagoResult.insertId,
        id_cuota: cuota.id_cuota,
        numero_cuota: cuota.numero_cuota,
        abono_capital: capitalCuota,
        abono_mora: abonoMora,
        abono_interes: abonoInteres,
        monto_total: montoTotalFila
      });
    }

    if (moraRestante > 0 || interesRestante > 0) {
      await conn.rollback();
      return res.status(400).json({
        error: 'La mora/interes manual excede la capacidad del rango seleccionado',
        mora_restante: Number(moraRestante.toFixed(2)),
        interes_restante: Number(interesRestante.toFixed(2))
      });
    }

    let nuevoCapitalContrato =
      Number(contrato.capital_pendiente) - capitalTotalAplicado;

    if (nuevoCapitalContrato < 0) {
      nuevoCapitalContrato = 0;
    }

    await conn.query(
      `
      UPDATE contratos
      SET capital_pendiente = ?
      WHERE id_contrato = ?
      `,
      [nuevoCapitalContrato, idContrato]
    );

    if (nuevoCapitalContrato === 0) {
      await conn.query(
        `UPDATE contratos SET estado = 'cancelado' WHERE id_contrato = ?`,
        [idContrato]
      );

      await conn.query(
        `UPDATE lotes SET estado = 'vendido' WHERE id_lote = ?`,
        [contrato.id_lote]
      );
    }

    await conn.commit();

    res.json({
      ok: true,
      resumen: {
        id_contrato: idContrato,
        cuota_desde: cuotaDesdeReal,
        cuota_hasta: cuotaHasta,
        cuotas_pagadas: cuotasRango.length,
        capital_pagado: capitalTotalAplicado,
        mora_pagada: totalMoraAplicada,
        interes_pagado: totalInteresAplicado,
        monto_total_pagado: montoTotalPagado,
        capital_pendiente_contrato: nuevoCapitalContrato
      },
      pagos: pagosInsertados
    });
  } catch (error) {
    await conn.rollback();
    console.error('ERROR REGISTRAR PAGO MASIVO:', error);
    res.status(500).json({ error: 'Error al registrar pago masivo' });
  } finally {
    conn.release();
  }
};

exports.buscarPorCodigoLote = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const codigoRaw = req.body?.codigo;
    const codigo = String(codigoRaw || '')
      .toUpperCase()
      .replace(/\s+/g, '');

    if (!codigo) {
      return res.status(400).json({ error: 'Código requerido' });
    }

    /**
     * FORMATO ESPERADO:
     * 001A1
     * 001 → id_lotificacion
     * A   → nombre_poligono
     * 1   → numero_lote
     */
    const match = codigo.match(/^(\d+)([A-Z]+)(\d+)$/);

    if (!match) {
      return res.status(400).json({
        error: 'Formato inválido. Ej: 001A1'
      });
    }

    const id_lotificacion = Number(match[1].replace(/^0+/, '') || '0');
    const nombre_poligono = match[2];
    const numero_lote = Number(match[3]);

    if (!id_lotificacion || !numero_lote) {
      return res.status(400).json({
        error: 'CÃ³digo invÃ¡lido. Revise lotificaciÃ³n y nÃºmero de lote'
      });
    }

    // ===============================
    // BUSCAR LOTE
    // ===============================
    const [[lote]] = await conn.query(
      `
      SELECT
        l.id_lote,
        l.numero_lote,
        lo.nombre AS lotificacion,
        p.nombre_poligono AS poligono
      FROM lotes l
      JOIN poligonos p ON p.id_poligono = l.id_poligono
      JOIN lotificaciones lo ON lo.id_lotificacion = p.id_lotificacion
      WHERE p.id_lotificacion = ?
        AND (
          UPPER(REPLACE(TRIM(p.nombre_poligono), ' ', '')) = ?
          OR UPPER(REPLACE(REPLACE(TRIM(p.nombre_poligono), 'POL.', ''), ' ', '')) = ?
          OR UPPER(REPLACE(REPLACE(TRIM(p.nombre_poligono), 'POL', ''), ' ', '')) = ?
        )
        AND l.numero_lote = ?
      `,
      [
        id_lotificacion,
        nombre_poligono,
        nombre_poligono,
        nombre_poligono,
        numero_lote
      ]
    );

    if (!lote) {
      return res.status(404).json({
        error: 'Lote no encontrado'
      });
    }

    // ===============================
    // BUSCAR CONTRATO ACTIVO
    // ===============================
    const [[contrato]] = await conn.query(
      `
      SELECT *
      FROM contratos
      WHERE id_lote = ?
        AND estado = 'activo'
      `,
      [lote.id_lote]
    );

    if (!contrato) {
      return res.status(404).json({
        error: 'El lote no tiene contrato activo'
      });
    }

    // ===============================
    // OBTENER CLIENTE
    // ===============================
    const [[cliente]] = await conn.query(
      `
      SELECT id_cliente,
             CONCAT(nombres, ' ', apellidos) AS nombre
      FROM cliente
      WHERE id_cliente = ?
      `,
      [contrato.id_cliente]
    );

    // ===============================
    // PRIMERA CUOTA NO PAGADA
    // ===============================
    const [[cuota]] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND estado != 'pagada'
      ORDER BY numero_cuota
      LIMIT 1
      `,
      [contrato.id_contrato]
    );

    if (!cuota) {
      return res.status(200).json({
        cliente,
        lote,
        contrato,
        cuota: null,
        mensaje: 'Contrato al día'
      });
    }

    // ===============================
    // CALCULAR INTERÉS O PENALIZACIÓN
    // ===============================

    let interes = 0;
    let penalizacion = 0;
    let diasAtraso = 0;

    const hoy = new Date();
    const vencimiento = new Date(cuota.fecha_vencimiento);

    if (hoy > vencimiento) {
      const diffTime = hoy - vencimiento;
      diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // ===== INTERÉS SOBRE SALDO (30/360)
    if (contrato.tipo_financiamiento === 'interes_saldo') {

      const tasa = contrato.tasa_interes_anual / 100;

      if (contrato.tipo_financiamiento === 'interes_saldo') {

  const fechaReferencia = new Date(); // o fecha_abono si usas retroactivo
  const vencimiento = new Date(cuota.fecha_vencimiento);

  if (fechaReferencia > vencimiento) {

    const diasAtraso = Math.floor(
      (fechaReferencia - vencimiento) / (1000 * 60 * 60 * 24)
    );

    if (diasAtraso > contrato.dias_gracia) {

      const tasa = contrato.tasa_interes_anual / 100;

      penalizacion =
        (Number(cuota.monto_cuota) * tasa * diasAtraso) / 360;

      penalizacion = Number(penalizacion.toFixed(2));
    }
  }
}


    }

    // ===== PENALIZACIÓN FIJA
    if (contrato.tipo_financiamiento === 'penalizacion_fija') {

      if (diasAtraso > contrato.dias_gracia) {
        penalizacion = Number(contrato.penalizacion_fija || 0);
      }

    }

    const capital = Number(cuota.capital_pendiente || 0);
    const interesNum = Number(interes || 0);
    const penalizacionNum = Number(penalizacion || 0);

    const totalPagar = Number(
      (
        capital +
        interesNum +
        penalizacionNum
      ).toFixed(2)
    );

    res.json({
      cliente,
      lote,
      contrato,
      cuota,
      interes: Number(interesNum.toFixed(2)),
      penalizacion: Number(penalizacionNum.toFixed(2)),
      dias_atraso: diasAtraso,
      total_pagar: totalPagar
    });

  } catch (error) {
    console.error('ERROR BUSCAR POR CÓDIGO:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  } finally {
    conn.release();
  }
};
exports.pagosPorContrato = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'ID de contrato requerido'
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        p.id_pago,
        p.fecha_abono,
        p.monto_total,
        p.abono_capital,
        p.abono_interes,
        p.abono_mora,
        p.forma_pago,
        p.banco,
        p.fecha_recibo,
        cu.numero_cuota,
        d.ruta_archivo
      FROM pagos p
      JOIN cuotas cu ON p.id_cuota = cu.id_cuota
      LEFT JOIN documentos d
        ON d.id_pago = p.id_pago
        AND d.tipo_documento = 'comprobante'
      WHERE cu.id_contrato = ?
      ORDER BY p.fecha_abono DESC, p.id_pago DESC
      `,
      [id]
    );

    res.json(rows);

  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({
      error: 'Error al obtener pagos'
    });
  }
};
exports.estadoContrato = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;

    const [[contrato]] = await conn.query(
      `SELECT *
       FROM contratos
       WHERE id_contrato = ?`,
      [id]
    );

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    if (Number(contrato.capital_pendiente) <= 0) {
    await conn.rollback();
    return res.status(400).json({
    error: 'Este contrato ya no tiene saldo pendiente.'
    });
    }
    const [[cuota]] = await conn.query(
      `SELECT *
       FROM cuotas
       WHERE id_contrato = ?
         AND estado IN ('pendiente','atrasada')
       ORDER BY numero_cuota
       LIMIT 1`,
      [id]
    );
   
    if (!cuota) {
      return res.json({
        contrato,
        cuota: null
      });
    }

    res.json({
      contrato,
      cuota
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estado' });
  } finally {
    conn.release();
  }
};




