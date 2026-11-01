import { Fragment, useEffect, useState } from 'react';
import {
  Accordion, Badge, Box, Button, CloseButton, Dialog, Field, Flex,
  Heading, Input, Portal, SimpleGrid, Table, Text, Textarea
} from '@chakra-ui/react';
import { ChevronDown, ChevronUp, Map, Plus } from 'lucide-react';
import { apiRequest } from '../api.js';

const initialForm = { nombre: '', ubicacion: '', descripcion: '' };
const initialLote = { numero_lote: '', area: '', unidad_area: 'v2', precio_base: '', precio: '', estado: 'disponible' };

export default function LotificacionesPage() {
  const [lotificaciones, setLotificaciones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [poligonos, setPoligonos] = useState([]);
  const [lotes, setLotes] = useState({});
  const [dialog, setDialog] = useState('');
  const [form, setForm] = useState(initialForm);
  const [poligonoNombre, setPoligonoNombre] = useState('');
  const [loteForm, setLoteForm] = useState(initialLote);
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
    try {
      await apiRequest('/api/lotificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          ubicacion: form.ubicacion.trim(),
          descripcion: form.descripcion.trim()
        })
      });
      setDialog('');
      setForm(initialForm);
      setNotice('Lotificación guardada correctamente.');
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
    try {
      await apiRequest('/api/poligonos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lotificacion: selected.id_lotificacion, nombre: poligonoNombre.trim() })
      });
      setPoligonoNombre('');
      setDialog('');
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
    try {
      await apiRequest('/api/lotes', {
        method: 'POST',
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
        <Button colorPalette="blue" className="primary-button" onClick={() => { setError(''); setDialog('lotificacion'); }}>
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
                        <Table.Cell textAlign="right"><Button size="sm" variant="outline" aria-expanded={expanded} aria-controls={`lotificacion-detail-${lot.id_lotificacion}`} onClick={() => openDetail(lot)}>
                          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                        </Button></Table.Cell>
                      </Table.Row>
                      {expanded && <Table.Row className="lotification-detail-table-row">
                        <Table.Cell colSpan={4} p="0">
                          <Box id={`lotificacion-detail-${lot.id_lotificacion}`} className="lotification-inline-detail">
                            <Flex justify="space-between" align="center" gap="4" mb="3">
                              <Box><Heading size="md">{lot.nombre}</Heading><Text className="dialog-subtitle">{lot.ubicacion || 'Ubicación no especificada'}{lot.descripcion ? ` · ${lot.descripcion}` : ''}</Text></Box>
                              <Button size="sm" colorPalette="blue" onClick={() => { setError(''); setPoligonoNombre(''); setDialog('poligono'); }}><Plus size={15} aria-hidden="true" /> Nuevo polígono</Button>
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
                                        <Button size="sm" colorPalette="blue" onClick={() => { setActivePoligono(poligono.id_poligono); setLoteForm(initialLote); setDialog('lote'); }}><Plus size={15} aria-hidden="true" /> Nuevo lote</Button>
                                      </Flex>
                                      <Accordion.ItemContent><Accordion.ItemBody>
                                        <div className="table-scroll"><Table.Root className="customers-table" size="sm">
                                          <Table.Header><Table.Row><Table.ColumnHeader>Lote</Table.ColumnHeader><Table.ColumnHeader>Área</Table.ColumnHeader><Table.ColumnHeader>Precio base</Table.ColumnHeader><Table.ColumnHeader>Precio final</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader></Table.Row></Table.Header>
                                          <Table.Body>{(lotes[poligono.id_poligono] || []).length === 0 ? <Table.Row><Table.Cell colSpan={5} className="empty-row">Sin lotes registrados.</Table.Cell></Table.Row> : (lotes[poligono.id_poligono] || []).map(lote => <Table.Row key={lote.id_lote}><Table.Cell>{lote.numero_lote}</Table.Cell><Table.Cell>{lote.area} {lote.unidad_area}</Table.Cell><Table.Cell>{money(lote.precio_base)}</Table.Cell><Table.Cell>{lote.precio == null ? 'Pendiente' : money(lote.precio)}</Table.Cell><Table.Cell><Badge colorPalette={lote.estado === 'disponible' ? 'green' : lote.estado === 'vendido' ? 'red' : 'orange'}>{lote.estado}</Badge></Table.Cell></Table.Row>)}</Table.Body>
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

      <Dialog.Root open={dialog === 'lotificacion'} onOpenChange={details => { if (!details.open) setDialog(''); }} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog">
          <form onSubmit={saveLotificacion}>
            <Dialog.Header><Dialog.Title>Nueva lotificación</Dialog.Title><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header>
            <Dialog.Body>
              {error && <Box role="alert" className="notice-error">{error}</Box>}
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Field.Root required><Field.Label>Nombre</Field.Label><Input value={form.nombre} onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))} required /></Field.Root>
                <Field.Root required><Field.Label>Ubicación</Field.Label><Input value={form.ubicacion} onChange={event => setForm(current => ({ ...current, ubicacion: event.target.value }))} required /></Field.Root>
                <Field.Root gridColumn={{ md: 'span 2' }}><Field.Label>Descripción</Field.Label><Textarea value={form.descripcion} onChange={event => setForm(current => ({ ...current, descripcion: event.target.value }))} rows={3} /></Field.Root>
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.Footer><Button variant="outline" onClick={() => setDialog('')} type="button">Cancelar</Button><Button colorPalette="blue" type="submit" loading={saving}>Guardar</Button></Dialog.Footer>
          </form>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={dialog === 'poligono'} onOpenChange={details => { if (!details.open) setDialog(''); }} size="md">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog"><form onSubmit={savePoligono}>
          <Dialog.Header><Dialog.Title>Nuevo polígono</Dialog.Title><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header>
          <Dialog.Body>{error && <Box role="alert" className="notice-error">{error}</Box>}<Field.Root required><Field.Label>Nombre del polígono</Field.Label><Input value={poligonoNombre} onChange={event => setPoligonoNombre(event.target.value)} required /></Field.Root></Dialog.Body>
          <Dialog.Footer><Button variant="outline" type="button" onClick={() => setDialog('')}>Cancelar</Button><Button colorPalette="blue" type="submit" loading={saving}>Guardar</Button></Dialog.Footer>
        </form></Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={dialog === 'lote'} onOpenChange={details => { if (!details.open) setDialog(''); }} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog"><form onSubmit={saveLote}>
          <Dialog.Header><Dialog.Title>Nuevo lote</Dialog.Title><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header>
          <Dialog.Body>{error && <Box role="alert" className="notice-error">{error}</Box>}<SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            <Field.Root required><Field.Label>Número de lote</Field.Label><Input type="number" min="1" value={loteForm.numero_lote} onChange={event => setLoteForm(current => ({ ...current, numero_lote: event.target.value }))} required /></Field.Root>
            <Field.Root required><Field.Label>Área</Field.Label><Input type="number" min="0.01" step="0.01" value={loteForm.area} onChange={event => setLoteForm(current => ({ ...current, area: event.target.value }))} required /></Field.Root>
            <Field.Root><Field.Label>Unidad</Field.Label><select className="native-select" value={loteForm.unidad_area} onChange={event => setLoteForm(current => ({ ...current, unidad_area: event.target.value }))}><option value="v2">v2</option><option value="m2">m2</option></select></Field.Root>
            <Field.Root required><Field.Label>Precio base</Field.Label><Input type="number" min="0" step="0.01" value={loteForm.precio_base} onChange={event => setLoteForm(current => ({ ...current, precio_base: event.target.value }))} required /></Field.Root>
            <Field.Root><Field.Label>Precio final</Field.Label><Input type="number" min="0" step="0.01" value={loteForm.precio} onChange={event => setLoteForm(current => ({ ...current, precio: event.target.value }))} /></Field.Root>
            <Field.Root><Field.Label>Estado</Field.Label><select className="native-select" value={loteForm.estado} onChange={event => setLoteForm(current => ({ ...current, estado: event.target.value }))}><option value="disponible">Disponible</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option></select></Field.Root>
          </SimpleGrid></Dialog.Body>
          <Dialog.Footer><Button variant="outline" type="button" onClick={() => setDialog('')}>Cancelar</Button><Button colorPalette="blue" type="submit" loading={saving}>Guardar lote</Button></Dialog.Footer>
        </form></Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Box>
  );
}
