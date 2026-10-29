const API_LOTIFICACIONES = 'http://localhost:3000/api/lotificaciones';
let lotificacionesCache = [];
let lotificacionActual = null;
let poligonoActual = null;
let lotificacionEditando = null;
let poligonoEditando = null;
let loteEditando = null;
let poligonosCache = [];
const lotesCache = {};

// Al cerrar un modal se sale del modo edicion
[
  ['modalLotificacion', 'formLotificacion', 'Nueva Lotificacion', () => { lotificacionEditando = null; }],
  ['modalPoligono', 'formPoligono', 'Nuevo Poligono', () => { poligonoEditando = null; }],
  ['modalLote', 'formLote', 'Nuevo Lote', () => { loteEditando = null; }]
].forEach(([idModal, idForm, titulo, limpiar]) => {
  document.getElementById(idModal).addEventListener('hidden.bs.modal', () => {
    document.getElementById(idForm).reset();
    document.querySelector(`#${idModal} .modal-title`).textContent = titulo;
    limpiar();
  });
});

function abrirModalEdicion(idModal, titulo) {
  document.querySelector(`#${idModal} .modal-title`).textContent = titulo;
  bootstrap.Modal.getOrCreateInstance(document.getElementById(idModal)).show();
}

document.addEventListener('DOMContentLoaded', () => {
  cargarLotificaciones();

  const form = document.getElementById('formLotificacion');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      guardarLotificacion();
    });
  }
});
async function guardarLotificacion() {
  const form = document.getElementById('formLotificacion');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = {
    nombre: document.getElementById('nombreLot').value.trim(),
    ubicacion: document.getElementById('ubicacionLot').value.trim(),
    descripcion: document.getElementById('descripcionLot').value.trim()
  };

  try {
    const url = lotificacionEditando
      ? `${API_LOTIFICACIONES}/${lotificacionEditando}`
      : API_LOTIFICACIONES;

    const res = await fetch(url, {
      method: lotificacionEditando ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Error al guardar');

    mostrarMensajeLotificacion(
      lotificacionEditando ? 'Lotificación actualizada correctamente' : 'Lotificación guardada correctamente',
      'success'
    );
    form.reset();

    const modal = bootstrap.Modal.getInstance(
      document.getElementById('modalLotificacion')
    );
    modal.hide();

    cargarLotificaciones();
  } catch (error) {
    console.error(error);
    mostrarMensajeLotificacion('Error al guardar lotificación', 'danger');
  }
}
document.getElementById('formPoligono').addEventListener('submit', async e => {
  e.preventDefault();

  const nombre = document.getElementById('nombrePoligono').value.trim();

  const url = poligonoEditando
    ? `http://localhost:3000/api/poligonos/${poligonoEditando}`
    : 'http://localhost:3000/api/poligonos';

  const res = await fetch(url, {
    method: poligonoEditando ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_lotificacion: lotificacionActual,
      nombre
    })
  });

  if (!res.ok) {
    alert('Error al guardar polígono');
    return;
  }

  document.getElementById('formPoligono').reset();
  bootstrap.Modal.getInstance(document.getElementById('modalPoligono')).hide();

  cargarPoligonos(lotificacionActual);
});

async function cargarLotificaciones() {
  try {
    const res = await fetch(API_LOTIFICACIONES);
    const data = await res.json();

    if (!Array.isArray(data)) return;

    lotificacionesCache = data;
    renderLotificaciones(lotificacionesCache);
  } catch (error) {
    console.error('Error cargando lotificaciones:', error);
  }
}
function renderPoligonos(poligonos) {
  const cont = document.getElementById('accordionPoligonos');
  cont.innerHTML = '';
  poligonosCache = Array.isArray(poligonos) ? poligonos : [];

  if (!Array.isArray(poligonos) || poligonos.length === 0) {
    cont.innerHTML = '<em class="text-muted">Sin polígonos registrados</em>';
    return;
  }

  poligonos.forEach((p, i) => {
    cont.innerHTML += `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${i > 0 ? 'collapsed' : ''}"
                  data-bs-toggle="collapse"
                  data-bs-target="#pol${p.id_poligono}">
            ${p.nombre}
          </button>
        </h2>

        <div id="pol${p.id_poligono}" class="accordion-collapse collapse ${i === 0 ? 'show' : ''}">
          <div class="accordion-body">

            <div class="d-flex justify-content-between mb-2">
              <strong>Lotes</strong>
              <div>
                <button class="btn btn-sm btn-outline-primary"
                  onclick="editarPoligono(${p.id_poligono})">
                  Editar Polígono
                </button>
                <button class="btn btn-sm btn-success"
                  onclick="abrirModalLote(${p.id_poligono})">
                  Nuevo Lote
                </button>
              </div>
            </div>

            <div id="lotesPoligono${p.id_poligono}">
              <em class="text-muted">Cargando lotes...</em>
            </div>

          </div>
        </div>
      </div>
    `;

    // 🔑 CLAVE: cargar los lotes del polígono
    cargarLotes(p.id_poligono);
  });
}


async function cargarPoligonos(idLotificacion) {
  const res = await fetch(`http://localhost:3000/api/poligonos/lotificacion/${idLotificacion}`);
  const poligonos = await res.json();

  renderPoligonos(poligonos);
}

