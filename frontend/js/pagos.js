const API_CONTRATOS = 'http://localhost:3000/api/contratos';

function parseFechaISOaLocal(fechaISO) {
  if (!fechaISO) return null;
  const texto = String(fechaISO).trim();

  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return new Date(y, m - 1, d);
  }

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  );
}

function formatearFechaCorta(fechaISO) {
  const fecha = parseFechaISOaLocal(fechaISO);
  if (!fecha) return '';
  return fecha.toLocaleDateString('es-SV');
}

function formatearFechaInput(fechaISO) {
  const fecha = parseFechaISOaLocal(fechaISO);
  if (!fecha) return '';
  const yy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function buscarClientePago() {
  const texto = document.getElementById('buscarClientePago').value.trim();
  if (!texto) return;

  const res = await fetch(`${API_CONTRATOS}/buscar-cliente/${texto}`);
  const clientes = await res.json();

  renderResultadosClientePago(clientes);
}
function renderResultadosClientePago(clientes) {
  const tbody = document.getElementById('tablaResultadosClientePago');
  tbody.innerHTML = '';

  if (!Array.isArray(clientes) || clientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">
          No se encontraron clientes
        </td>
      </tr>
    `;
    return;
  }

  clientes.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.id_cliente}</td>
        <td>${c.nombres} ${c.apellidos}</td>
        <td>${c.dui || ''}</td>
        <td>
          <button class="btn btn-sm btn-secondary"
            onclick="verContratosPago(${c.id_cliente})">
            Ver contratos
          </button>
        </td>
      </tr>
    `;
  });
}
async function verContratosPago(idCliente) {
  const res = await fetch(`${API_CONTRATOS}/cliente/${idCliente}`);
  const contratos = await res.json();

  renderContratosPago(contratos);
}
async function seleccionarContratoPago(idContrato) {

  try {

    const res = await fetch(
      `http://localhost:3000/api/pagos/estado/${idContrato}`
    );

    if (!res.ok) {
      throw new Error('Error al obtener estado de cuenta');
    }

    const data = await res.json();

    document.getElementById('idContratoActivo').value = idContrato;

    renderEstadoCuenta(data);
    actualizarContextoPagoMasivo(idContrato, data.cuota);

  } catch (error) {
    console.error('Error cargando estado:', error);
    alert('Error al actualizar estado de cuenta');
  }
}

function renderContratosPago(contratos) {
  const tbody = document.getElementById('tablaContratosPago');
  tbody.innerHTML = '';

  if (!Array.isArray(contratos) || contratos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          El cliente no tiene contratos
        </td>
      </tr>
    `;
    return;
  }

  contratos.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.id_contrato}</td>
        <td>${c.lotificacion} / ${c.poligono} / Lote ${c.numero_lote}</td>
        <td>${c.plazo_meses} meses</td>
        <td>
          <span class="badge bg-success">${c.estado}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary"
            onclick="seleccionarContratoPago(${c.id_contrato})">
            Ver cuotas
          </button>
        </td>
      </tr>
    `;
  });
}
function renderEstadoCuenta(data) {

  const tbody = document.getElementById('tablaEstadoCuenta');
  tbody.innerHTML = '';

  if (!data.cuota) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-success">
          Contrato al día ✅
        </td>
      </tr>
    `;
    return;
  }

  const c = data.cuota;

  tbody.innerHTML = `
    <tr>
      <td>${c.numero_cuota}</td>
      <td>${formatearFechaCorta(c.fecha_vencimiento)}</td>
      <td>$${Number(c.monto_cuota).toFixed(2)}</td>
      <td>$${Number(data.penalizacion || 0).toFixed(2)}</td>
      <td>
        <span class="badge ${
          data.estado_cuota === 'atrasada'
            ? 'bg-danger'
            : 'bg-warning'
        }">
          ${data.estado_cuota}
        </span>
      </td>
      <td>$${Number(data.total).toFixed(2)}</td>
      <td>
  <button
    class="btn btn-sm btn-success"
    onclick='prepararPago(
      ${c.id_cuota},
      ${c.numero_cuota},
      "${c.fecha_vencimiento}",
      ${c.monto_cuota},
      ${data.penalizacion || 0},
      ${c.id_contrato}
    )'>
    Pagar
  </button>
