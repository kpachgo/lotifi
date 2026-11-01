import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, CloseButton, Dialog, Field, Flex, Heading, Input,
  Portal, Select, SimpleGrid, Table, Text
} from '@chakra-ui/react';
import { FileDown, Search } from 'lucide-react';
import { apiRequest } from '../api.js';

const money = value => `$${Number(value || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pageSize = 20;

export default function ReportesPage() {
  const [filters, setFilters] = useState({ cliente: '', lote: '', desde: '', hasta: '', estado: '' });
  const [contracts, setContracts] = useState([]);
  const [summary, setSummary] = useState({ total_pagado: 0, total_pendiente: 0, contratos: 0, cuotas_mora: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function searchReport(event) {
    event?.preventDefault();
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const data = await apiRequest(`/api/reportes/contratos?${params}`);
      if (!Array.isArray(data.contratos) || !data.resumen) throw new Error('El servidor devolvió un reporte inválido.');
      setContracts(data.contratos); setSummary(data.resumen); setPage(1);
    } catch (requestError) { setError(requestError.message || 'No se pudo generar el reporte.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { searchReport(); }, []);
  const pages = Math.ceil(contracts.length / pageSize);
  const visible = useMemo(() => contracts.slice((page - 1) * pageSize, page * pageSize), [contracts, page]);

  async function openDetails(contract) {
    setSelectedContract(contract); setDetailLoading(true); setDetail(null); setError('');
    try {
      const [contractInfo, cuotas, pagos, resumen] = await Promise.all([
        apiRequest(`/api/contratos/detalle/${contract.id_contrato}`),
        apiRequest(`/api/cuotas/contrato/${contract.id_contrato}`),
        apiRequest(`/api/pagos/contrato/${contract.id_contrato}`),
        apiRequest(`/api/reportes/resumen/${contract.id_contrato}`)
      ]);
      setDetail({ contractInfo, cuotas, pagos, resumen });
    } catch (requestError) { setError(requestError.message || 'No se pudo cargar el detalle del contrato.'); }
    finally { setDetailLoading(false); }
  }

  function printAccount() {
    if (!detail) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) { setError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para continuar.'); return; }
    const info = detail.contractInfo;
    const cuotas = detail.cuotas.map(item => `<tr><td>${item.numero_cuota}</td><td>${new Date(item.fecha_vencimiento).toLocaleDateString('es-SV')}</td><td>${money(item.monto_cuota)}</td><td>${item.estado}</td></tr>`).join('');
    const pagos = detail.pagos.map(item => `<tr><td>${new Date(item.fecha_abono).toLocaleDateString('es-SV')}</td><td>${money(item.monto_total)}</td><td>${item.forma_pago || '—'}</td><td>${item.numero_recibo || '—'}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17243b}h1{color:#173d71}table{width:100%;border-collapse:collapse;margin:16px 0 28px}th,td{border:1px solid #dbe2ed;padding:8px;text-align:left}th{background:#edf3fb}.summary{display:flex;gap:24px;flex-wrap:wrap}</style></head><body><h1>LOTIFI - Estado de cuenta</h1><p><strong>Cliente:</strong> ${info.cliente} (${info.dui || '—'})</p><p><strong>Lote:</strong> ${info.lotificacion} / ${info.poligono} / ${info.numero_lote}</p><p><strong>Estado:</strong> ${info.estado} · ${info.plazo_meses} meses</p><div class="summary"><span>Saldo pendiente: ${money(detail.resumen.saldo_pendiente)}</span><span>Total abonado: ${money(detail.resumen.total_abonado)}</span></div><h2>Cuotas</h2><table><thead><tr><th>Cuota</th><th>Vencimiento</th><th>Monto</th><th>Estado</th></tr></thead><tbody>${cuotas}</tbody></table><h2>Pagos</h2><table><thead><tr><th>Fecha</th><th>Monto</th><th>Forma</th><th>Recibo</th></tr></thead><tbody>${pagos}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  return (
    <Box>
      <Box className="page-heading"><Text className="eyebrow">ANÁLISIS</Text><Heading size="2xl" className="page-title">Reportes</Heading><Text className="page-description">Filtra contratos, revisa el resumen financiero y consulta el detalle por cliente.</Text></Box>
      {error && <Box role="alert" className="notice-error">{error}</Box>}
      <section className="customers-card module-section">
        <Heading size="md" mb="4">Filtros del reporte</Heading>
        <form onSubmit={searchReport}>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} gap="4" alignItems="end">
            <Field.Root><Field.Label>Cliente</Field.Label><Input value={filters.cliente} placeholder="Nombre o DUI" onChange={event => setFilters(current => ({ ...current, cliente: event.target.value }))} /></Field.Root>
            <Field.Root><Field.Label>Código de lote</Field.Label><Input value={filters.lote} placeholder="Ej: 001A1" onChange={event => setFilters(current => ({ ...current, lote: event.target.value }))} /></Field.Root>
            <Field.Root><Field.Label>Desde</Field.Label><Input type="date" value={filters.desde} onChange={event => setFilters(current => ({ ...current, desde: event.target.value }))} /></Field.Root>
            <Field.Root><Field.Label>Hasta</Field.Label><Input type="date" value={filters.hasta} onChange={event => setFilters(current => ({ ...current, hasta: event.target.value }))} /></Field.Root>
            <Field.Root><Field.Label>Estado</Field.Label><select className="native-select" value={filters.estado} onChange={event => setFilters(current => ({ ...current, estado: event.target.value }))}><option value="">Todos</option><option value="activo">Activo</option><option value="finalizado">Finalizado</option><option value="mora">En mora</option></select></Field.Root>
          </SimpleGrid>
          <Flex justify="flex-end" mt="4"><Button type="submit" colorPalette="blue" loading={loading}><Search size={16} aria-hidden="true" /> Buscar</Button></Flex>
        </form>
      </section>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4" mb="5">
        <div className="stat-card"><Text className="stat-label">Total pagado</Text><Heading size="lg">{money(summary.total_pagado)}</Heading></div>
        <div className="stat-card"><Text className="stat-label">Total pendiente</Text><Heading size="lg">{money(summary.total_pendiente)}</Heading></div>
        <div className="stat-card"><Text className="stat-label">Contratos</Text><Heading size="lg">{summary.contratos || 0}</Heading></div>
        <div className="stat-card stat-card-danger"><Text className="stat-label">Cuotas en mora</Text><Heading size="lg">{summary.cuotas_mora || 0}</Heading></div>
      </SimpleGrid>
      <section className="customers-card">
        <Flex justify="space-between" align="center" mb="4"><Box><Heading size="md">Resultados</Heading><Text className="table-subtitle">{contracts.length} contratos</Text></Box></Flex>
        <div className="table-scroll"><Table.Root className="customers-table" size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Cliente</Table.ColumnHeader><Table.ColumnHeader>Lote</Table.ColumnHeader><Table.ColumnHeader>Contrato</Table.ColumnHeader><Table.ColumnHeader>Fecha</Table.ColumnHeader><Table.ColumnHeader>Monto</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Acción</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{loading ? <Table.Row><Table.Cell colSpan={7} className="empty-row">Generando reporte…</Table.Cell></Table.Row> : visible.length === 0 ? <Table.Row><Table.Cell colSpan={7} className="empty-row">No hay resultados.</Table.Cell></Table.Row> : visible.map(contract => <Table.Row key={contract.id_contrato}><Table.Cell><strong>{contract.cliente}</strong><Text className="table-subtitle">{contract.dui || ''}</Text></Table.Cell><Table.Cell>{contract.lote}</Table.Cell><Table.Cell>#{contract.id_contrato}</Table.Cell><Table.Cell>{new Date(contract.fecha_inicio).toLocaleDateString('es-SV')}</Table.Cell><Table.Cell>{money(contract.precio_total)}</Table.Cell><Table.Cell><Badge colorPalette={contract.estado === 'activo' ? 'green' : contract.estado === 'finalizado' ? 'gray' : 'orange'}>{contract.estado}</Badge></Table.Cell><Table.Cell textAlign="right"><Button size="sm" variant="outline" onClick={() => openDetails(contract)}>Ver detalle</Button></Table.Cell></Table.Row>)}</Table.Body></Table.Root></div>
        {pages > 1 && <div className="pagination-bar"><Text className="table-subtitle">Página {page} de {pages}</Text><div className="pagination-actions"><button disabled={page === 1} onClick={() => setPage(current => current - 1)}>Anterior</button><button disabled={page === pages} onClick={() => setPage(current => current + 1)}>Siguiente</button></div></div>}
      </section>
      <Dialog.Root open={Boolean(selectedContract)} onOpenChange={details => { if (!details.open) setSelectedContract(null); }} size="cover">
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="customer-dialog"><Dialog.Header><Box><Dialog.Title>Detalle del contrato #{selectedContract?.id_contrato}</Dialog.Title><Text className="dialog-subtitle">{detail?.contractInfo?.cliente || 'Información financiera'}</Text></Box><Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger></Dialog.Header><Dialog.Body>
          {detailLoading ? <div className="empty-row">Cargando detalle del contrato…</div> : detail && <>
            <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb="5">
              <div className="stat-card"><Text className="stat-label">Precio total</Text><strong>{money(detail.resumen.precio_total)}</strong></div>
              <div className="stat-card"><Text className="stat-label">Prima</Text><strong>{money(detail.resumen.prima)}</strong></div>
              <div className="stat-card"><Text className="stat-label">Total abonado</Text><strong>{money(detail.resumen.total_abonado)}</strong></div>
              <div className="stat-card stat-card-danger"><Text className="stat-label">Saldo pendiente</Text><strong>{money(detail.resumen.saldo_pendiente)}</strong></div>
            </SimpleGrid>
            <Flex justify="space-between" align="center" mb="2"><Heading size="sm">Estado de cuenta</Heading><Button size="sm" variant="outline" onClick={printAccount}><FileDown size={16} aria-hidden="true" /> Imprimir</Button></Flex>
            <div className="table-scroll"><Table.Root className="customers-table" size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Cuota</Table.ColumnHeader><Table.ColumnHeader>Vencimiento</Table.ColumnHeader><Table.ColumnHeader>Monto</Table.ColumnHeader><Table.ColumnHeader>Abonado</Table.ColumnHeader><Table.ColumnHeader>Mora</Table.ColumnHeader><Table.ColumnHeader>Estado</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{detail.cuotas.map(cuota => <Table.Row key={cuota.id_cuota}><Table.Cell>{cuota.numero_cuota}</Table.Cell><Table.Cell>{new Date(cuota.fecha_vencimiento).toLocaleDateString('es-SV')}</Table.Cell><Table.Cell>{money(cuota.monto_cuota)}</Table.Cell><Table.Cell>{money(Number(cuota.capital_pagado || 0) + Number(cuota.interes_pagado || 0))}</Table.Cell><Table.Cell>{money(cuota.mora_pagada)}</Table.Cell><Table.Cell><Badge colorPalette={cuota.estado === 'pagada' ? 'green' : 'orange'}>{cuota.estado}</Badge></Table.Cell></Table.Row>)}</Table.Body></Table.Root></div>
            <Heading size="sm" mt="5" mb="2">Pagos registrados</Heading>
            <div className="table-scroll"><Table.Root className="customers-table" size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Fecha</Table.ColumnHeader><Table.ColumnHeader>Monto</Table.ColumnHeader><Table.ColumnHeader>Forma</Table.ColumnHeader><Table.ColumnHeader>Banco</Table.ColumnHeader><Table.ColumnHeader>Recibo</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{detail.pagos.length ? detail.pagos.map(pago => <Table.Row key={pago.id_pago}><Table.Cell>{new Date(pago.fecha_abono).toLocaleDateString('es-SV')}</Table.Cell><Table.Cell>{money(pago.monto_total)}</Table.Cell><Table.Cell>{pago.forma_pago || '—'}</Table.Cell><Table.Cell>{pago.banco || '—'}</Table.Cell><Table.Cell>{pago.numero_recibo || '—'}</Table.Cell></Table.Row>) : <Table.Row><Table.Cell colSpan={5} className="empty-row">Sin pagos registrados.</Table.Cell></Table.Row>}</Table.Body></Table.Root></div>
          </>}
        </Dialog.Body></Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Box>
  );
}
