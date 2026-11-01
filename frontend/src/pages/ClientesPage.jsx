import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, CloseButton, Dialog, Field, Flex, Heading, Input,
  Portal, SimpleGrid, Table, Text, Textarea
} from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Users } from 'lucide-react';
import { apiRequest } from '../api.js';

const pageSize = 20;
const emptyForm = {
  nombres: '',
  apellidos: '',
  dui: '',
  nit: '',
  telefono: '',
  direccion: ''
};

function initials(cliente) {
  return [cliente.nombres, cliente.apellidos]
    .filter(Boolean)
    .map(value => value.trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadClientes() {
    setLoading(true);
    try {
      const data = await apiRequest('/api/cliente');
      if (!Array.isArray(data)) throw new Error('El servidor devolvió una lista de clientes inválida.');
      setClientes(data);
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClientes();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return clientes;
    return clientes.filter(cliente =>
      `${cliente.nombres || ''} ${cliente.apellidos || ''} ${cliente.dui || ''} ${cliente.telefono || ''}`
        .toLocaleLowerCase('es').includes(normalized)
    );
  }, [clientes, query]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const visibleClientes = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  }

  function openEdit(cliente) {
    setEditing(cliente);
    setForm({
      nombres: cliente.nombres || '',
      apellidos: cliente.apellidos || '',
      dui: cliente.dui || '',
      nit: cliente.nit || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || ''
    });
    setError('');
    setDialogOpen(true);
  }

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveCliente(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        dui: form.dui.trim(),
        nit: form.nit.trim() || null,
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim()
      };
      await apiRequest(editing ? `/api/cliente/${editing.id_cliente}` : '/api/cliente', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setDialogOpen(false);
      setNotice(editing ? 'Cliente actualizado correctamente.' : 'Cliente guardado correctamente.');
      await loadClientes();
      window.setTimeout(() => setNotice(''), 3500);
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box className="customers-page">
      <Flex className="page-heading" align="center" justify="space-between" gap="4">
        <Box>
          <Text className="eyebrow">GESTIÓN</Text>
          <Heading size="2xl" className="page-title">Clientes</Heading>
          <Text className="page-description">Administra la información y los datos de contacto de tus clientes.</Text>
        </Box>
        <Button colorPalette="blue" onClick={openNew} className="primary-button">
          <Plus size={18} aria-hidden="true" /> Nuevo cliente
        </Button>
      </Flex>

      {notice && <Box role="status" className="notice-success">{notice}</Box>}
      {error && !dialogOpen && <Box role="alert" className="notice-error">{error}</Box>}

      <section className="customers-card">
        <Flex className="table-heading" align="center" justify="space-between" gap="4">
          <Box>
            <Heading size="md">Listado de clientes</Heading>
            <Text className="table-subtitle">{filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}</Text>
          </Box>
          <div className="search-control">
            <Search size={17} aria-hidden="true" />
            <Input aria-label="Buscar clientes" placeholder="Nombre, DUI o teléfono"
              value={query} onChange={event => setQuery(event.target.value)} />
          </div>
        </Flex>

        <div className="table-scroll">
          <Table.Root className="customers-table" size="md">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>ID</Table.ColumnHeader>
                <Table.ColumnHeader>Cliente</Table.ColumnHeader>
                <Table.ColumnHeader>DUI</Table.ColumnHeader>
                <Table.ColumnHeader>Teléfono</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right">Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loading ? (
                <Table.Row><Table.Cell colSpan={5} className="empty-row">Cargando clientes…</Table.Cell></Table.Row>
              ) : filtered.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} className="empty-row">
                    <Users size={24} aria-hidden="true" />
                    <span>{query ? 'No hay clientes que coincidan con la búsqueda.' : 'Aún no hay clientes registrados.'}</span>
                  </Table.Cell>
                </Table.Row>
              ) : visibleClientes.map(cliente => (
                <Table.Row key={cliente.id_cliente}>
                  <Table.Cell><Badge className="id-badge">#{cliente.id_cliente}</Badge></Table.Cell>
                  <Table.Cell>
                    <div className="customer-name">
                      <span className="customer-avatar" aria-hidden="true">{initials(cliente)}</span>
                      <strong>{[cliente.nombres, cliente.apellidos].filter(Boolean).join(' ')}</strong>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{cliente.dui || '—'}</Table.Cell>
                  <Table.Cell>{cliente.telefono || '—'}</Table.Cell>
                  <Table.Cell textAlign="right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(cliente)}
                      aria-label={`Editar cliente ${cliente.nombres} ${cliente.apellidos}`}>
                      <Pencil size={15} aria-hidden="true" /> Editar
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
        {totalPages > 1 && (
          <Flex className="pagination-bar" align="center" justify="space-between">
            <Text className="table-subtitle">Página {page} de {totalPages}</Text>
            <Flex gap="2">
              <Button size="sm" variant="outline" disabled={page === 1}
                onClick={() => setPage(current => current - 1)} aria-label="Página anterior">
                <ChevronLeft size={16} aria-hidden="true" /> Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page === totalPages}
                onClick={() => setPage(current => current + 1)} aria-label="Página siguiente">
                Siguiente <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </Flex>
          </Flex>
        )}
      </section>

      <Dialog.Root open={dialogOpen} onOpenChange={details => setDialogOpen(details.open)} size="lg" placement="center">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="customer-dialog">
              <form onSubmit={saveCliente}>
                <Dialog.Header>
                  <Box>
                    <Dialog.Title>{editing ? 'Editar cliente' : 'Nuevo cliente'}</Dialog.Title>
                    <Text className="dialog-subtitle">Completa los datos personales y de contacto.</Text>
                  </Box>
                  <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
                </Dialog.Header>
                <Dialog.Body>
                  {error && <Box role="alert" className="notice-error dialog-error">{error}</Box>}
                  <div className="form-section">Datos personales</div>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                    <Field.Root required>
                      <Field.Label>Nombres</Field.Label>
                      <Input name="nombres" value={form.nombres} onChange={updateField} required />
                    </Field.Root>
                    <Field.Root required>
                      <Field.Label>Apellidos</Field.Label>
                      <Input name="apellidos" value={form.apellidos} onChange={updateField} required />
                    </Field.Root>
                    <Field.Root required>
                      <Field.Label>DUI</Field.Label>
                      <Input name="dui" value={form.dui} onChange={updateField} maxLength={10} placeholder="00000000-0" required />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>NIT <span className="optional-label">Opcional</span></Field.Label>
                      <Input name="nit" value={form.nit} onChange={updateField} maxLength={19} placeholder="0000-000000-000-0" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Teléfono</Field.Label>
                      <Input name="telefono" value={form.telefono} onChange={updateField} placeholder="XXXX-XXXX" />
                    </Field.Root>
                  </SimpleGrid>
                  <div className="form-section address-section">Contacto</div>
                  <Field.Root required>
                    <Field.Label>Dirección</Field.Label>
                    <Textarea name="direccion" value={form.direccion} onChange={updateField} rows={3} required />
                  </Field.Root>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="outline" onClick={() => setForm(emptyForm)} type="button">Limpiar</Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">Cancelar</Button>
                  <Button colorPalette="blue" type="submit" loading={saving}>
                    {editing ? 'Guardar cambios' : 'Guardar cliente'}
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