</td>

    </tr>
  `;
}
function prepararPago(
  idCuota,
  numeroCuota,
  fechaVencimiento,
  montoCuota,
  mora,
  idContrato
  
)
 {
  document.getElementById('pagoFecha')
  .setAttribute('data-vencimiento', fechaVencimiento);

  document.getElementById('pagoFecha')
  .setAttribute('data-tipo', window.tipoFinanciamiento);

  document.getElementById('pagoFecha')
  .setAttribute('data-capital', window.capitalPendiente);

  document.getElementById('pagoFecha')
  .setAttribute('data-tasa', window.tasaInteres || 0);

  document.getElementById('pagoFecha')
  .setAttribute('data-dias-gracia', window.diasGracia || 0);

  document.getElementById('pagoFecha')
  .setAttribute('data-penalizacion', window.penalizacionFija || 0);


  // Guardar IDs
  document.getElementById('idCuotaSeleccionada').value = idCuota;
  document.getElementById('idContratoActivo').value = idContrato;

  // Llenar campos informativos
  document.getElementById('pagoNumeroCuota').value = numeroCuota;
  document.getElementById('pagoVencimiento').value =
    formatearFechaCorta(fechaVencimiento);
  document.getElementById('pagoMontoCuota').value =
    Number(montoCuota).toFixed(2);
  document.getElementById('pagoMora').value =
    Number(mora).toFixed(2);

  // Sugerir total
  const total = Number(montoCuota) + Number(mora);
  document.getElementById('pagoMonto').value =
    total.toFixed(2);

  // Fecha automática
  const fechaSugerida = formatearFechaInput(fechaVencimiento);
  document.getElementById('pagoFecha').value = fechaSugerida;

  // Limpiar editables
  document.getElementById('pagoForma').value = '';
  document.getElementById('pagoBanco').value = '';
  document.getElementById('pagoRecibo').value = '';
  document.getElementById('pagoFechaRecibo').value = fechaSugerida;

  // Habilitar botones
  document.getElementById('btnRegistrarPago').disabled = false;
  document.getElementById('btnAdjuntarComprobante').disabled = false;
  // 🔹 Scroll suave al formulario
  document
    .getElementById('formPago')
    ?.scrollIntoView({ behavior: 'smooth' });

  // 🔥 IMPORTANTE: quitar foco del botón que llamó esta función
  if (document.activeElement) {
    document.activeElement.blur();
  }
 
}

async function buscarPorCodigoLote() {

  const codigo = document.getElementById('codigoLotePago').value.trim();

  if (!codigo) {
    alert('Ingrese el código del lote');
    return;
  }

  try {

    const res = await fetch(
      'http://localhost:3000/api/pagos/por-codigo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'No se pudo procesar el código');
      return;
    }

    // Mostrar bloque info rápida
    document.getElementById('infoPagoRapido')
      .classList.remove('d-none');

    document.getElementById('pagoRapidoCliente')
      .innerText = data.cliente.nombre;

    document.getElementById('pagoRapidoLote')
      .innerText =
      `${data.lote.lotificacion} / ${data.lote.poligono} / Lote ${data.lote.numero_lote}`;

    // Guardar contrato activo
    document.getElementById('idContratoActivo')
      .value = data.contrato.id_contrato;

    // 👇 IMPORTANTE
    renderEstadoCuenta(data);
    actualizarContextoPagoMasivo(data.contrato.id_contrato, data.cuota);

  } catch (err) {
    console.error(err);
    alert('Error de conexión con el servidor');
  }
}

async function subirComprobante(idPago) {
  const input = document.getElementById('inputComprobante');

  if (!input.files.length) {
    alert('Seleccione una imagen');
    return;
  }

  const formData = new FormData();
  formData.append('id_pago', idPago);
  formData.append('comprobante', input.files[0]);

  try {
    const res = await fetch(
      'http://localhost:3000/api/documentos/comprobante',
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || 'Error al subir comprobante');
      return;
    }

    // ✅ NO leer ruta_archivo aquí
    alert('Comprobante subido correctamente');

    // cerrar modal
    const modalElement = document.getElementById('modalComprobante');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    // Quitar foco del botón activo
    if (document.activeElement) {
    document.activeElement.blur();
    }
    modalInstance.hide(); 
    // limpiar preview
    document.getElementById('inputComprobante').value = '';
    document.getElementById('previewComprobante').classList.add('d-none');
    document.getElementById('previewPlaceholder').classList.remove('d-none');

  } catch (err) {
    console.error(err);
    alert('Error de conexión al subir comprobante');
  }
}
async function verComprobante(idPago) {
  const res = await fetch(
    `http://localhost:3000/api/documentos/comprobante/${idPago}`
  );

  const doc = await res.json();

  if (!doc) {
    alert('Este pago no tiene comprobante');
    return;
  }

  const img = document.getElementById('previewComprobante');
  const placeholder = document.getElementById('previewPlaceholder');

  img.src = `http://localhost:3000/${doc.ruta_archivo}`;
  img.classList.remove('d-none');
  placeholder.classList.add('d-none');

  new bootstrap.Modal(
    document.getElementById('modalComprobante')
  ).show();
}
let idPagoActual = null;

