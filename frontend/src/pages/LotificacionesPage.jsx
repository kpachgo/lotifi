import { Fragment, useEffect, useState } from 'react';
import {
  Accordion, Badge, Box, Button, CloseButton, Dialog, Field, Flex,
  Heading, Input, Portal, SimpleGrid, Table, Text, Textarea
} from '@chakra-ui/react';
import {
  BadgeDollarSign, Building2, ChevronDown, ChevronUp, FileText, Hash,
  Layers3, Map, MapPin, Pencil, Plus, Ruler, Tag
} from 'lucide-react';
import { apiRequest } from '../api.js';

const initialForm = { nombre: '', ubicacion: '', descripcion: '' };
const initialLote = { numero_lote: '', area: '', unidad_area: 'v2', precio_base: '', precio: '', estado: 'disponible' };

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

export default function LotificacionesPage() {
  const [lotificaciones, setLotificaciones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [poligonos, setPoligonos] = useState([]);
  const [lotes, setLotes] = useState({});
  const [dialog, setDialog] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingLotificacionId, setEditingLotificacionId] = useState(null);
  const [poligonoNombre, setPoligonoNombre] = useState('');
  const [editingPoligonoId, setEditingPoligonoId] = useState(null);
  const [loteForm, setLoteForm] = useState(initialLote);
  const [editingLoteId, setEditingLoteId] = useState(null);
  const [activePoligono, setActivePoligono] = useState(null);
  const [expandedLotificacionId, setExpandedLotificacionId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadLotificaciones() {
    setLoading(true);
    try {
      const data = await apiRequest('/api/lotificaciones');
      if (!Array.isArray(data)) throw new Error('Respuesta inválida al cargar lotificaciones.');
      setLotificaciones(data);
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar las lotificaciones.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLotificaciones(); }, []);

  async function openDetail(lotificacion) {
    if (expandedLotificacionId === lotificacion.id_lotificacion) {
      setExpandedLotificacionId(null);
      return;
    }

    setSelected(lotificacion);
    setPoligonos([]);
    setLotes({});
    setError('');
    setExpandedLotificacionId(lotificacion.id_lotificacion);
    setDetailLoading(true);
    try {
      const data = await apiRequest(`/api/poligonos/lotificacion/${lotificacion.id_lotificacion}`);
      if (!Array.isArray(data)) throw new Error('Respuesta inválida al cargar polígonos.');
      setPoligonos(data);
      const entries = await Promise.all(data.map(async poligono => {
        const rows = await apiRequest(`/api/lotes/poligono/${poligono.id_poligono}`);
        return [poligono.id_poligono, Array.isArray(rows) ? rows : []];
      }));
      setLotes(Object.fromEntries(entries));
    } catch (requestError) {
      setError(requestError.message || 'No se pudo cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function reloadDetail(lotificacion) {
    if (!lotificacion) return;
    setError('');
    try {
      const data = await apiRequest(`/api/poligonos/lotificacion/${lotificacion.id_lotificacion}`);
      if (!Array.isArray(data)) throw new Error('Respuesta inválida al cargar polígonos.');
      setPoligonos(data);
      const entries = await Promise.all(data.map(async poligono => {
        const rows = await apiRequest(`/api/lotes/poligono/${poligono.id_poligono}`);
        return [poligono.id_poligono, Array.isArray(rows) ? rows : []];
      }));
      setLotes(Object.fromEntries(entries));
    } catch (requestError) {
      setError(requestError.message || 'No se pudo actualizar el detalle.');
    }
  }

  async function saveLotificacion(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const editing = editingLotificacionId !== null;
    try {
      await apiRequest(editing ? `/api/lotificaciones/${editingLotificacionId}` : '/api/lotificaciones', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          ubicacion: form.ubicacion.trim(),
          descripcion: form.descripcion.trim()
        })
      });
      setDialog('');
      setForm(initialForm);
      setEditingLotificacionId(null);
      setNotice(editing ? 'Lotificación actualizada correctamente.' : 'Lotificación guardada correctamente.');
      await loadLotificaciones();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar la lotificación.');
    } finally {
      setSaving(false);
    }
  }

  async function savePoligono(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    const editing = editingPoligonoId !== null;
    try {
      await apiRequest(editing ? `/api/poligonos/${editingPoligonoId}` : '/api/poligonos', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lotificacion: selected.id_lotificacion, nombre: poligonoNombre.trim() })
      });
      setPoligonoNombre('');
      setDialog('');
      setEditingPoligonoId(null);
      setNotice(editing ? 'Polígono actualizado correctamente.' : 'Polígono guardado correctamente.');
      await reloadDetail(selected);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar el polígono.');
    } finally {
      setSaving(false);
    }
  }

  async function saveLote(event) {
    event.preventDefault();
    if (!activePoligono) return;
    setSaving(true);
    setError('');
    const editing = editingLoteId !== null;
    try {
      await apiRequest(editing ? `/api/lotes/${editingLoteId}` : '/api/lotes', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...loteForm,
          id_poligono: activePoligono,
          numero_lote: Number(loteForm.numero_lote),
          area: Number(loteForm.area),
          precio_base: Number(loteForm.precio_base),
          precio: loteForm.precio === '' ? null : Number(loteForm.precio)
        })
      });
      setLoteForm(initialLote);
      setDialog('');
      setEditingLoteId(null);
      setNotice(editing ? 'Lote actualizado correctamente.' : 'Lote guardado correctamente.');
      await reloadDetail(selected);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar el lote.');
    } finally {
      setSaving(false);
    }
  }

  const money = value => `$${Number(value || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Box>
      <Flex className="page-heading" align="center" justify="space-between" gap="4">
        <Box>
          <Text className="eyebrow">INVENTARIO</Text>
          <Heading size="2xl" className="page-title">Lotificaciones</Heading>
          <Text className="page-description">Gestiona proyectos, polígonos y lotes desde un solo panel.</Text>
        </Box>
        <Button colorPalette="blue" className="primary-button" onClick={() => {
          setError('');
          setForm(initialForm);
          setEditingLotificacionId(null);
          setDialog('lotificacion');
        }}>
          <Plus size={18} aria-hidden="true" /> Nueva lotificación
        </Button>
      </Flex>
      {notice && <Box role="status" className="notice-success">{notice}</Box>}
      {error && !dialog && expandedLotificacionId === null && <Box role="alert" className="notice-error">{error}</Box>}

      <section className="customers-card">
        <Flex className="table-heading" justify="space-between" align="center">
          <Box><Heading size="md">Catálogo de proyectos</Heading><Text className="table-subtitle">{lotificaciones.length} proyectos registrados</Text></Box>
          <Map size={24} color="#3974c8" aria-hidden="true" />
        </Flex>
        <div className="table-scroll">
          <Table.Root className="customers-table" size="md">
            <Table.Header><Table.Row><Table.ColumnHeader>ID</Table.ColumnHeader><Table.ColumnHeader>Nombre</Table.ColumnHeader><Table.ColumnHeader>Ubicación</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Acciones</Table.ColumnHeader></Table.Row></Table.Header>
            <Table.Body>
              {loading ? <Table.Row><Table.Cell colSpan={4} className="empty-row">Cargando lotificaciones…</Table.Cell></Table.Row>
                : lotificaciones.length === 0 ? <Table.Row><Table.Cell colSpan={4} className="empty-row">No hay lotificaciones registradas.</Table.Cell></Table.Row>
                  : lotificaciones.map(lot => {
                    const expanded = expandedLotificacionId === lot.id_lotificacion;
                    return <Fragment key={lot.id_lotificacion}>
                      <Table.Row>
                        <Table.Cell><Badge className="id-badge">#{lot.id_lotificacion}</Badge></Table.Cell>
                        <Table.Cell><strong>{lot.nombre}</strong></Table.Cell>
                        <Table.Cell>{lot.ubicacion || '—'}</Table.Cell>
                        <Table.Cell textAlign="right"><Flex justify="flex-end" gap="2">
                          <Button size="sm" variant="outline" aria-label={`Editar ${lot.nombre}`} onClick={() => {
                            setError('');
                            setForm({ nombre: lot.nombre || '', ubicacion: lot.ubicacion || '', descripcion: lot.descripcion || '' });
                            setEditingLotificacionId(lot.id_lotificacion);
                            setDialog('lotificacion');
                          }}><Pencil size={14} aria-hidden="true" /> Editar</Button>
                          <Button size="sm" variant="outline" aria-expanded={expanded} aria-controls={`lotificacion-detail-${lot.id_lotificacion}`} onClick={() => openDetail(lot)}>
                          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                          </Button>
                        </Flex></Table.Cell>
                      </Table.Row>
                      {expanded && <Table.Row className="lotification-detail-table-row">
                        <Table.Cell colSpan={4} p="0">
                          <Box id={`lotificacion-detail-${lot.id_lotificacion}`} className="lotification-inline-detail">
                            <Flex justify="space-between" align="center" gap="4" mb="3">
                              <Box><Heading size="md">{lot.nombre}</Heading><Text className="dialog-subtitle">{lot.ubicacion || 'Ubicación no especificada'}{lot.descripcion ? ` · ${lot.descripcion}` : ''}</Text></Box>
                              <Button size="sm" colorPalette="blue" onClick={() => { setError(''); setPoligonoNombre(''); setEditingPoligonoId(null); setDialog('poligono'); }}><Plus size={15} aria-hidden="true" /> Nuevo polígono</Button>
                            </Flex>
                            {detailLoading ? <Box className="empty-row">Cargando polígonos y lotes…</Box>
                              : error ? <Box role="alert" className="notice-error">{error}</Box>
                                : poligonos.length === 0 ? <Box className="empty-row">No hay polígonos registrados.</Box> : (
                                  <Accordion.Root collapsible defaultValue={poligonos.map(poligono => String(poligono.id_poligono))}>
                                    {poligonos.map(poligono => <Accordion.Item key={poligono.id_poligono} value={String(poligono.id_poligono)}>
                                      <Flex className="polygon-accordion-header" align="center" gap="3">
                                        <Accordion.ItemTrigger className="polygon-accordion-trigger">
                                          <strong>{poligono.nombre}</strong>
                                          <Accordion.ItemIndicator />
                                        </Accordion.ItemTrigger>
                                        <Badge>{(lotes[poligono.id_poligono] || []).length} {(lotes[poligono.id_poligono] || []).length === 1 ? 'lote' : 'lotes'}</Badge>
                                        <Button size="sm" variant="outline" aria-label={`Editar ${poligono.nombre}`} onClick={() => { setError(''); setPoligonoNombre(poligono.nombre); setEditingPoligonoId(poligono.id_poligono); setDialog('poligono'); }}><Pencil size={14} aria-hidden="true" /> Editar</Button>
                                        <Button size="sm" colorPalette="blue" onClick={() => { setActivePoligono(poligono.id_poligono); setLoteForm(initialLote); setEditingLoteId(null); setDialog('lote'); }}><Plus size={15} aria-hidden="true" /> Nuevo lote</Button>
                                      </Flex>
                                      <Accordion.ItemContent><Accordion.ItemBody>
                                        <div className="table-scroll"><Table.Root className="customers-table" size="sm">
                                          <Table.Header><Table.Row><Table.ColumnHeader>Lote</Table.ColumnHeader><Table.ColumnHeader>Área</Table.ColumnHeader><Table.ColumnHeader>Precio base</Table.ColumnHeader><Table.ColumnHeader>Precio final</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Acciones</Table.ColumnHeader></Table.Row></Table.Header>
                                          <Table.Body>{(lotes[poligono.id_poligono] || []).length === 0 ? <Table.Row><Table.Cell colSpan={6} className="empty-row">Sin lotes registrados.</Table.Cell></Table.Row> : (lotes[poligono.id_poligono] || []).map(lote => <Table.Row key={lote.id_lote}><Table.Cell>{lote.numero_lote}</Table.Cell><Table.Cell>{lote.area} {lote.unidad_area}</Table.Cell><Table.Cell>{money(lote.precio_base)}</Table.Cell><Table.Cell>{lote.precio == null ? 'Pendiente' : money(lote.precio)}</Table.Cell><Table.Cell><Badge colorPalette={lote.estado === 'disponible' ? 'green' : lote.estado === 'vendido' ? 'red' : 'orange'}>{lote.estado}</Badge></Table.Cell><Table.Cell textAlign="right"><Button size="sm" variant="outline" aria-label={`Editar lote ${lote.numero_lote}`} onClick={() => {
                                            setError('');
                                            setActivePoligono(poligono.id_poligono);
                                            setLoteForm({
                                              numero_lote: String(lote.numero_lote ?? ''),
                                              area: String(lote.area ?? ''),
                                              unidad_area: lote.unidad_area || 'v2',
                                              precio_base: String(lote.precio_base ?? ''),
                                              precio: lote.precio == null ? '' : String(lote.precio),
                                              estado: lote.estado
                                            });
                                            setEditingLoteId(lote.id_lote);
                                            setDialog('lote');
                                          }}><Pencil size={14} aria-hidden="true" /> Editar</Button></Table.Cell></Table.Row>)}</Table.Body>
                                        </Table.Root></div>
                                      </Accordion.ItemBody></Accordion.ItemContent>
                                    </Accordion.Item>)}
                                  </Accordion.Root>
                                )}
                          </Box>
                        </Table.Cell>
                      </Table.Row>}
                    </Fragment>;
                  })}
            </Table.Body>
          </Table.Root>
        </div>
      </section>

      <Dialog.Root open={dialog === 'lotificacion'} onOpenChange={details => {
        if (!details.open) {
          setDialog('');
          setEditingLotificacionId(null);
          setForm(initialForm);
        }
      }} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog">
          <form onSubmit={saveLotificacion}>
            <Dialog.Header>
              <Box>
                <Dialog.Title>{editingLotificacionId !== null ? 'Editar lotificación' : 'Nueva lotificación'}</Dialog.Title>
                <Text className="dialog-subtitle">Organiza la información general del proyecto y su ubicación.</Text>
              </Box>
              <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              {error && <Box role="alert" className="notice-error">{error}</Box>}
              <section className="guided-form-section">
                <FormSectionHeading icon={Building2} title="Datos del proyecto"
                  description="Asigna un nombre claro para identificar esta lotificación." />
                <Field.Root required>
                  <IconFieldLabel icon={Building2}>Nombre de la lotificación</IconFieldLabel>
                  <Input value={form.nombre} onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))}
                    maxLength={100} placeholder="Ej. Residencial Las Palmeras" required />
                </Field.Root>
              </section>
              <section className="guided-form-section">
                <FormSectionHeading icon={MapPin} title="Ubicación y descripción"
                  description="Ayuda a reconocer dónde se encuentra y qué caracteriza al proyecto." />
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  <Field.Root required gridColumn={{ base: 'span 1', md: 'span 2' }}>
                    <IconFieldLabel icon={MapPin}>Ubicación</IconFieldLabel>
                    <Input value={form.ubicacion} onChange={event => setForm(current => ({ ...current, ubicacion: event.target.value }))}
                      maxLength={200} placeholder="Ej. Carretera a Santa Ana, km 28, La Libertad" required />
                  </Field.Root>
                  <Field.Root gridColumn={{ base: 'span 1', md: 'span 2' }}>
                    <IconFieldLabel icon={FileText}>Descripción <span className="optional-label">Opcional</span></IconFieldLabel>
                    <Textarea value={form.descripcion} onChange={event => setForm(current => ({ ...current, descripcion: event.target.value }))}
                      rows={3} placeholder="Detalles adicionales del proyecto, accesos o referencias" />
                  </Field.Root>
                </SimpleGrid>
              </section>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => { setDialog(''); setEditingLotificacionId(null); setForm(initialForm); }} type="button">Cancelar</Button>
              <Button colorPalette="blue" type="submit" loading={saving}>{editingLotificacionId !== null ? 'Guardar cambios' : 'Crear lotificación'}</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={dialog === 'poligono'} onOpenChange={details => {
        if (!details.open) {
          setDialog('');
          setEditingPoligonoId(null);
          setPoligonoNombre('');
        }
      }} size="md">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog"><form onSubmit={savePoligono}>
          <Dialog.Header>
            <Box>
              <Dialog.Title>{editingPoligonoId !== null ? 'Editar polígono' : 'Nuevo polígono'}</Dialog.Title>
              <Text className="dialog-subtitle">Agrupa los lotes por zona o sección dentro de {selected?.nombre || 'la lotificación'}.</Text>
            </Box>
            <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            {error && <Box role="alert" className="notice-error">{error}</Box>}
            <section className="guided-form-section">
              <FormSectionHeading icon={Layers3} title="Identificación del polígono"
                description="Usa un nombre o código fácil de reconocer." />
              <Field.Root required>
                <IconFieldLabel icon={Tag}>Nombre del polígono</IconFieldLabel>
                <Input value={poligonoNombre} onChange={event => setPoligonoNombre(event.target.value)}
                  maxLength={50} placeholder="Ej. Polígono A o Etapa 1" required />
              </Field.Root>
            </section>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" type="button" onClick={() => { setDialog(''); setEditingPoligonoId(null); setPoligonoNombre(''); }}>Cancelar</Button>
            <Button colorPalette="blue" type="submit" loading={saving}>{editingPoligonoId !== null ? 'Guardar cambios' : 'Crear polígono'}</Button>
          </Dialog.Footer>
        </form></Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={dialog === 'lote'} onOpenChange={details => {
        if (!details.open) {
          setDialog('');
          setEditingLoteId(null);
          setLoteForm(initialLote);
        }
      }} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog"><form onSubmit={saveLote}>
          <Dialog.Header>
            <Box>
              <Dialog.Title>{editingLoteId !== null ? 'Editar lote' : 'Nuevo lote'}</Dialog.Title>
              <Text className="dialog-subtitle">Registra las medidas, precio y disponibilidad del lote.</Text>
            </Box>
            <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            {error && <Box role="alert" className="notice-error">{error}</Box>}
            <section className="guided-form-section">
              <FormSectionHeading icon={Hash} title="Identificación y medidas"
                description="Indica el número asignado y el área del terreno." />
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Field.Root required>
                  <IconFieldLabel icon={Hash}>Número de lote</IconFieldLabel>
                  <Input type="number" min="1" step="1" value={loteForm.numero_lote}
                    onChange={event => setLoteForm(current => ({ ...current, numero_lote: event.target.value }))}
                    placeholder="Ej. 12" required />
                </Field.Root>
                <Field.Root required>
                  <IconFieldLabel icon={Ruler}>Área</IconFieldLabel>
                  <Input type="number" min="0.01" step="0.01" value={loteForm.area}
                    onChange={event => setLoteForm(current => ({ ...current, area: event.target.value }))}
                    placeholder="Ej. 250.00" required />
                </Field.Root>
                <Field.Root>
                  <IconFieldLabel icon={Ruler}>Unidad de medida</IconFieldLabel>
                  <select className="native-select" value={loteForm.unidad_area}
                    onChange={event => setLoteForm(current => ({ ...current, unidad_area: event.target.value }))}>
                    <option value="v2">Varas cuadradas (v²)</option>
                    <option value="m2">Metros cuadrados (m²)</option>
                  </select>
                </Field.Root>
              </SimpleGrid>
            </section>
            <section className="guided-form-section">
              <FormSectionHeading icon={BadgeDollarSign} title="Precio y disponibilidad"
                description="Define el precio comercial y el estado actual del lote." />
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Field.Root required>
                  <IconFieldLabel icon={BadgeDollarSign}>Precio base (USD)</IconFieldLabel>
                  <Input type="number" min="0" step="0.01" value={loteForm.precio_base}
                    onChange={event => setLoteForm(current => ({ ...current, precio_base: event.target.value }))}
                    placeholder="Ej. 15000.00" required />
                </Field.Root>
                <Field.Root>
                  <IconFieldLabel icon={BadgeDollarSign}>Precio final (USD) <span className="optional-label">Opcional</span></IconFieldLabel>
                  <Input type="number" min="0" step="0.01" value={loteForm.precio}
                    onChange={event => setLoteForm(current => ({ ...current, precio: event.target.value }))}
                    placeholder="Dejar vacío si está pendiente" />
                </Field.Root>
                <Field.Root>
                  <IconFieldLabel icon={Tag}>Estado del lote</IconFieldLabel>
                  <select className="native-select" value={loteForm.estado}
                    onChange={event => setLoteForm(current => ({ ...current, estado: event.target.value }))}>
                    <option value="disponible">Disponible</option>
                    <option value="promesa_venta">Promesa de venta</option>
                    <option value="vendido">Vendido</option>
                  </select>
                </Field.Root>
              </SimpleGrid>
            </section>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" type="button" onClick={() => { setDialog(''); setEditingLoteId(null); setLoteForm(initialLote); }}>Cancelar</Button>
            <Button colorPalette="blue" type="submit" loading={saving}>{editingLoteId !== null ? 'Guardar cambios' : 'Crear lote'}</Button>
          </Dialog.Footer>
        </form></Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Box>
  );
}
