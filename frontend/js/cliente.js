const API_CLIENTE = 'http://localhost:3002/api/cliente';
let clientesCache = [];
let clientesFiltrados = [];
let paginaActual = 1;
let clienteEnEdicion = null;
const pageSize = 20;
document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();

  const form = document.getElementById('formCliente');
  form.addEventListener('submit', e => {
    e.preventDefault();
    guardarCliente();
  });
  const buscador = document.getElementById('buscadorCliente');
  if (buscador) {
    buscador.addEventListener('input', filtrarClientes);
  }

  document.querySelector('[data-bs-target="#modalCliente"]').addEventListener('click', prepararNuevoCliente);
  document.getElementById('tablaClientes').addEventListener('click', e => {
    const boton = e.target.closest('[data-editar-cliente]');
    if (!boton) return;

    const cliente = clientesCache.find(c => c.id_cliente === Number(boton.dataset.editarCliente));
    if (!cliente) {
      mostrarMensaje('No se encontro el cliente seleccionado. Actualiza el listado e intenta de nuevo.', 'danger');
      return;
    }

    prepararEdicionCliente(cliente);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCliente')).show();
  });
});

function prepararNuevoCliente() {
  clienteEnEdicion = null;
  document.getElementById('formCliente').reset();
  document.getElementById('modalClienteLabel').textContent = 'Nuevo cliente';
  document.querySelector('#formCliente button[type="submit"]').innerHTML =
    '<i class="bi bi-check-lg cliente-icon me-1" aria-hidden="true"></i>Guardar cliente';
}

function prepararEdicionCliente(cliente) {
  clienteEnEdicion = cliente.id_cliente;
  document.getElementById('modalClienteLabel').textContent = 'Editar cliente';
  document.querySelector('#formCliente button[type="submit"]').innerHTML =
    '<i class="bi bi-check-lg cliente-icon me-1" aria-hidden="true"></i>Guardar cambios';
  document.getElementById('nombres').value = cliente.nombres || '';
  document.getElementById('apellidos').value = cliente.apellidos || '';
  document.getElementById('dui').value = cliente.dui || '';
  document.getElementById('nit').value = cliente.nit || '';
  document.getElementById('telefono').value = cliente.telefono || '';
  document.getElementById('direccion').value = cliente.direccion || '';
}

