import { useRef, useState } from 'react';
import {
  Badge, Box, Button, Dialog, Field, Flex, Heading, Input, Portal,
  SimpleGrid, Table, Text, CloseButton
} from '@chakra-ui/react';
import { FileUp, Layers3, MapPin, Printer, ReceiptText, Search } from 'lucide-react';
import { apiRequest } from '../api.js';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = value => `$${Number(value || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = value => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
const paymentMethods = ['Efectivo', 'Remesa', 'Transferencia', 'Cheque'];

export default function PagosPage() {
  const accountRequestId = useRef(0);
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [contractId, setContractId] = useState('');
  const [account, setAccount] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receiptImage, setReceiptImage] = useState('');
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [locationLotifications, setLocationLotifications] = useState([]);
  const [locationPolygons, setLocationPolygons] = useState([]);
  const [locationLots, setLocationLots] = useState([]);
  const [locationLotificationId, setLocationLotificationId] = useState('');
  const [locationPolygonId, setLocationPolygonId] = useState('');
  const [locationLotId, setLocationLotId] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [payment, setPayment] = useState({ amount: '', date: today(), receiptDate: today(), method: '', bank: '', receipt: '' });
  const [batch, setBatch] = useState({ until: '', date: today(), receiptDate: today(), method: '', bank: '', receipt: '' });
  const [paymentId, setPaymentId] = useState(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState('');
  const [editingPaymentId, setEditingPaymentId] = useState('');
  const [editingAmount, setEditingAmount] = useState('');
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingContractId, setLoadingContractId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function searchAccount(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    const requestId = ++accountRequestId.current;
    setLoadingContractId('');
    setBusy(true); setError('');
    setClients([]);
    setSelectedClient(null);
    setContracts([]);
    setAccount(null);
    setInstallments([]);
    setPayments([]);
    setContractId('');
    try {
      const searchValue = query.trim();
      const lotCode = searchValue.replace(/\s+/g, '');
      if (/^\d+[A-Z]+\d+$/i.test(lotCode)) {
        const data = await apiRequest('/api/pagos/por-codigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: lotCode })
        });
        const [cuotas, paymentRows] = await Promise.all([
          apiRequest(`/api/cuotas/contrato/${data.contrato.id_contrato}`),
          apiRequest(`/api/pagos/contrato/${data.contrato.id_contrato}`)
        ]);
        if (requestId !== accountRequestId.current) return;
        setAccount(data);
        setInstallments(Array.isArray(cuotas) ? cuotas : []);
        setPayments(Array.isArray(paymentRows) ? paymentRows : []);
        setContractId(String(data.contrato.id_contrato));
        setPayment(current => ({ ...current, amount: data.total_sugerido_pago_unico ?? data.total ?? '' }));
        const dueDate = data.cuota?.fecha_vencimiento?.slice(0, 10) || today();
        setBatch(current => ({
          ...current,
          until: data.cuota ? Number(data.cuota.numero_cuota) : '',
          date: dueDate,
          receiptDate: dueDate
        }));
        return;
      }

      const data = await apiRequest(`/api/contratos/buscar-cliente/${encodeURIComponent(searchValue)}`);
      if (requestId !== accountRequestId.current) return;
      const results = Array.isArray(data) ? data : [];
      setClients(results);
      if (results.length === 1) await chooseClient(results[0]);
    } catch (requestError) { setError(requestError.message || 'No se pudieron buscar clientes.'); }
    finally { setBusy(false); }
  }

  async function chooseClient(client) {
    accountRequestId.current += 1;
    setLoadingContractId('');
    setBusy(true); setError(''); setAccount(null); setInstallments([]); setPayments([]); setContractId('');
    setSelectedClient(client);
    setContracts([]);
    try {
      const data = await apiRequest(`/api/contratos/cliente/${client.id_cliente}`);
      setContracts(Array.isArray(data) ? data : []);
    } catch (requestError) { setError(requestError.message || 'No se pudieron cargar contratos.'); }
    finally { setBusy(false); }
  }

  async function loadAccount(id, date = today()) {
    const requestId = ++accountRequestId.current;
    setContractId(String(id));
    setAccount(null);
    setInstallments([]);
    setPayments([]);
    setLoadingContractId(String(id));
    setError('');
    try {
      const [data, cuotas, paymentRows] = await Promise.all([
        apiRequest(`/api/pagos/estado/${id}?fecha_abono=${encodeURIComponent(date)}`),
        apiRequest(`/api/cuotas/contrato/${id}`),
        apiRequest(`/api/pagos/contrato/${id}`)
      ]);
      if (requestId !== accountRequestId.current) return;
      setAccount(data);
      setInstallments(Array.isArray(cuotas) ? cuotas : []);
      setPayments(Array.isArray(paymentRows) ? paymentRows : []);
      setPayment(current => ({
        ...current,
        date: date < (data.limites_fecha_abono?.min || date) ? data.limites_fecha_abono.min : date,
        receiptDate: date < (data.limites_fecha_abono?.min || date) ? data.limites_fecha_abono.min : date,
        amount: data.total_sugerido_pago_unico ?? data.total ?? ''
      }));
      const firstDue = data.cuota ? Number(data.cuota.numero_cuota) : '';
      setBatch(current => ({
        ...current,
        until: firstDue,
        date: data.cuota?.fecha_vencimiento?.slice(0, 10) || date,
        receiptDate: data.cuota?.fecha_vencimiento?.slice(0, 10) || date
      }));
    } catch (requestError) {
      if (requestId === accountRequestId.current) {
        setError(requestError.message || 'No se pudo cargar el estado de cuenta.');
      }
    } finally {
      if (requestId === accountRequestId.current) setLoadingContractId('');
    }
  }

  async function saveEditedPayment(event) {
    event.preventDefault();
    if (!editingPaymentId) return;
    setPaymentActionBusy(true);
    setError('');
    try {
      await apiRequest(`/api/pagos/${editingPaymentId}/monto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto_pagado: editingAmount })
      });
      setEditingPaymentId('');
      await loadAccount(contractId, payment.date);
      setNotice('Monto actualizado y recalculado correctamente.');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo recalcular el monto del pago.');
    } finally {
      setPaymentActionBusy(false);
    }
  }

  async function deleteLatestPayment(paymentRow) {
    if (!window.confirm(`¿Eliminar el último pago de ${money(paymentRow.monto_total)}? Esta acción actualizará el saldo de la cuota.`)) return;
    setPaymentActionBusy(true);
    setError('');
    try {
      await apiRequest(`/api/pagos/${paymentRow.id_pago}`, { method: 'DELETE' });
      await loadAccount(contractId, payment.date);
      setNotice('Último pago eliminado correctamente.');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo eliminar el último pago.');
    } finally {
      setPaymentActionBusy(false);
    }
  }

  async function openLocationSearch() {
    setLocationSearchOpen(true);
    setLocationError('');
    if (locationLotifications.length) return;
    setLocationLoading(true);
    try {
      const data = await apiRequest('/api/lotificaciones');
      setLocationLotifications(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setLocationError(requestError.message || 'No se pudieron cargar las lotificaciones.');
    } finally {
      setLocationLoading(false);
    }
  }

  async function changeLocationLotification(id) {
    setLocationLotificationId(id);
    setLocationPolygonId('');
    setLocationLotId('');
    setLocationPolygons([]);
    setLocationLots([]);
    setLocationError('');
    if (!id) return;
    setLocationLoading(true);
    try {
      const data = await apiRequest(`/api/poligonos/lotificacion/${id}`);
      setLocationPolygons(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setLocationError(requestError.message || 'No se pudieron cargar los polígonos.');
    } finally {
      setLocationLoading(false);
    }
  }

  async function changeLocationPolygon(id) {
    setLocationPolygonId(id);
    setLocationLotId('');
    setLocationLots([]);
    setLocationError('');
    if (!id) return;
    setLocationLoading(true);
    try {
      const data = await apiRequest(`/api/lotes/poligono/${id}`);
      setLocationLots(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setLocationError(requestError.message || 'No se pudieron cargar los lotes.');
    } finally {
      setLocationLoading(false);
    }
  }

  async function searchByLocation() {
    if (!locationLotId) return;
    const requestId = ++accountRequestId.current;
    setLocationLoading(true);
    setLocationError('');
    setError('');
    try {
      const found = await apiRequest(`/api/contratos/lote/${locationLotId}`);
      if (requestId !== accountRequestId.current) return;
      setClients([]);
      setSelectedClient({
        id_cliente: found.id_cliente,
        nombres: found.cliente,
        apellidos: ''
      });
      setContracts([found]);
      setContractId('');
      setAccount(null);
      setInstallments([]);
      setPayments([]);
      setLocationSearchOpen(false);
      await loadAccount(found.id_contrato);
    } catch (requestError) {
      if (requestId === accountRequestId.current) {
        setLocationError(requestError.message || 'No se encontró un contrato para ese lote.');
      }
    } finally {
      setLocationLoading(false);
    }
  }

  async function registerPayment(event) {
    event.preventDefault();
    if (!account?.cuota) { setError('Selecciona un contrato con una cuota pendiente.'); return; }
    const amount = Number(String(payment.amount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { setError('Ingresa un monto válido.'); return; }
    if (payment.method !== 'Efectivo' && !payment.bank.trim()) { setError('El banco es obligatorio para esta forma de pago.'); return; }
    const suggested = Number(account.total_sugerido_pago_unico ?? account.total ?? 0);
    if (amount < suggested && !window.confirm(`El pago es menor al total sugerido de ${money(suggested)}. ¿Deseas continuar con un pago parcial?`)) return;
    setBusy(true); setError('');
    try {
      const result = await apiRequest('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cuota: account.cuota.id_cuota,
          monto_pagado: amount,
          fecha_abono: payment.date,
          fecha_recibo: payment.receiptDate,
          forma_pago: payment.method,
          banco: payment.bank.trim() || null,
          numero_recibo: payment.receipt.trim()
        })
      });
      setPaymentId(result.id_pago);
      setReceiptNumber(payment.receipt);
      setFile(null); setPreview('');
      setDialogOpen(true);
      setPaymentDialog('');
      setNotice(`Pago registrado correctamente. Recibo ${payment.receipt}.`);
      await loadAccount(contractId, payment.date);
    } catch (requestError) { setError(requestError.message || 'No se pudo registrar el pago.'); }
    finally { setBusy(false); }
  }

  async function registerBatch(event) {
    event.preventDefault();
    if (!account?.contrato || !account.cuota) { setError('Selecciona primero un contrato con cuotas pendientes.'); return; }
    if (batch.method !== 'Efectivo' && !batch.bank.trim()) { setError('El banco es obligatorio para esta forma de pago.'); return; }
    setBusy(true); setError('');
    try {
      const result = await apiRequest('/api/pagos/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_contrato: Number(contractId),
          cuota_desde: Number(account.cuota.numero_cuota),
          cuota_hasta: Number(batch.until),
          fecha_abono: batch.date,
          fecha_recibo: batch.receiptDate,
          forma_pago: batch.method,
          banco: batch.bank.trim() || null,
          numero_recibo: batch.receipt.trim()
        })
      });
      const summary = result.resumen || {};
      setNotice(`Pago múltiple registrado: ${summary.cuotas_pagadas || 0} cuotas, total ${money(summary.monto_total_pagado)}.`);
      setPaymentDialog('');
      await loadAccount(contractId, batch.date);
    } catch (requestError) { setError(requestError.message || 'No se pudo registrar el pago múltiple.'); }
    finally { setBusy(false); }
  }

  async function uploadReceipt(event) {
    event.preventDefault();
    if (!paymentId || !file) { setError('Selecciona una imagen de comprobante.'); return; }
    setBusy(true); setError('');
    try {
      const formData = new FormData();
      formData.append('id_pago', String(paymentId));
      formData.append('comprobante', file);
      await apiRequest('/api/documentos/comprobante', { method: 'POST', body: formData });
      await loadAccount(contractId, payment.date);
      setNotice('Comprobante subido correctamente.');
      setDialogOpen(false);
    } catch (requestError) { setError(requestError.message || 'No se pudo subir el comprobante.'); }
    finally { setBusy(false); }
  }

  function updatePayment(key, value) { setPayment(current => ({ ...current, [key]: value })); }
  function updateBatch(key, value) { setBatch(current => ({ ...current, [key]: value })); }
  const quota = account?.cuota;
  const selectedContract = contracts.find(contract => String(contract.id_contrato) === contractId);
  const accountClientName = account?.cliente?.nombre
    || [selectedClient?.nombres, selectedClient?.apellidos].filter(Boolean).join(' ');
  const accountLot = account?.lote || selectedContract;
  const latestPaymentId = payments.reduce(
    (latestId, item) => Math.max(latestId, Number(item.id_pago) || 0),
    0
  );

  return (
    <Box>
      <Box className="page-heading"><Text className="eyebrow">CAJA</Text><Heading size="2xl" className="page-title">Pagos</Heading><Text className="page-description">Consulta estados de cuenta y registra pagos individuales o múltiples.</Text></Box>
      {notice && <Box role="status" className="notice-success">{notice}</Box>}
      {error && <Box role="alert" className="notice-error">{error}</Box>}
      <section className="customers-card module-section">
        <Flex justify="space-between" align="center" gap="4" wrap="wrap" mb="4">
          <Box><Heading size="md">1. Buscar cuenta</Heading><Text className="table-subtitle">Busca un cliente por nombre o apellido, o una cuenta por código de lote.</Text></Box>
        </Flex>
        <Flex align="center" gap="3" wrap="wrap">
          <form className="module-search payment-unified-search" onSubmit={searchAccount}>
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o apellido del cliente, o código de lote (ej. 001A1)" aria-label="Nombre o apellido del cliente, o código de lote" />
            <Button type="submit" colorPalette="blue" loading={busy}><Search size={16} aria-hidden="true" /> Buscar</Button>
          </form>
          <Button variant="outline" colorPalette="blue" onClick={openLocationSearch}>
            <MapPin size={16} aria-hidden="true" /> Buscar por ubicación
          </Button>
        </Flex>
        {clients.length > 0 && <div className="table-scroll payment-client-results"><Table.Root className="customers-table" size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Cliente</Table.ColumnHeader><Table.ColumnHeader>DUI</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Acción</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{clients.map(client => <Table.Row key={client.id_cliente}><Table.Cell><strong>{client.nombres} {client.apellidos}</strong></Table.Cell><Table.Cell>{client.dui || '—'}</Table.Cell><Table.Cell textAlign="right"><Button size="sm" variant={selectedClient?.id_cliente === client.id_cliente ? 'solid' : 'outline'} colorPalette="blue" disabled={selectedClient?.id_cliente === client.id_cliente} loading={busy && selectedClient?.id_cliente === client.id_cliente} onClick={() => chooseClient(client)}>{selectedClient?.id_cliente === client.id_cliente ? 'Seleccionado' : 'Ver contratos'}</Button></Table.Cell></Table.Row>)}</Table.Body></Table.Root></div>}
      </section>
      {selectedClient && <section className="customers-card module-section">
        <Flex justify="space-between" align="center" gap="3" mb="3"><Box><Heading size="md">2. Contratos del cliente</Heading><Text className="table-subtitle">{selectedClient.nombres} {selectedClient.apellidos}</Text></Box></Flex>
        <div className="table-scroll"><Table.Root className="customers-table" size="sm"><Table.Header><Table.Row><Table.ColumnHeader>ID</Table.ColumnHeader><Table.ColumnHeader>Lote</Table.ColumnHeader><Table.ColumnHeader>Plazo</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader><Table.ColumnHeader>Acción</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{contracts.length ? contracts.map(contract => <Table.Row key={contract.id_contrato}><Table.Cell>#{contract.id_contrato}</Table.Cell><Table.Cell>{contract.lotificacion} / {contract.poligono} / Lote {contract.numero_lote}</Table.Cell><Table.Cell>{contract.plazo_meses} meses</Table.Cell><Table.Cell><Badge colorPalette={contract.estado === 'activo' ? 'green' : 'gray'}>{contract.estado}</Badge></Table.Cell><Table.Cell><Button size="sm" colorPalette="blue" loading={loadingContractId === String(contract.id_contrato)} disabled={Boolean(loadingContractId)} onClick={() => loadAccount(contract.id_contrato)}>{contractId === String(contract.id_contrato) && account ? 'Cuenta seleccionada' : 'Ver estado de cuenta'}</Button></Table.Cell></Table.Row>) : <Table.Row><Table.Cell colSpan={5} className="empty-row">Este cliente no tiene contratos.</Table.Cell></Table.Row>}</Table.Body></Table.Root></div>
      </section>}
      {account && String(account.contrato?.id_contrato) === contractId && <section className="customers-card module-section">
        <Flex justify="space-between" align="center" mb="4"><Box><Heading size="md">Estado de cuenta</Heading><Text className="table-subtitle">{accountClientName || `Contrato #${account.contrato?.id_contrato}`} · {accountLot ? `${accountLot.lotificacion} / ${accountLot.poligono} / Lote ${accountLot.numero_lote}` : ''}</Text></Box><Badge colorPalette={quota ? 'orange' : 'green'}>{quota ? 'Cuota pendiente' : 'Al día'}</Badge></Flex>
        {quota ? <>
          <div className="table-scroll"><Table.Root className="customers-table"><Table.Header><Table.Row><Table.ColumnHeader>Siguiente cuota a pagar</Table.ColumnHeader><Table.ColumnHeader>Vencimiento</Table.ColumnHeader><Table.ColumnHeader>Cuota y cargos</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader><Table.ColumnHeader>Total sugerido</Table.ColumnHeader></Table.Row></Table.Header><Table.Body><Table.Row><Table.Cell>{account.cuotas_exigibles > 1 ? `${account.cuota_desde_requerida}-${account.cuota_hasta_requerida}` : quota.numero_cuota}</Table.Cell><Table.Cell>{dateLabel(quota.fecha_vencimiento)}</Table.Cell><Table.Cell>{money(account.total_cuotas_exigibles ?? quota.monto_cuota)}<Text className="table-subtitle">Mora: {money(account.mora_global_exigible ?? account.cargos)}</Text></Table.Cell><Table.Cell><Badge colorPalette={account.estado_cuota === 'atrasada' ? 'red' : 'orange'}>{account.estado_cuota || 'Pendiente'}</Badge></Table.Cell><Table.Cell><strong>{money(account.total_sugerido_pago_unico ?? account.total)}</strong></Table.Cell></Table.Row></Table.Body></Table.Root></div>
          <SimpleGrid className="payment-actions" columns={{ base: 1, sm: 2 }} gap="3" mt="4">
            <Button className="payment-action-button" colorPalette="blue" variant="outline" onClick={() => setPaymentDialog('single')}>
              <ReceiptText size={17} aria-hidden="true" /> Registrar pago individual
            </Button>
            <Button className="payment-action-button" colorPalette="blue" variant="outline" onClick={() => setPaymentDialog('batch')}>
              <Layers3 size={17} aria-hidden="true" /> Registrar pago múltiple
            </Button>
          </SimpleGrid>
        </> : <Box className="empty-row">No hay cuotas pendientes para este contrato.</Box>}
        <Box mt="6">
          <Heading size="sm" mb="3">Todas las cuotas</Heading>
          <div className="table-scroll">
            <Table.Root className="customers-table" size="sm">
              <Table.Header><Table.Row><Table.ColumnHeader>Cuota</Table.ColumnHeader><Table.ColumnHeader>Vencimiento</Table.ColumnHeader><Table.ColumnHeader>Monto</Table.ColumnHeader><Table.ColumnHeader>Abonado</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader><Table.ColumnHeader>Comprobante / último pago</Table.ColumnHeader></Table.Row></Table.Header>
              <Table.Body>
                {installments.length ? installments.map(installment => {
                  const paidAmount = Number(installment.total_pagado || 0);
                  const installmentPayments = payments.filter(
                    item => Number(item.numero_cuota) === Number(installment.numero_cuota)
                  );
                  const receipts = installmentPayments.filter(item => item.ruta_archivo);
                  const latestPayment = installmentPayments.find(
                    item => Number(item.id_pago) === latestPaymentId
                  );
                  const status = installment.estado === 'pagada'
                    ? 'Pagada'
                    : paidAmount > 0 ? 'Abono parcial' : 'Pendiente';
                  const statusColor = status === 'Pagada' ? 'green' : status === 'Abono parcial' ? 'orange' : 'gray';
                  return <Table.Row key={installment.id_cuota}>
                    <Table.Cell>{installment.numero_cuota}</Table.Cell>
                    <Table.Cell>{dateLabel(installment.fecha_vencimiento)}</Table.Cell>
                    <Table.Cell>{money(installment.monto_cuota)}</Table.Cell>
                    <Table.Cell>{money(paidAmount)}</Table.Cell>
                    <Table.Cell><Badge colorPalette={statusColor}>{status}</Badge></Table.Cell>
                    <Table.Cell>
                      <Flex gap="2" wrap="wrap" align="center">
                        {receipts.map(item =>
                          <Button
                            key={`receipt-${item.id_pago}`}
                            size="xs"
                            variant="outline"
                            colorPalette="blue"
                            aria-label={`Ver comprobante de la cuota ${installment.numero_cuota}${item.numero_recibo ? `, recibo ${item.numero_recibo}` : ''}`}
                            onClick={() => setReceiptImage(`/${String(item.ruta_archivo).replace(/^\/+/, '')}`)}
                          >
                            Ver foto{receipts.length > 1 ? ` · ${item.numero_recibo || item.id_pago}` : ''}
                          </Button>
                        )}
                        {latestPayment && <>
                          <Button
                            size="xs"
                            variant="outline"
                            colorPalette="blue"
                            disabled={paymentActionBusy}
                            onClick={() => {
                              setEditingPaymentId(String(latestPayment.id_pago));
                              setEditingAmount(String(latestPayment.monto_total));
                            }}
                          >
                            Editar monto
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            colorPalette="red"
                            loading={paymentActionBusy}
                            onClick={() => deleteLatestPayment(latestPayment)}
                          >
                            Eliminar último pago
                          </Button>
                        </>}
                        {!receipts.length && !latestPayment && <Text className="table-subtitle">—</Text>}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>;
                }) : <Table.Row><Table.Cell colSpan={6} className="empty-row">No hay cuotas registradas para este contrato.</Table.Cell></Table.Row>}
              </Table.Body>
            </Table.Root>
          </div>
        </Box>
      </section>}

      <Dialog.Root open={Boolean(editingPaymentId)} onOpenChange={details => { if (!details.open) setEditingPaymentId(''); }} size="md">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog">
          <form onSubmit={saveEditedPayment}>
            <Dialog.Header>
              <Box><Dialog.Title>Corregir monto del último pago</Dialog.Title><Text className="dialog-subtitle">Se recalcularán capital, intereses y mora usando la fecha original del pago.</Text></Box>
              <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              {error && <Box role="alert" className="notice-error" mb="4">{error}</Box>}
              <Field.Root>
                <Field.Label>Nuevo monto</Field.Label>
                <Input type="number" min="0.01" step="0.01" value={editingAmount} onChange={event => setEditingAmount(event.target.value)} required />
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="outline" onClick={() => setEditingPaymentId('')}>Cancelar</Button>
              <Button type="submit" colorPalette="blue" loading={paymentActionBusy}>Recalcular pago</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>

      <Dialog.Root open={Boolean(receiptImage)} onOpenChange={details => { if (!details.open) setReceiptImage(''); }} size="xl">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog">
          <Dialog.Header><Box><Dialog.Title>Comprobante de pago</Dialog.Title><Text className="dialog-subtitle">Imagen adjunta al pago registrado.</Text></Box><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header>
          <Dialog.Body><img className="receipt-preview" src={receiptImage} alt="Comprobante del pago" /></Dialog.Body>
          <Dialog.Footer><Button variant="outline" onClick={() => setReceiptImage('')}>Cerrar</Button></Dialog.Footer>
        </Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>

      <Dialog.Root open={locationSearchOpen} onOpenChange={details => setLocationSearchOpen(details.open)} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog">
          <Dialog.Header>
            <Box><Dialog.Title>Buscar cuenta por ubicación</Dialog.Title><Text className="dialog-subtitle">Selecciona la lotificación, el polígono y el lote.</Text></Box>
            <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            {locationError && <Box role="alert" className="notice-error" mb="4">{locationError}</Box>}
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4">
              <Field.Root>
                <Field.Label>Lotificación</Field.Label>
                <select className="native-select" value={locationLotificationId} onChange={event => changeLocationLotification(event.target.value)} disabled={locationLoading && !locationLotifications.length}>
                  <option value="">Selecciona</option>
                  {locationLotifications.map(item => <option key={item.id_lotificacion} value={item.id_lotificacion}>{item.nombre}</option>)}
                </select>
              </Field.Root>
              <Field.Root>
                <Field.Label>Polígono</Field.Label>
                <select className="native-select" value={locationPolygonId} onChange={event => changeLocationPolygon(event.target.value)} disabled={!locationLotificationId || locationLoading}>
                  <option value="">Selecciona</option>
                  {locationPolygons.map(item => <option key={item.id_poligono} value={item.id_poligono}>{item.nombre}</option>)}
                </select>
              </Field.Root>
              <Field.Root>
                <Field.Label>Lote</Field.Label>
                <select className="native-select" value={locationLotId} onChange={event => setLocationLotId(event.target.value)} disabled={!locationPolygonId || locationLoading}>
                  <option value="">Selecciona</option>
                  {locationLots.map(item => <option key={item.id_lote} value={item.id_lote}>Lote {item.numero_lote}</option>)}
                </select>
              </Field.Root>
            </SimpleGrid>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={() => setLocationSearchOpen(false)}>Cancelar</Button>
            <Button colorPalette="blue" onClick={searchByLocation} loading={locationLoading} disabled={!locationLotId}>
              <Search size={16} aria-hidden="true" /> Buscar cuenta
            </Button>
          </Dialog.Footer>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={paymentDialog === 'single'} onOpenChange={details => { if (!details.open) setPaymentDialog(''); }} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner className="payment-dialog-positioner"><Dialog.Content className="customer-dialog payment-entry-dialog">
          <form onSubmit={registerPayment}>
            <Dialog.Header className="payment-dialog-header"><Box><Dialog.Title>Registrar pago individual</Dialog.Title><Text className="dialog-subtitle">Contrato #{contractId} · Cuota {quota?.numero_cuota}</Text></Box><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header>
            <Dialog.Body className="payment-dialog-body">
              {error && <Box role="alert" className="notice-error">{error}</Box>}
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                <Field.Root><Field.Label>Fecha de abono</Field.Label><Input type="date" min={account?.limites_fecha_abono?.min} max={account?.limites_fecha_abono?.max} value={payment.date} onChange={event => { updatePayment('date', event.target.value); loadAccount(contractId, event.target.value); }} required /></Field.Root>
                <Field.Root><Field.Label>Monto sugerido</Field.Label><Input type="number" step="0.01" min="0.01" value={payment.amount} onChange={event => updatePayment('amount', event.target.value)} required /><Text className="table-subtitle">Total recomendado: {money(account?.total_sugerido_pago_unico ?? account?.total)}</Text></Field.Root>
                <Field.Root><Field.Label>Forma de pago</Field.Label><select className="native-select" value={payment.method} onChange={event => updatePayment('method', event.target.value)} required><option value="">Selecciona</option>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></Field.Root>
                <Field.Root><Field.Label>Banco</Field.Label><Input value={payment.bank} onChange={event => updatePayment('bank', event.target.value)} required={payment.method !== '' && payment.method !== 'Efectivo'} /></Field.Root>
                <Field.Root><Field.Label>Número de recibo</Field.Label><Input value={payment.receipt} onChange={event => updatePayment('receipt', event.target.value)} required /></Field.Root>
                <Field.Root><Field.Label>Fecha del recibo</Field.Label><Input type="date" min={account?.limites_fecha_abono?.min} max={account?.limites_fecha_abono?.max} value={payment.receiptDate} onChange={event => updatePayment('receiptDate', event.target.value)} required /></Field.Root>
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.Footer className="payment-dialog-footer"><Button type="button" variant="outline" onClick={() => setPaymentDialog('')}>Cancelar</Button><Button type="submit" colorPalette="blue" loading={busy}>Registrar pago</Button></Dialog.Footer>
          </form>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
      <Dialog.Root open={paymentDialog === 'batch'} onOpenChange={details => { if (!details.open) setPaymentDialog(''); }} size="lg">
        <Portal><Dialog.Backdrop /><Dialog.Positioner className="payment-dialog-positioner"><Dialog.Content className="customer-dialog payment-entry-dialog">
          <form onSubmit={registerBatch}>
            <Dialog.Header className="payment-dialog-header"><Box><Dialog.Title>Registrar pago múltiple</Dialog.Title><Text className="dialog-subtitle">Desde la cuota {quota?.numero_cuota}. Los cargos se calculan automáticamente.</Text></Box><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header>
            <Dialog.Body className="payment-dialog-body">
              {error && <Box role="alert" className="notice-error">{error}</Box>}
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                <Field.Root><Field.Label>Contrato</Field.Label><Input value={contractId} readOnly /></Field.Root>
                <Field.Root><Field.Label>Cuota desde</Field.Label><Input value={quota?.numero_cuota || ''} readOnly /></Field.Root>
                <Field.Root><Field.Label>Cuota hasta</Field.Label><Input type="number" min={quota?.numero_cuota} value={batch.until} onChange={event => updateBatch('until', event.target.value)} required /></Field.Root>
                <Field.Root><Field.Label>Fecha de abono</Field.Label><Input type="date" min={account?.limites_fecha_abono?.min} max={account?.limites_fecha_abono?.max} value={batch.date} onChange={event => updateBatch('date', event.target.value)} required /></Field.Root>
                <Field.Root><Field.Label>Fecha del recibo</Field.Label><Input type="date" value={batch.receiptDate} onChange={event => updateBatch('receiptDate', event.target.value)} required /></Field.Root>
                <Field.Root><Field.Label>Forma de pago</Field.Label><select className="native-select" value={batch.method} onChange={event => updateBatch('method', event.target.value)} required><option value="">Selecciona</option>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></Field.Root>
                <Field.Root><Field.Label>Banco</Field.Label><Input value={batch.bank} onChange={event => updateBatch('bank', event.target.value)} required={batch.method !== '' && batch.method !== 'Efectivo'} /></Field.Root>
                <Field.Root><Field.Label>Número de recibo base</Field.Label><Input value={batch.receipt} onChange={event => updateBatch('receipt', event.target.value)} required /></Field.Root>
              </SimpleGrid>
              <Text className="table-subtitle" mt="3">No se permiten saltos entre cuotas. El pago inicia desde la primera cuota pendiente.</Text>
            </Dialog.Body>
            <Dialog.Footer className="payment-dialog-footer"><Button type="button" variant="outline" onClick={() => setPaymentDialog('')}>Cancelar</Button><Button type="submit" colorPalette="blue" loading={busy}>Registrar pago múltiple</Button></Dialog.Footer>
          </form>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={dialogOpen} onOpenChange={details => setDialogOpen(details.open)} size="lg"><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog"><Dialog.Header><Box><Dialog.Title>Pago registrado</Dialog.Title><Text className="dialog-subtitle">Pago #{paymentId} · Recibo {receiptNumber}</Text></Box><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header><Dialog.Body>
        <form id="receipt-upload" onSubmit={uploadReceipt}>
          <Field.Root><Field.Label>Adjuntar comprobante de pago</Field.Label><Input type="file" accept="image/*" onChange={event => { const selected = event.target.files?.[0] || null; setFile(selected); setPreview(selected ? URL.createObjectURL(selected) : ''); }} /></Field.Root>
          {preview && <img className="receipt-preview" src={preview} alt="Vista previa del comprobante" />}
        </form>
      </Dialog.Body><Dialog.Footer>
        <Button variant="outline" onClick={() => window.open(`/recibo-print.html?id_pago=${paymentId}`, '_blank', 'noopener,noreferrer')}><Printer size={16} aria-hidden="true" /> Imprimir recibo</Button>
        <Button variant="outline" onClick={() => setDialogOpen(false)}>Ahora no</Button>
        <Button colorPalette="blue" onClick={() => document.getElementById('receipt-upload').requestSubmit()} loading={busy} disabled={!file}><FileUp size={16} aria-hidden="true" /> Subir comprobante</Button>
      </Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
    </Box>
  );
}