document.getElementById('formPago')
  .addEventListener('submit', async function (e) {

    e.preventDefault();

    const btn = document.getElementById('btnRegistrarPago');
    const idCuota = document.getElementById('idCuotaSeleccionada').value;

    if (!idCuota) {
      alert('Seleccione una cuota');
      return;
    }

    btn.disabled = true;
    btn.innerText = 'Procesando...';

    // 🔎 Normalizar monto (evitar coma decimal)
const montoInput = document.getElementById('pagoMonto').value
  .trim()
  .replace(',', '.');

const monto = parseFloat(montoInput);

if (isNaN(monto) || monto <= 0) {
  alert('Monto inválido');
  btn.disabled = false;
  btn.innerText = 'Registrar Pago';
  return;
}

const data = {
  id_cuota: Number(idCuota),
  monto_pagado: monto,
  fecha_abono: document.getElementById('pagoFecha').value,
  fecha_recibo: document.getElementById('pagoFechaRecibo').value,
  forma_pago: document.getElementById('pagoForma').value,
  banco: document.getElementById('pagoBanco').value || null,
  numero_recibo: document.getElementById('pagoRecibo').value
};


    try {

      const res = await fetch('http://localhost:3000/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      let result;

try {
  result = await res.json();
} catch (err) {
  const text = await res.text();
  console.error("RESPUESTA NO JSON:", text);
  throw new Error("Respuesta inválida del servidor");
}


      if (!res.ok) {

  // ✅ Caso especial: pago excede saldo (última cuota / último pago)
  if (result && typeof result.total_necesario !== 'undefined') {

    const totalNecesario = Number(result.total_necesario || 0);
    const excedente = Number(result.excedente || 0);

    alert(
      `⚠️ Pago excede el saldo.\n` +
      `Monto exacto para finalizar: $${totalNecesario.toFixed(2)}\n` +
      `Excedente: $${excedente.toFixed(2)}`
    );

    // ✅ Autollenar con el monto exacto para que solo le dé "Registrar Pago"
    const inputMonto = document.getElementById('pagoMonto');
    if (inputMonto) inputMonto.value = totalNecesario.toFixed(2);

  } else {
    alert(result?.error || 'Error al registrar pago');
  }

  btn.disabled = false;
  btn.innerText = 'Registrar Pago';
  return;
}


      idPagoActual = result.id_pago;

      document.getElementById('btnImprimirRecibo').disabled = false;
      document.getElementById('modalPagoId').innerText = result.id_pago;
      document.getElementById('modalRecibo').innerText = data.numero_recibo;

      // 🔄 Refrescar estado de cuenta
      const idContrato = document.getElementById('idContratoActivo').value;

      if (idContrato) {
        await seleccionarContratoPago(idContrato);
      }

      // 🧹 Limpiar formulario
      document.getElementById('formPago').reset();
      document.getElementById('idCuotaSeleccionada').value = '';
      document.getElementById('btnAdjuntarComprobante').disabled = true;

      btn.disabled = true;
      btn.innerText = 'Registrar Pago';

      // 🔵 Abrir modal SIEMPRE
      const modalElement = document.getElementById('modalComprobante');
      const modal = new bootstrap.Modal(modalElement);
      modal.show();

    } catch (error) {

      console.error('ERROR EN SUBMIT:', error);
      alert('Error de conexión con el servidor');

      btn.disabled = false;
      btn.innerText = 'Registrar Pago';
    }

  });


document.getElementById('btnAdjuntarComprobante')
  .addEventListener('click', () => {
    if (!idPagoActual) {
      alert('Primero registre el pago');
      return;
    }

    new bootstrap.Modal(
      document.getElementById('modalComprobante')
    ).show();
  });
 document
  .getElementById('btnImprimirRecibo')
  ?.addEventListener('click', function () {

    if (!idPagoActual) {
      alert('No hay pago para imprimir');
      return;
    }

    this.disabled = true;

    window.open(
      `recibo-print.html?id_pago=${idPagoActual}`,
      '_blank'
    );
  });
const inputComprobante = document.getElementById('inputComprobante');
if (inputComprobante) {
  inputComprobante.addEventListener('change', function () {

    const file = this.files[0];
    if (!file) return;

    const img = document.getElementById('previewComprobante');
    const placeholder = document.getElementById('previewPlaceholder');

    const reader = new FileReader();

    reader.onload = function (e) {
      img.src = e.target.result;
      img.classList.remove('d-none');
      placeholder.classList.add('d-none');
    };

    reader.readAsDataURL(file);
  });
}
const modalElement = document.getElementById('modalComprobante');

if (modalElement) {

  // Cuando el modal se termina de ocultar
  modalElement.addEventListener('hidden.bs.modal', function () {

    // Quitar foco de cualquier botón dentro del modal
    if (document.activeElement) {
      document.activeElement.blur();
    }

    // Opcional: devolver foco al botón principal
    const btnRegistrar = document.getElementById('btnRegistrarPago');
    if (btnRegistrar) {
      btnRegistrar.focus();
    }
  });
}
const inputFechaAbono = document.getElementById('pagoFecha');

if (inputFechaAbono) {

  inputFechaAbono.addEventListener('change', function () {

    const fechaPago = parseFechaISOaLocal(this.value);
    const fechaVenc = parseFechaISOaLocal(
      this.getAttribute('data-vencimiento')
    );

    if (!fechaPago || !fechaVenc) {
      return;
    }

    const tipo = this.getAttribute('data-tipo');
    const capital = Number(this.getAttribute('data-capital') || 0);
    const tasa = Number(this.getAttribute('data-tasa') || 0);
    const diasGracia = Number(this.getAttribute('data-dias-gracia') || 0);
    const penalizacionFija = Number(this.getAttribute('data-penalizacion') || 0);

    const montoCuota = Number(
      document.getElementById('pagoMontoCuota').value
    );

    let cargoExtra = 0;

    if (fechaPago > fechaVenc) {

      const diasAtraso = Math.floor(
        (fechaPago - fechaVenc) / (1000 * 60 * 60 * 24)
      );

      if (tipo === 'penalizacion_fija') {

        if (diasAtraso > diasGracia) {
          cargoExtra = penalizacionFija;
        }

      }

      if (tipo === 'interes_saldo') {

        if (diasAtraso > diasGracia) {

          const tasaDecimal = tasa / 100;

          cargoExtra =
            (capital * tasaDecimal * diasAtraso) / 360;

        }

      }

    }

    cargoExtra = Number(cargoExtra.toFixed(2));

    document.getElementById('pagoMora').value =
      cargoExtra.toFixed(2);

    const total = montoCuota + cargoExtra;

    document.getElementById('pagoMonto').value =
      total.toFixed(2);

  });

}

function actualizarContextoPagoMasivo(idContrato, cuotaPendiente) {
  const inputContrato = document.getElementById('pagoMasivoContrato');
  const inputDesde = document.getElementById('pagoMasivoDesde');
  const inputHasta = document.getElementById('pagoMasivoHasta');
  const inputFecha = document.getElementById('pagoMasivoFecha');
  const inputFechaRecibo = document.getElementById('pagoMasivoFechaRecibo');
  const btn = document.getElementById('btnRegistrarPagoMasivo');

  if (!inputContrato || !inputDesde || !inputHasta || !btn) {
    return;
  }

  if (!cuotaPendiente) {
    inputContrato.value = idContrato || '';
    inputDesde.value = '';
    inputHasta.value = '';
    btn.disabled = true;
    document.getElementById('resumenPagoMasivo').innerText =
      'Contrato al dia: no hay cuotas pendientes.';
    return;
  }

  const fechaSugerida =
    formatearFechaInput(cuotaPendiente.fecha_vencimiento) ||
    new Date().toISOString().split('T')[0];

  inputContrato.value = idContrato;
  inputDesde.value = Number(cuotaPendiente.numero_cuota);
  inputHasta.value = Number(cuotaPendiente.numero_cuota);
  inputHasta.min = Number(cuotaPendiente.numero_cuota);

  if (inputFecha) inputFecha.value = fechaSugerida;
  if (inputFechaRecibo) inputFechaRecibo.value = fechaSugerida;

  btn.disabled = false;
  actualizarResumenPagoMasivo();
}

function actualizarResumenPagoMasivo() {
  const elResumen = document.getElementById('resumenPagoMasivo');
  const desde = Number(document.getElementById('pagoMasivoDesde')?.value || 0);
  const hasta = Number(document.getElementById('pagoMasivoHasta')?.value || 0);
  const mora = Number(document.getElementById('pagoMasivoMora')?.value || 0);
  const interes = Number(document.getElementById('pagoMasivoInteres')?.value || 0);

  if (!elResumen) return;

  if (!desde || !hasta || hasta < desde) {
    elResumen.innerText = 'Defina un rango valido para pago multiple.';
    return;
  }

  const cuotas = (hasta - desde) + 1;
  elResumen.innerText =
    `Rango: cuota ${desde} a ${hasta} (${cuotas} cuotas). ` +
    `Mora manual: $${mora.toFixed(2)} | Interes manual: $${interes.toFixed(2)}`;
}

const formPagoMasivo = document.getElementById('formPagoMasivo');
if (formPagoMasivo) {
  formPagoMasivo.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btnRegistrarPagoMasivo');
    const idContrato = Number(document.getElementById('pagoMasivoContrato').value || 0);
    const cuotaDesde = Number(document.getElementById('pagoMasivoDesde').value || 0);
    const cuotaHasta = Number(document.getElementById('pagoMasivoHasta').value || 0);
    const formaPago = document.getElementById('pagoMasivoForma').value;
    const banco = document.getElementById('pagoMasivoBanco').value.trim();

    if (!idContrato || !cuotaDesde || !cuotaHasta) {
      alert('Seleccione primero un contrato con cuota pendiente');
      return;
    }

    if (cuotaHasta < cuotaDesde) {
      alert('La cuota final no puede ser menor que la cuota inicial');
      return;
    }

    if (formaPago !== 'Efectivo' && !banco) {
      alert('Banco obligatorio para esta forma de pago');
      return;
    }

    const payload = {
      id_contrato: idContrato,
      cuota_desde: cuotaDesde,
      cuota_hasta: cuotaHasta,
      fecha_abono: document.getElementById('pagoMasivoFecha').value,
      fecha_recibo: document.getElementById('pagoMasivoFechaRecibo').value,
      forma_pago: formaPago,
      banco: banco || null,
      numero_recibo: document.getElementById('pagoMasivoRecibo').value.trim(),
      mora_total_manual: Number(document.getElementById('pagoMasivoMora').value || 0),
      interes_total_manual: Number(document.getElementById('pagoMasivoInteres').value || 0)
    };

    if (!payload.fecha_abono || !payload.forma_pago || !payload.numero_recibo) {
      alert('Complete los campos obligatorios del pago multiple');
      return;
    }

    btn.disabled = true;
    btn.innerText = 'Procesando...';

    try {
      const res = await fetch('http://localhost:3000/api/pagos/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || 'Error al registrar pago multiple');
        btn.disabled = false;
        btn.innerText = 'Registrar Pago Multiple';
        return;
      }

      const resumen = result.resumen || {};
      alert(
        `Pago multiple registrado.\n` +
        `Cuotas pagadas: ${resumen.cuotas_pagadas || 0}\n` +
        `Capital: $${Number(resumen.capital_pagado || 0).toFixed(2)}\n` +
        `Mora: $${Number(resumen.mora_pagada || 0).toFixed(2)}\n` +
        `Interes: $${Number(resumen.interes_pagado || 0).toFixed(2)}\n` +
        `Total: $${Number(resumen.monto_total_pagado || 0).toFixed(2)}`
      );

      document.getElementById('pagoMasivoMora').value = '0';
      document.getElementById('pagoMasivoInteres').value = '0';
      document.getElementById('pagoMasivoRecibo').value = '';
      document.getElementById('pagoMasivoBanco').value = '';

      await seleccionarContratoPago(idContrato);
    } catch (error) {
      console.error('ERROR PAGO MASIVO:', error);
      alert('Error de conexion con el servidor');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Registrar Pago Multiple';
      actualizarResumenPagoMasivo();
    }
  });

  ['pagoMasivoHasta', 'pagoMasivoMora', 'pagoMasivoInteres']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', actualizarResumenPagoMasivo);
      }
    });
}


