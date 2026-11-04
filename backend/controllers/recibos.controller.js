const db = require('../config/db');

// =====================================
// OBTENER RECIBO POR ID DE PAGO
// =====================================
exports.obtenerReciboPorPago = async (req, res) => {
  const { id_pago } = req.params;

  try {

    // ===============================
    // 1️⃣ PAGO + CUOTA + CONTRATO
    // ===============================
    const [pagoRows] = await db.query(`
      SELECT
        p.id_pago,
        p.monto_total,
        p.abono_capital,
        p.abono_interes,
        p.abono_mora,
        p.forma_pago,
        p.banco,
        p.fecha_abono,
        p.fecha_recibo,
        c.monto_cuota,
        c.id_contrato
      FROM pagos p
      JOIN cuotas c ON p.id_cuota = c.id_cuota
      WHERE p.id_pago = ?
    `, [id_pago]);

    if (pagoRows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const pago = pagoRows[0];

    // ===============================
    // 2️⃣ CONTRATO + CLIENTE + LOTE
    // ===============================
    const [contratoRows] = await db.query(`
      SELECT
        ct.monto_financiado,
        ct.prima,
        cl.nombres,
        cl.direccion,
        cl.dui,
        cl.nit,
        cl.telefono,
        l.numero_lote,
        pz.nombre_poligono,
        lo.id_lotificacion,
        lo.nombre AS lotificacion
      FROM contratos ct
      JOIN cliente cl ON ct.id_cliente = cl.id_cliente
      JOIN lotes l ON ct.id_lote = l.id_lote
      JOIN poligonos pz ON l.id_poligono = pz.id_poligono
      JOIN lotificaciones lo ON pz.id_lotificacion = lo.id_lotificacion
      WHERE ct.id_contrato = ?
    `, [pago.id_contrato]);

    if (contratoRows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const contrato = contratoRows[0];

    // ===============================
    // CÓDIGO DEL LOTE (001A1)
    // ===============================
    const codigoLote =
      String(contrato.id_lotificacion).padStart(3, '0') +
      contrato.nombre_poligono +
      contrato.numero_lote;

    // ===============================
    // 3️⃣ TOTAL CAPITAL PAGADO HASTA ESTE PAGO
    // ===============================
    const [capitalRows] = await db.query(`
      SELECT COALESCE(SUM(p.abono_capital),0) AS total_capital
      FROM pagos p
      JOIN cuotas c ON p.id_cuota = c.id_cuota
      WHERE c.id_contrato = ?
        AND p.id_pago <= ?
    `, [pago.id_contrato, id_pago]);

    const totalCapitalPagado = Number(capitalRows[0].total_capital || 0);

    const prima = Number(contrato.prima || 0);

    // ===============================
    // 4️⃣ CÁLCULO DE SALDOS (PROFESIONAL)
    // ===============================

    const capitalAntes =
      totalCapitalPagado - Number(pago.abono_capital);

    const saldoAnterior =
      Number(contrato.monto_financiado) - capitalAntes;

    const saldoActual =
      Number(contrato.monto_financiado) - totalCapitalPagado;

    const saldoAcumulado =
      prima + totalCapitalPagado;

    // ===============================
    // 5️⃣ MONTO A LETRAS
    // ===============================
    const cantidadLetras = convertirNumeroALetras(
      Number(pago.monto_total)
    );

    // ===============================
    // 6️⃣ RESPUESTA FINAL
    // ===============================
    res.json({

      cliente: {
        nombre: contrato.nombres,
        direccion: contrato.direccion || '',
        documento: [contrato.dui, contrato.nit]
          .filter(Boolean)
          .join(' / '),
        telefono: contrato.telefono || '',
        codigo_lote: codigoLote
      },
      pago: {
  cuota_mensual: Number(pago.monto_cuota),
  abono_total: Number(pago.monto_total),
  forma_pago: pago.forma_pago,
  banco: pago.banco || '',
  fecha_abono: pago.fecha_abono,
  fecha_recibo: pago.fecha_recibo,
  mora_x_cuotas:
    Number(pago.abono_interes || 0) +
    Number(pago.abono_mora || 0)
},
      saldos: {
        saldo_anterior: saldoAnterior,
        menos_abono: Number(pago.abono_capital),
        saldo_actual: saldoActual,
        saldo_acumulado: saldoAcumulado
      },

      texto: {
        cantidad_letras: cantidadLetras,
        concepto: [
          'Abono a cuenta de lote',
          `Lotificación ${contrato.lotificacion} / ${contrato.nombre_poligono} / Lote ${contrato.numero_lote}`
        ]
      }

    });

  } catch (error) {
    console.error('Error al generar recibo:', error);
    res.status(500).json({ error: 'Error al generar el recibo' });
  }
};

exports.obtenerReciboPrima = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pp.id_pago_prima, pp.monto_total, pp.forma_pago, pp.banco,
        pp.fecha_abono, pp.fecha_recibo, pp.numero_recibo,
        ct.precio_total, ct.prima, ct.monto_financiado,
        cl.nombres, cl.direccion, cl.dui, cl.nit, cl.telefono,
        l.numero_lote, p.nombre_poligono, lo.id_lotificacion, lo.nombre AS lotificacion
       FROM pagos_prima pp
       JOIN contratos ct ON ct.id_contrato = pp.id_contrato
       JOIN cliente cl ON cl.id_cliente = ct.id_cliente
       JOIN lotes l ON l.id_lote = ct.id_lote
       JOIN poligonos p ON p.id_poligono = l.id_poligono
       JOIN lotificaciones lo ON lo.id_lotificacion = p.id_lotificacion
       WHERE pp.id_pago_prima = ?
       LIMIT 1`,
      [req.params.id_pago_prima]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Pago de prima no encontrado.' });
    }

    const row = rows[0];
    const monto = Number(row.monto_total);
    const codigoLote =
      String(row.id_lotificacion).padStart(3, '0') +
      row.nombre_poligono +
      row.numero_lote;

    return res.json({
      cliente: {
        nombre: row.nombres,
        direccion: row.direccion || '',
        documento: [row.dui, row.nit].filter(Boolean).join(' / '),
        telefono: row.telefono || '',
        codigo_lote: codigoLote
      },
      pago: {
        cuota_mensual: monto,
        abono_total: monto,
        forma_pago: row.forma_pago,
        banco: row.banco || '',
        fecha_abono: row.fecha_abono,
        fecha_recibo: row.fecha_recibo,
        mora_x_cuotas: 0
      },
      saldos: {
        saldo_anterior: Number(row.precio_total),
        menos_abono: monto,
        saldo_actual: Number(row.monto_financiado),
        saldo_acumulado: monto
      },
      texto: {
        cantidad_letras: convertirNumeroALetras(monto),
        concepto: [
          'Pago de prima de lote',
          `Lotificación ${row.lotificacion} / ${row.nombre_poligono} / Lote ${row.numero_lote}`
        ]
      }
    });
  } catch (error) {
    console.error('Error al generar recibo de prima:', error);
    return res.status(500).json({ error: 'No se pudo generar el recibo de prima.' });
  }
};


function convertirNumeroALetras(numero) {
  const unidades = [
    '', 'UNO', 'DOS', 'TRES', 'CUATRO',
    'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'
  ];

  const decenas = [
    '', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA',
    'CINCUENTA', 'SESENTA', 'SETENTA',
    'OCHENTA', 'NOVENTA'
  ];

  function convertir(n) {
    if (n < 10) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return decenas[d] + (u ? ` Y ${unidades[u]}` : '');
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const r = n % 100;
      return (c === 1 ? 'CIEN' : unidades[c] + 'CIENTOS') +
        (r ? ` ${convertir(r)}` : '');
    }
    if (n < 1_000_000) {
      const miles = Math.floor(n / 1000);
      const resto = n % 1000;
      return (miles === 1 ? 'MIL' : `${convertir(miles)} MIL`) +
        (resto ? ` ${convertir(resto)}` : '');
    }
    const millones = Math.floor(n / 1_000_000);
    const resto = n % 1_000_000;
    return (millones === 1 ? 'UN MILLON' : `${convertir(millones)} MILLONES`) +
      (resto ? ` ${convertir(resto)}` : '');
  }

  const entero = Math.floor(numero);
  const centavos = Math.round((numero - entero) * 100);

  return `${convertir(entero)} ${String(centavos).padStart(2, '0')}/100 DÓLARES`;
}