function renderLotificaciones(lots) {
  const tbody = document.getElementById('tablaLotificaciones');
  tbody.innerHTML = '';

  lots.forEach(l => {
    tbody.innerHTML += `
      <tr>
        <td>${l.id_lotificacion}</td>
        <td>${l.nombre}</td>
        <td>${l.ubicacion}</td>
        <td>
          <button class="btn btn-sm btn-secondary"
            onclick="verDetalleLotificacion(${l.id_lotificacion})"
            data-bs-toggle="modal"
            data-bs-target="#modalDetalleLotificacion">
            Ver
          </button>
          <button class="btn btn-sm btn-outline-primary"
            onclick="editarLotificacion(${l.id_lotificacion})">
            Editar
          </button>
        </td>
      </tr>
    `;
  });
}

async function verDetalleLotificacion(id) {
  lotificacionActual = id;

  const res = await fetch(`${API_LOTIFICACIONES}/${id}`);
  const lot = await res.json();

  document.getElementById('detalleNombre').textContent = lot.nombre;
  document.getElementById('detalleUbicacion').textContent = lot.ubicacion;
  document.getElementById('detalleDescripcion').textContent = lot.descripcion || '';

  cargarPoligonos(id);
}
function editarLotificacion(id) {
  const l = lotificacionesCache.find(x => x.id_lotificacion === id);
  if (!l) return;

  document.getElementById('nombreLot').value = l.nombre || '';
  document.getElementById('ubicacionLot').value = l.ubicacion || '';
  document.getElementById('descripcionLot').value = l.descripcion || '';
  lotificacionEditando = id;
  abrirModalEdicion('modalLotificacion', 'Editar Lotificacion');
}

function editarPoligono(id) {
  const p = poligonosCache.find(x => x.id_poligono === id);
  if (!p) return;

  document.getElementById('nombrePoligono').value = p.nombre || '';
  poligonoEditando = id;
  abrirModalEdicion('modalPoligono', 'Editar Poligono');
}

function editarLote(idPoligono, idLote) {
  const l = (lotesCache[idPoligono] || []).find(x => x.id_lote === idLote);
  if (!l) return;

  document.getElementById('numeroLote').value = l.numero_lote;
  document.getElementById('areaLote').value = l.area ?? '';
  document.getElementById('unidadArea').value = l.unidad_area || 'v2';
  document.getElementById('precioBase').value = l.precio_base ?? '';
  document.getElementById('precioFinal').value = l.precio ?? '';
  document.getElementById('estadoLote').value = l.estado;
  poligonoActual = idPoligono;
  loteEditando = idLote;
  abrirModalEdicion('modalLote', `Editar Lote ${l.numero_lote}`);
}

function mostrarMensajeLotificacion(texto, tipo) {
  const div = document.getElementById('mensajeLotificacion');
  if (!div) return;

  div.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
      ${texto}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  setTimeout(() => {
    div.innerHTML = '';
  }, 3000);
}
function abrirModalLote(idPoligono) {
  poligonoActual = idPoligono;
  document.getElementById('lotePoligonoId').value = idPoligono;

  const modal = new bootstrap.Modal(document.getElementById('modalLote'));
  modal.show();
}
function renderLotes(idPoligono, lotes) {
  const cont = document.getElementById(`lotesPoligono${idPoligono}`);
  cont.innerHTML = '';
  lotesCache[idPoligono] = Array.isArray(lotes) ? lotes : [];

  if (!Array.isArray(lotes) || lotes.length === 0) {
    cont.innerHTML = '<em class="text-muted">Sin lotes</em>';
    return;
  }

  cont.innerHTML = `
    <table class="table table-sm table-bordered">
      <thead class="table-light">
        <tr>
          <th>Lote</th>
          <th>Área</th>
          <th>Unidad</th>
          <th>Precio base</th>
          <th>Precio final</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${lotes.map(l => `
          <tr>
            <td>${l.numero_lote}</td>
            <td>${l.area}</td>
            <td>${l.unidad_area}</td>
            <td>$${Number(l.precio_base).toLocaleString()}</td>
            <td>
              ${l.precio === null
                ? '<span class="text-muted">Pendiente</span>'
                : `$${Number(l.precio).toLocaleString()}`
              }
            </td>
            <td>
              <span class="badge bg-${estadoColor(l.estado)}">
                ${l.estado}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary"
                onclick="editarLote(${idPoligono}, ${l.id_lote})">
                Editar
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

document.getElementById('formLote').addEventListener('submit', async e => {
  e.preventDefault();

  const data = {
    id_poligono: poligonoActual,
    numero_lote: document.getElementById('numeroLote').value,
    area: document.getElementById('areaLote').value,
    unidad_area: document.getElementById('unidadArea').value,
    precio_base: document.getElementById('precioBase').value,
    precio: document.getElementById('precioFinal').value,
    estado: document.getElementById('estadoLote').value
  };

  const url = loteEditando
    ? `http://localhost:3000/api/lotes/${loteEditando}`
    : 'http://localhost:3000/api/lotes';

  const res = await fetch(url, {
    method: loteEditando ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Error al guardar lote');
    return;
  }

  document.getElementById('formLote').reset();
  bootstrap.Modal.getInstance(document.getElementById('modalLote')).hide();

  cargarLotes(poligonoActual);
});
async function cargarLotes(idPoligono) {
  const res = await fetch(`http://localhost:3000/api/lotes/poligono/${idPoligono}`);
  const lotes = await res.json();

  renderLotes(idPoligono, lotes);
}
function estadoColor(estado) {
  if (estado === 'disponible') return 'success';
  if (estado === 'promesa_venta') return 'warning';
  return 'danger';
}

