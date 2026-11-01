import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, CloseButton, Dialog, Field, Flex, Heading, Input,
  Portal, SimpleGrid, Table, Text
} from '@chakra-ui/react';
import { BadgeDollarSign, FilePlus2, MapPinned, Search, UserRound } from 'lucide-react';
import { apiRequest } from '../api.js';

const initial = {
  tipo_financiamiento: 'interes_saldo', tasa_interes_anual: '16', dias_gracia: '0',
  penalizacion_fija: '50', dias_gracia_penal: '3', id_lotificacion: '',
  id_poligono: '', id_lote: '', precio_total: '', prima: '0', plazo_meses: '',
  fecha_inicio: new Date().toISOString().slice(0, 10)
};
const cash = value => `$${Number(value || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ContratosPage() {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientContracts, setClientContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState('');
  const [lotificaciones, setLotificaciones] = useState([]);
  const [poligonos, setPoligonos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [form, setForm] = useState(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState('');

  useEffect(() => {
    apiRequest('/api/lotificaciones').then(data => setLotificaciones(Array.isArray(data) ? data : []))
      .catch(requestError => setError(requestError.message || 'No se pudieron cargar lotificaciones.'));
  }, []);

  const montoFinanciado = Math.max(0, Number(form.precio_total || 0) - Number(form.prima || 0));
  const cuota = useMemo(() => {
    const plazo = Number(form.plazo_meses);
    if (montoFinanciado <= 0 || plazo <= 0) return 0;
    if (form.tipo_financiamiento !== 'interes_saldo') return Number((montoFinanciado / plazo).toFixed(2));
    const tasa = Number(form.tasa_interes_anual || 0) / 100 / 12;
    if (tasa <= 0) return Number((montoFinanciado / plazo).toFixed(2));
    const factor = Math.pow(1 + tasa, plazo);
    return Number((montoFinanciado * (tasa * factor) / (factor - 1)).toFixed(2));
  }, [form, montoFinanciado]);
  const precioFinal = cuota && Number(form.plazo_meses) ? cuota * Number(form.plazo_meses) + Number(form.prima || 0) : 0;

  async function buscarCliente(event) {
    event?.preventDefault();
    if (!search.trim()) return;
    setIsLoading(true); setError('');
    setSelectedClient(null);
    setClientContracts([]);
    setContractsError('');
    try {
      const result = await apiRequest(`/api/contratos/buscar-cliente/${encodeURIComponent(search.trim())}`);
      const matches = Array.isArray(result) ? result : [];
      setClients(matches);
      if (matches.length === 1) await seleccionarCliente(matches[0]);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo buscar clientes.');
    } finally { setIsLoading(false); }
  }

  async function seleccionarCliente(client) {
    if (selectedClient?.id_cliente !== client.id_cliente) {
      setForm(initial);
      setPoligonos([]);
      setLotes([]);
    }
    setSelectedClient(client);
    setError('');
    setContractsError('');
    setClientContracts([]);
    setContractsLoading(true);
    try {
      const result = await apiRequest(`/api/contratos/cliente/${client.id_cliente}`);
      setClientContracts(Array.isArray(result) ? result : []);
    } catch (requestError) {
      setContractsError(requestError.message || 'No se pudieron cargar contratos.');
    } finally { setContractsLoading(false); }
  }

  async function changeLotificacion(id) {
    setForm(current => ({ ...current, id_lotificacion: id, id_poligono: '', id_lote: '', precio_total: '' }));
    setPoligonos([]); setLotes([]);
    if (!id) return;
    try {
      const result = await apiRequest(`/api/poligonos/lotificacion/${id}`);
      setPoligonos(Array.isArray(result) ? result : []);
    } catch (requestError) { setError(requestError.message || 'No se pudieron cargar polígonos.'); }
  }

  async function changePoligono(id) {
    setForm(current => ({ ...current, id_poligono: id, id_lote: '', precio_total: '' }));
    setLotes([]);
    if (!id) return;
    try {
      const result = await apiRequest(`/api/lotes/disponibles/${id}`);
      setLotes(Array.isArray(result) ? result : []);
    } catch (requestError) { setError(requestError.message || 'No se pudieron cargar lotes disponibles.'); }
  }

  function changeLote(id) {
    const lote = lotes.find(item => String(item.id_lote) === String(id));
    setForm(current => ({
      ...current,
      id_lote: id,
      precio_total: lote ? String(lote.precio_base) : '',
      prima: lote && Number(current.prima) === 0 ? '2500' : current.prima
    }));
  }

  async function crearContrato(event) {
    event.preventDefault();
    if (!selectedClient) { setError('Busca y selecciona un cliente antes de crear el contrato.'); return; }
    if (!form.id_lote || cuota <= 0 || !form.fecha_inicio) { setError('Completa cliente, lote, plazo y fecha de inicio.'); return; }
    setSaving(true); setError('');
    const penalizacion = form.tipo_financiamiento === 'penalizacion_fija';
    const payload = {
      id_cliente: selectedClient.id_cliente,
      id_lote: Number(form.id_lote),
      tipo_financiamiento: form.tipo_financiamiento,
      precio_total: Number(form.precio_total),
      prima: Number(form.prima),
      monto_financiado: montoFinanciado,
      plazo_meses: Number(form.plazo_meses),
      cuota,
      fecha_inicio: form.fecha_inicio,
      tasa_interes_anual: penalizacion ? null : Number(form.tasa_interes_anual),
      penalizacion_fija: penalizacion ? Number(form.penalizacion_fija) : null,
      dias_gracia: Number(penalizacion ? form.dias_gracia_penal : form.dias_gracia)
    };
    try {
      await apiRequest('/api/contratos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setNotice('Contrato creado correctamente.');
      setForm(initial);
      setPoligonos([]); setLotes([]);
      setDialog('');
      await seleccionarCliente(selectedClient);
    } catch (requestError) { setError(requestError.message || 'No se pudo crear el contrato.'); }
    finally { setSaving(false); }
  }

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return (
    <Box>
      <Box className="page-heading"><Text className="eyebrow">GESTIÓN FINANCIERA</Text><Heading size="2xl" className="page-title">Contratos</Heading><Text className="page-description">Busca clientes, consulta contratos y crea planes de financiamiento.</Text></Box>
      {notice && <Box className="notice-success" role="status">{notice}</Box>}
      <section className="customers-card module-section">
        <Flex justify="space-between" align="center" gap="4" wrap="wrap">
          <Box><Heading size="md">1. Busca un cliente</Heading><Text className="table-subtitle">Sus contratos aparecerán debajo al seleccionarlo.</Text></Box>
        </Flex>
        <form className="module-search contract-search" onSubmit={buscarCliente}>
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre o apellido" aria-label="Buscar cliente por nombre o apellido" />
          <Button type="submit" colorPalette="blue" loading={isLoading}><Search size={16} aria-hidden="true" /> Buscar</Button>
        </form>
        {error && !dialog && <Box className="notice-error" role="alert">{error}</Box>}
        {selectedClient && <Flex className="selected-client-summary" justify="space-between" align="center" gap="3" wrap="wrap">
          <Flex align="center" gap="3"><span className="selected-client-icon"><UserRound size={18} aria-hidden="true" /></span><Box><Text className="stat-label">Cliente seleccionado</Text><strong>{selectedClient.nombres} {selectedClient.apellidos}</strong><Text className="table-subtitle">{selectedClient.dui || 'Sin DUI registrado'}</Text></Box></Flex>
        </Flex>}
        {clients.length > 0 && <div className="table-scroll contract-results">
          <Table.Root className="customers-table" size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Cliente</Table.ColumnHeader><Table.ColumnHeader>DUI</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Acciones</Table.ColumnHeader></Table.Row></Table.Header>
            <Table.Body>{clients.map(client => <Table.Row key={client.id_cliente}>
              <Table.Cell><strong>{client.nombres} {client.apellidos}</strong></Table.Cell>
              <Table.Cell>{client.dui || '—'}</Table.Cell>
              <Table.Cell textAlign="right"><Flex justify="flex-end" gap="2">
                <Button size="sm" variant={selectedClient?.id_cliente === client.id_cliente ? 'solid' : 'outline'} colorPalette="blue" disabled={selectedClient?.id_cliente === client.id_cliente} loading={contractsLoading && selectedClient?.id_cliente === client.id_cliente} onClick={() => seleccionarCliente(client)}>
                  {selectedClient?.id_cliente === client.id_cliente ? 'Seleccionado' : 'Ver contratos'}
                </Button>
              </Flex></Table.Cell>
            </Table.Row>)}</Table.Body>
          </Table.Root>
        </div>}
      </section>
      {selectedClient && <section className="customers-card module-section">
        <Flex justify="space-between" align="center" gap="4" wrap="wrap" mb="3">
          <Box><Heading size="md">2. Contratos del cliente</Heading><Text className="table-subtitle">{selectedClient.nombres} {selectedClient.apellidos}</Text></Box>
          <Button colorPalette="blue" onClick={() => { setError(''); setDialog('create'); }}>
            <FilePlus2 size={17} aria-hidden="true" /> Nuevo contrato
          </Button>
        </Flex>
        {contractsError && <Box className="notice-error" role="alert">{contractsError}</Box>}
        <div className="table-scroll"><Table.Root className="customers-table" size="sm">
          <Table.Header><Table.Row><Table.ColumnHeader>ID</Table.ColumnHeader><Table.ColumnHeader>Lote</Table.ColumnHeader><Table.ColumnHeader>Precio</Table.ColumnHeader><Table.ColumnHeader>Plazo</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader></Table.Row></Table.Header>
          <Table.Body>{contractsLoading
            ? <Table.Row><Table.Cell colSpan={5} className="empty-row">Cargando contratos…</Table.Cell></Table.Row>
            : clientContracts.length
              ? clientContracts.map(contract => <Table.Row key={contract.id_contrato}><Table.Cell>#{contract.id_contrato}</Table.Cell><Table.Cell>{contract.lotificacion} / {contract.poligono} / Lote {contract.numero_lote}</Table.Cell><Table.Cell>{cash(contract.precio_total)}</Table.Cell><Table.Cell>{contract.plazo_meses} meses</Table.Cell><Table.Cell><Badge colorPalette={contract.estado === 'activo' ? 'green' : 'gray'}>{contract.estado}</Badge></Table.Cell></Table.Row>)
              : <Table.Row><Table.Cell colSpan={5} className="empty-row">Este cliente todavía no tiene contratos.</Table.Cell></Table.Row>}
          </Table.Body>
        </Table.Root></div>
      </section>}
      <Dialog.Root open={dialog === 'create'} onOpenChange={details => { if (!details.open) setDialog(''); }} size="xl">
        <Portal><Dialog.Backdrop /><Dialog.Positioner className="contract-dialog-positioner"><Dialog.Content className="customer-dialog contract-dialog">
          <form onSubmit={crearContrato}>
            <Dialog.Header className="contract-dialog-header">
              <Box><Dialog.Title>Nuevo contrato</Dialog.Title><Text className="dialog-subtitle">{selectedClient ? `${selectedClient.nombres} ${selectedClient.apellidos}` : 'Configura el lote y las condiciones del contrato.'}</Text></Box>
              <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body className="contract-dialog-body">
              {error && <Box className="notice-error" role="alert">{error}</Box>}
              <section className="contract-form-section">
                <Flex align="center" gap="2" mb="3"><MapPinned size={17} aria-hidden="true" /><Heading size="sm">1. Lote</Heading></Flex>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
                  <Field.Root required><Field.Label>Lotificación</Field.Label><select className="native-select" value={form.id_lotificacion} onChange={event => changeLotificacion(event.target.value)}><option value="">Selecciona una lotificación</option>{lotificaciones.map(item => <option key={item.id_lotificacion} value={item.id_lotificacion}>{item.nombre}</option>)}</select></Field.Root>
                  <Field.Root required><Field.Label>Polígono</Field.Label><select className="native-select" value={form.id_poligono} disabled={!form.id_lotificacion} onChange={event => changePoligono(event.target.value)}><option value="">Selecciona un polígono</option>{poligonos.map(item => <option key={item.id_poligono} value={item.id_poligono}>{item.nombre}</option>)}</select></Field.Root>
                  <Field.Root required><Field.Label>Lote disponible</Field.Label><select className="native-select" value={form.id_lote} disabled={!form.id_poligono} onChange={event => changeLote(event.target.value)}><option value="">Selecciona un lote</option>{lotes.map(item => <option key={item.id_lote} value={item.id_lote}>Lote {item.numero_lote} ({cash(item.precio_base)})</option>)}</select></Field.Root>
                </SimpleGrid>
              </section>
              <section className="contract-form-section">
                <Flex align="center" gap="2" mb="3"><BadgeDollarSign size={17} aria-hidden="true" /><Heading size="sm">2. Financiamiento</Heading></Flex>
                <Flex className="contract-finance-options" gap="5" wrap="wrap" mb="4">
                  {['interes_saldo', 'penalizacion_fija'].map(type => <label className="radio-option" key={type}><input type="radio" name="tipo_financiamiento" checked={form.tipo_financiamiento === type} onChange={() => update('tipo_financiamiento', type)} />{type === 'interes_saldo' ? 'Interés sobre saldo' : 'Penalización fija'}</label>)}
                </Flex>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  <Field.Root required><Field.Label>Precio del lote</Field.Label><Input type="number" min="0" step="0.01" value={form.precio_total} onChange={event => update('precio_total', event.target.value)} required /></Field.Root>
                  <Field.Root><Field.Label>Prima</Field.Label><Input type="number" min="0" step="0.01" value={form.prima} onChange={event => update('prima', event.target.value)} /></Field.Root>
                  <Field.Root><Field.Label>Plazo (meses)</Field.Label><Input type="number" min="1" value={form.plazo_meses} onChange={event => update('plazo_meses', event.target.value)} required /></Field.Root>
                  <Field.Root required><Field.Label>Fecha de inicio</Field.Label><Input type="date" value={form.fecha_inicio} onChange={event => update('fecha_inicio', event.target.value)} required /></Field.Root>
                  {form.tipo_financiamiento === 'interes_saldo' ? <>
                    <Field.Root><Field.Label>Tasa anual (%)</Field.Label><Input type="number" min="0" step="0.01" value={form.tasa_interes_anual} onChange={event => update('tasa_interes_anual', event.target.value)} /></Field.Root>
                    <Field.Root><Field.Label>Días de gracia</Field.Label><Input type="number" min="0" value={form.dias_gracia} onChange={event => update('dias_gracia', event.target.value)} /></Field.Root>
                  </> : <>
                    <Field.Root><Field.Label>Penalización por cuota ($)</Field.Label><Input type="number" min="0" step="0.01" value={form.penalizacion_fija} onChange={event => update('penalizacion_fija', event.target.value)} /></Field.Root>
                    <Field.Root><Field.Label>Días de gracia</Field.Label><Input type="number" min="0" value={form.dias_gracia_penal} onChange={event => update('dias_gracia_penal', event.target.value)} /></Field.Root>
                  </>}
                </SimpleGrid>
              </section>
              <SimpleGrid className="contract-summary" columns={{ base: 1, sm: 3 }} gap="3">
                <Box><Text className="stat-label">Monto financiado</Text><strong>{cash(montoFinanciado)}</strong></Box>
                <Box><Text className="stat-label">Cuota mensual estimada</Text><strong>{cash(cuota)}</strong></Box>
                <Box><Text className="stat-label">Precio final estimado</Text><strong>{cash(precioFinal)}</strong></Box>
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.Footer className="contract-dialog-footer"><Button type="button" variant="outline" onClick={() => setDialog('')}>Cancelar</Button><Button type="submit" colorPalette="blue" loading={saving} disabled={!selectedClient || !form.id_lote}>Crear contrato</Button></Dialog.Footer>
          </form>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Box>
  );
}