function guardarCliente() {
  const form = document.getElementById('formCliente');

  // Validación nativa HTML5
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = {
    nombres: document.getElementById('nombres').value.trim(),
    apellidos: document.getElementById('apellidos').value.trim(),
    dui: document.getElementById('dui').value.trim(),
    nit: document.getElementById('nit').value.trim() || null,
    telefono: document.getElementById('telefono').value.trim(),
    direccion: document.getElementById('direccion').value.trim()
  };

  const editando = clienteEnEdicion !== null;
  fetch(editando ? `${API_CLIENTE}/${clienteEnEdicion}` : API_CLIENTE, {
    method: editando ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al guardar');
      return res.json();
    })
    .then(() => {
      mostrarMensaje(editando ? 'Cliente actualizado correctamente' : 'Cliente guardado correctamente', 'success');
      form.reset();
      clienteEnEdicion = null;
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCliente')).hide();
      cargarClientes();
    })
    .catch(err => {
      console.error(err);
      mostrarMensaje('Error al guardar cliente', 'danger');
    });
}
function cargarClientes() {
  fetch(API_CLIENTE)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      clientesCache = data;
      clientesFiltrados = [...clientesCache];
      paginaActual = 1;
      renderClientesPaginado();
      renderPaginacionClientes();
    });
}
function renderClientes(clientes) {
  const tbody = document.getElementById('tablaClientes');
  tbody.replaceChildren();

  if (!clientes || clientes.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 5;
    celda.className = 'text-center text-muted py-5';
    celda.innerHTML = '<i class="bi bi-person-lines-fill cliente-empty-icon" aria-hidden="true"></i>';
    const mensaje = document.createElement('span');
    mensaje.textContent = 'No se encontraron clientes';
    celda.append(mensaje);
    fila.append(celda);
    tbody.append(fila);
    return;
  }

  clientes.forEach(c => {
    const fila = document.createElement('tr');
    const nombreCompleto = [c.nombres, c.apellidos].filter(Boolean).join(' ');
    const iniciales = [c.nombres, c.apellidos]
      .filter(Boolean)
      .map(nombre => nombre.trim().charAt(0))
      .join('')
      .slice(0, 2);

    const id = document.createElement('td');
    const etiquetaId = document.createElement('span');
    etiquetaId.className = 'cliente-id';
    etiquetaId.textContent = c.id_cliente;
    id.append(etiquetaId);

    const nombre = document.createElement('td');
    const nombreCelda = document.createElement('div');
    nombreCelda.className = 'cliente-name-cell';
    const avatar = document.createElement('span');
    avatar.className = 'cliente-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = iniciales || '?';
    const nombreTexto = document.createElement('span');
    nombreTexto.className = 'cliente-name';
    nombreTexto.textContent = nombreCompleto;
    nombreCelda.append(avatar, nombreTexto);
    nombre.append(nombreCelda);

    const dui = document.createElement('td');
    dui.className = 'cliente-contact';
    dui.textContent = c.dui || '—';

    const telefono = document.createElement('td');
    telefono.className = 'cliente-contact';
    telefono.textContent = c.telefono || '—';

    const acciones = document.createElement('td');
    acciones.className = 'text-end';
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'btn btn-sm btn-outline-primary cliente-edit-btn';
    editar.dataset.editarCliente = c.id_cliente;
    editar.setAttribute('aria-label', `Editar cliente ${nombreCompleto}`);
    editar.title = 'Editar cliente';
    editar.innerHTML = '<i class="bi bi-pencil-square cliente-icon" aria-hidden="true"></i><span class="d-none d-sm-inline ms-sm-1">Editar</span>';
    acciones.append(editar);

    fila.append(id, nombre, dui, telefono, acciones);
    tbody.append(fila);
  });
}
function renderClientesPaginado() {
  const totalClientes = document.getElementById('totalClientes');
  if (totalClientes) {
    const total = clientesFiltrados.length;
    totalClientes.textContent = `${total} ${total === 1 ? 'cliente' : 'clientes'}`;
  }

  const inicio = (paginaActual - 1) * pageSize;
  const fin = inicio + pageSize;
  const pagina = clientesFiltrados.slice(inicio, fin);

  renderClientes(pagina);
}

function renderPaginacionClientes() {
  const cont = document.getElementById('paginacionClientes');
  if (!cont) return;

  const total = clientesFiltrados.length;
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) {
    cont.innerHTML = '';
    return;
  }

  let html = '<nav><ul class="pagination pagination-sm mb-0">';

  html += `
    <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
      <button class="page-link" data-page="${paginaActual - 1}">Anterior</button>
    </li>
  `;

  const desde = Math.max(1, paginaActual - 2);
  const hasta = Math.min(totalPages, paginaActual + 2);

  for (let i = desde; i <= hasta; i++) {
    html += `
      <li class="page-item ${i === paginaActual ? 'active' : ''}">
        <button class="page-link" data-page="${i}">${i}</button>
      </li>
    `;
  }

  html += `
    <li class="page-item ${paginaActual === totalPages ? 'disabled' : ''}">
      <button class="page-link" data-page="${paginaActual + 1}">Siguiente</button>
    </li>
  `;

  html += '</ul></nav>';
  cont.innerHTML = html;
}

function cambiarPaginaClientes(nuevaPagina) {
  const totalPages = Math.ceil(clientesFiltrados.length / pageSize);
  if (nuevaPagina < 1 || nuevaPagina > totalPages) return;

  paginaActual = nuevaPagina;
  renderClientesPaginado();
  renderPaginacionClientes();
}

function mostrarMensaje(texto, tipo) {
  const div = document.getElementById('mensajeCliente');
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
function filtrarClientes() {
  const texto = document
    .getElementById('buscadorCliente')
    .value
    .toLowerCase();

  clientesFiltrados = clientesCache.filter(c =>
    `${c.nombres} ${c.apellidos}`.toLowerCase().includes(texto)
  );

  paginaActual = 1;
  renderClientesPaginado();
  renderPaginacionClientes();
}

document.addEventListener('click', e => {
  const page = Number(e.target?.dataset?.page || 0);
  if (!page) return;

  const dentroPaginacion = e.target.closest('#paginacionClientes');
  if (!dentroPaginacion) return;

  cambiarPaginaClientes(page);
});
