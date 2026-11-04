import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, Badge, Box, Button, CloseButton, Dialog, Field, Flex, Heading, Input,
  Portal, SimpleGrid, Table, Text, Textarea
} from '@chakra-ui/react';
import {
  ChevronLeft, ChevronRight, IdCard, MapPin, Pencil, Phone, Plus, Search,
  Trash2, UserRound, Users
} from 'lucide-react';
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
const emptyContact = {
  nombres: '',
  apellidos: '',
  parentesco: '',
  dui: '',
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

function FormSectionHeading({ icon: Icon, title, description }) {
  return (
    <Flex className="guided-section-heading" align="center" gap="3">
      <span className="guided-section-icon"><Icon size={18} aria-hidden="true" /></span>
      <Box>
        <Heading size="sm">{title}</Heading>
        <Text className="guided-section-description">{description}</Text>
      </Box>
    </Flex>
  );
}

function IconFieldLabel({ icon: Icon, children }) {
  return (
    <Field.Label>
      <span className="guided-field-label"><Icon size={15} aria-hidden="true" />{children}</span>
    </Field.Label>
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [contactos, setContactos] = useState([]);
  const [expandedContacts, setExpandedContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsLoadFailed, setContactsLoadFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // { cliente, paso: 1 | 2, contratos, activos }: paso 2 solo si el servidor avisa que tiene contratos
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const contactLoadId = useRef(0);
  const nextContactKey = useRef(0);

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
    contactLoadId.current += 1;
    setEditing(null);
    setForm(emptyForm);
    setContactos([]);
    setExpandedContacts([]);
    setContactsLoading(false);
    setContactsLoadFailed(false);
    setError('');
    setDialogOpen(true);
  }

  async function openEdit(cliente) {
    const requestId = ++contactLoadId.current;
    setEditing(cliente);
    setForm({
      nombres: cliente.nombres || '',
      apellidos: cliente.apellidos || '',
      dui: cliente.dui || '',
      nit: cliente.nit || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || ''
    });
    setContactos([]);
    setExpandedContacts([]);
    setContactsLoading(true);
    setContactsLoadFailed(false);
    setError('');
    setDialogOpen(true);
    try {
      const details = await apiRequest(`/api/cliente/${cliente.id_cliente}`);
      if (requestId !== contactLoadId.current) return;
      if (!Array.isArray(details.contactos)) {
        throw new Error('El servidor devolvió una lista de contactos inválida.');
      }
      setContactos(details.contactos.map(contacto => ({
        key: `saved-${contacto.id_contacto}`,
        nombres: contacto.nombres || '',
        apellidos: contacto.apellidos || '',
        parentesco: contacto.parentesco || '',
        dui: contacto.dui || '',
        telefono: contacto.telefono || '',
        direccion: contacto.direccion || ''
      })));
    } catch (loadError) {
      if (requestId !== contactLoadId.current) return;
      setContactsLoadFailed(true);
      setError(loadError.message || 'No se pudieron cargar los contactos del cliente.');
    } finally {
      if (requestId === contactLoadId.current) setContactsLoading(false);
    }
  }

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateContact(index, event) {
    const { name, value } = event.target;
    setContactos(current => current.map((contacto, contactIndex) =>
      contactIndex === index ? { ...contacto, [name]: value } : contacto
    ));
  }

  async function saveCliente(event) {
    event.preventDefault();
    if (contactsLoading || contactsLoadFailed) return;
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
        direccion: form.direccion.trim(),
        contactos: contactos.map(contacto => ({
          nombres: contacto.nombres.trim(),
          apellidos: contacto.apellidos.trim(),
          parentesco: contacto.parentesco.trim(),
          dui: contacto.dui.trim(),
          telefono: contacto.telefono.trim(),
          direccion: contacto.direccion.trim()
        }))
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

  async function deleteCliente() {
    const { cliente, paso } = deleteTarget;
    setDeleting(true);
    setDeleteError('');
    try {
      // fetch directo: apiRequest descarta el cuerpo del 409 que trae los conteos de contratos
      const response = await fetch(
        `/api/cliente/${cliente.id_cliente}${paso === 2 ? '?confirmar=1' : ''}`,
        { method: 'DELETE' }
      );
      const body = await response.json().catch(() => ({}));
      if (response.status === 409 && body.requiere_confirmacion) {
        setDeleteTarget({ cliente, paso: 2, contratos: body.contratos, activos: body.contratos_activos });
        return;
      }
      if (!response.ok) throw new Error(body.error || `Error HTTP ${response.status}`);
      setDeleteTarget(null);
      setNotice(body.advertencia || 'Cliente eliminado correctamente.');
      await loadClientes();
      window.setTimeout(() => setNotice(''), 3500);
    } catch (deleteErr) {
      setDeleteError(deleteErr.message || 'No se pudo eliminar el cliente.');
    } finally {
      setDeleting(false);
    }
  }

  const deleteName = deleteTarget
    ? [deleteTarget.cliente.nombres, deleteTarget.cliente.apellidos].filter(Boolean).join(' ')
    : '';

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
                    </Button>{' '}
                    <Button size="sm" variant="outline" colorPalette="red"
                      onClick={() => { setDeleteError(''); setDeleteTarget({ cliente, paso: 1 }); }}
                      aria-label={`Eliminar cliente ${cliente.nombres} ${cliente.apellidos}`}>
                      <Trash2 size={15} aria-hidden="true" /> Eliminar
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

      <Dialog.Root open={dialogOpen} onOpenChange={details => {
        if (!details.open) contactLoadId.current += 1;
        setDialogOpen(details.open);
      }} size="xl" placement="center">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="customer-dialog">
              <form onSubmit={saveCliente}>
                <Dialog.Header>
                  <Box>
                    <Dialog.Title>{editing ? 'Editar cliente' : 'Nuevo cliente'}</Dialog.Title>
                    <Text className="dialog-subtitle">Registra la información principal y las alternativas para contactar al cliente.</Text>
                  </Box>
                  <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
                </Dialog.Header>
                <Dialog.Body>
                  {error && <Box role="alert" className="notice-error dialog-error">{error}</Box>}
                  <section className="guided-form-section">
                    <FormSectionHeading icon={UserRound} title="Datos del cliente"
                      description="Información personal para identificar al titular del contrato." />
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                      <Field.Root required>
                        <IconFieldLabel icon={UserRound}>Nombres</IconFieldLabel>
                        <Input name="nombres" value={form.nombres} onChange={updateField} maxLength={100} placeholder="Ej. María José" required />
                      </Field.Root>
                      <Field.Root required>
                        <IconFieldLabel icon={UserRound}>Apellidos</IconFieldLabel>
                        <Input name="apellidos" value={form.apellidos} onChange={updateField} maxLength={100} placeholder="Ej. Hernández López" required />
                      </Field.Root>
                    </SimpleGrid>
                  </section>
                  <section className="guided-form-section">
                    <FormSectionHeading icon={IdCard} title="Identificación"
                      description="Documentos de identificación del cliente." />
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                      <Field.Root required>
                        <IconFieldLabel icon={IdCard}>DUI</IconFieldLabel>
                        <Input name="dui" value={form.dui} onChange={updateField} maxLength={10} placeholder="Ej. 01234567-8" required />
                      </Field.Root>
                      <Field.Root>
                        <IconFieldLabel icon={IdCard}>NIT <span className="optional-label">Opcional</span></IconFieldLabel>
                        <Input name="nit" value={form.nit} onChange={updateField} maxLength={19} placeholder="Ej. 0614-120390-102-3" />
                      </Field.Root>
                    </SimpleGrid>
                  </section>
                  <section className="guided-form-section">
                    <FormSectionHeading icon={Phone} title="Información de contacto"
                      description="Usa un número telefónico en formato local, por ejemplo 7123-4567." />
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                      <Field.Root gridColumn={{ base: 'span 1', md: 'span 2' }}>
                        <IconFieldLabel icon={Phone}>Teléfono</IconFieldLabel>
                        <Input name="telefono" type="tel" value={form.telefono} onChange={updateField}
                          maxLength={50} placeholder="Ej. 7123-4567" />
                      </Field.Root>
                      <Field.Root required gridColumn={{ base: 'span 1', md: 'span 2' }}>
                        <IconFieldLabel icon={MapPin}>Dirección</IconFieldLabel>
                        <Textarea name="direccion" value={form.direccion} onChange={updateField}
                          maxLength={250} rows={2} placeholder="Cantón, colonia, calle y punto de referencia" required />
                      </Field.Root>
                    </SimpleGrid>
                  </section>
                  <Flex className="additional-contacts-heading" align="center" justify="space-between" gap="3">
                    <FormSectionHeading icon={Users} title="Contactos adicionales"
                      description="Personas de referencia para localizar al cliente." />
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      const key = `new-${nextContactKey.current++}`;
                      setContactos(current => [...current, { ...emptyContact, key }]);
                      setExpandedContacts(current => [...new Set([...current, key])]);
                    }} disabled={contactsLoading}>
                      <Plus size={16} aria-hidden="true" /> Agregar contacto
                    </Button>
                  </Flex>
                  {contactsLoading ? (
                    <Text className="table-subtitle">Cargando contactos del cliente…</Text>
                  ) : contactsLoadFailed ? (
                    <Text role="alert" className="table-subtitle">
                      No se pueden guardar cambios hasta cargar los contactos existentes.
                    </Text>
                  ) : contactos.length === 0 ? (
                    <Text className="table-subtitle">Aún no hay contactos adicionales registrados.</Text>
                  ) : (
                    <Accordion.Root
                      className="customer-contact-accordion"
                      multiple
                      collapsible
                      value={expandedContacts}
                      onValueChange={details => setExpandedContacts(details.value)}
                    >
                      {contactos.map((contacto, index) => (
                        <Accordion.Item className="customer-contact-item" key={contacto.key} value={contacto.key}>
                          <Flex className="customer-contact-header" align="center" gap="2">
                            <Accordion.ItemTrigger className="customer-contact-trigger">
                              <Box className="customer-contact-summary">
                                <Text fontWeight="semibold">
                                  {[contacto.nombres, contacto.apellidos].filter(Boolean).join(' ') || `Contacto ${index + 1}`}
                                </Text>
                                <Text className="customer-contact-subtitle">
                                  {[contacto.parentesco, contacto.telefono].filter(Boolean).join(' · ') || 'Completar datos del contacto'}
                                </Text>
                              </Box>
                              <Accordion.ItemIndicator />
                            </Accordion.ItemTrigger>
                            <Button type="button" size="sm" variant="outline" colorPalette="red"
                              aria-label={`Eliminar contacto ${index + 1}`}
                              onClick={() => {
                                setContactos(current => current.filter(item => item.key !== contacto.key));
                                setExpandedContacts(current => current.filter(key => key !== contacto.key));
                              }}>
                              <Trash2 size={15} aria-hidden="true" /> Quitar
                            </Button>
                          </Flex>
                          <Accordion.ItemContent>
                            <Accordion.ItemBody>
                              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                                <Field.Root required>
                                  <IconFieldLabel icon={UserRound}>Nombres</IconFieldLabel>
                                  <Input name="nombres" value={contacto.nombres} onChange={event => updateContact(index, event)}
                                    maxLength={100} placeholder="Ej. Ana María" required />
                                </Field.Root>
                                <Field.Root required>
                                  <IconFieldLabel icon={UserRound}>Apellidos</IconFieldLabel>
                                  <Input name="apellidos" value={contacto.apellidos} onChange={event => updateContact(index, event)}
                                    maxLength={100} placeholder="Ej. Hernández López" required />
                                </Field.Root>
                                <Field.Root required>
                                  <IconFieldLabel icon={Users}>Parentesco</IconFieldLabel>
                                  <Input name="parentesco" value={contacto.parentesco} onChange={event => updateContact(index, event)}
                                    maxLength={50} placeholder="Ej. Hermana, amigo" required />
                                </Field.Root>
                                <Field.Root>
                                  <IconFieldLabel icon={IdCard}>DUI <span className="optional-label">Opcional</span></IconFieldLabel>
                                  <Input name="dui" value={contacto.dui} onChange={event => updateContact(index, event)}
                                    maxLength={15} placeholder="Ej. 01234567-8" />
                                </Field.Root>
                                <Field.Root required>
                                  <IconFieldLabel icon={Phone}>Teléfono de contacto</IconFieldLabel>
                                  <Input name="telefono" value={contacto.telefono} onChange={event => updateContact(index, event)}
                                    type="tel" maxLength={50} placeholder="Ej. 7123-4567" required />
                                </Field.Root>
                                <Field.Root>
                                  <IconFieldLabel icon={MapPin}>Dirección <span className="optional-label">Opcional</span></IconFieldLabel>
                                  <Textarea name="direccion" value={contacto.direccion} onChange={event => updateContact(index, event)}
                                    maxLength={250} rows={2} placeholder="Cantón, colonia, calle o referencia" />
                                </Field.Root>
                              </SimpleGrid>
                            </Accordion.ItemBody>
                          </Accordion.ItemContent>
                        </Accordion.Item>
                      ))}
                    </Accordion.Root>
                  )}
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="outline" onClick={() => {
                    setForm(emptyForm);
                    setContactos([]);
                    setExpandedContacts([]);
                  }} type="button">Limpiar</Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">Cancelar</Button>
                  <Button colorPalette="blue" type="submit" loading={saving}
                    disabled={contactsLoading || contactsLoadFailed}>
                    {editing ? 'Guardar cambios' : 'Guardar cliente'}
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root role="alertdialog" open={Boolean(deleteTarget)}
        onOpenChange={details => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {deleteTarget?.paso === 2 ? 'Este cliente tiene contratos' : 'Eliminar cliente'}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {deleteTarget?.paso === 2 ? (
                  <Box role="alert" className="notice-error">
                    <strong>{deleteName}</strong> tiene {deleteTarget.contratos}{' '}
                    {deleteTarget.contratos === 1 ? 'contrato' : 'contratos'}
                    {deleteTarget.activos > 0 && <> ({deleteTarget.activos} {deleteTarget.activos === 1 ? 'activo' : 'activos'})</>}.
                    {' '}Si continúas se borrarán también sus contratos, cuotas, pagos, primas y comprobantes,
                    y sus lotes volverán a quedar disponibles. Esta acción no se puede deshacer.
                  </Box>
                ) : (
                  <Text>¿Seguro que quieres eliminar a <strong>{deleteName}</strong>?</Text>
                )}
                {deleteError && <Box role="alert" className="notice-error" mt="3">{deleteError}</Box>}
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                <Button colorPalette="red" loading={deleting} onClick={deleteCliente}>
                  {deleteTarget?.paso === 2 ? 'Sí, eliminar todo' : 'Eliminar'}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
