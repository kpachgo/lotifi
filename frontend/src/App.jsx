import { useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Flex, Heading, Link as ChakraLink, SimpleGrid, Table, Text } from '@chakra-ui/react';
import {
  ArrowUpRight, Building2, ChartNoAxesCombined, CircleAlert,
  CreditCard, FileText, LandPlot, Map, Printer, RefreshCw, ReceiptText, Users, Wallet
} from 'lucide-react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { apiRequest } from './api.js';
import ClientesPage from './pages/ClientesPage.jsx';
import LotificacionesPage from './pages/LotificacionesPage.jsx';
import ContratosPage from './pages/ContratosPage.jsx';
import DeudoresPage from './pages/DeudoresPage.jsx';
import ReportesPage from './pages/ReportesPage.jsx';
import PagosPage from './pages/PagosPage.jsx';

const navigation = [
  { label: 'Inicio', href: '/', icon: Building2 },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Lotificaciones', href: '/lotificaciones', icon: Map },
  { label: 'Contratos', href: '/contratos', icon: FileText },
  { label: 'Pagos', href: '/pagos', icon: CreditCard },
  { label: 'Deudores', href: '/deudores', icon: CircleAlert },
  { label: 'Reportes', href: '/reportes', icon: ChartNoAxesCombined }
];

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

function NavigationLink({ item, active }) {
  const Icon = item.icon;
  return (
    <ChakraLink
      as={RouterLink}
      to={item.href}
      className={`app-nav-link${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon aria-hidden="true" size={18} />
      <span>{item.label}</span>
    </ChakraLink>
  );
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dashboardRequestId = useRef(0);

  async function loadDashboard(month = selectedMonth) {
    const requestId = ++dashboardRequestId.current;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/reportes/dashboard?mes=${encodeURIComponent(month)}`);
      if (requestId === dashboardRequestId.current) setDashboard(data);
    } catch (requestError) {
      if (requestId === dashboardRequestId.current) {
        setError(requestError.message || 'No se pudo cargar el panel principal.');
      }
    } finally {
      if (requestId === dashboardRequestId.current) setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(selectedMonth); }, [selectedMonth]);

  const money = value => `$${Number(value || 0).toLocaleString('es-SV', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  const dateLabel = value => value
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('es-SV', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    : '—';
  const selectedMonthLabel = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('es-SV', {
    month: 'long',
    year: 'numeric'
  });
  const operaciones = dashboard?.operaciones || {};
  const maxTrend = Math.max(1, ...(dashboard?.tendencia || []).map(day => day.total));

  return (
    <Box className="dashboard-page">
      <Flex className="dashboard-heading" justify="space-between" align="center" gap="4" wrap="wrap">
        <Box>
          <Text className="eyebrow">PANEL PRINCIPAL</Text>
          <Heading size="2xl" className="page-title">Resumen de operaciones</Heading>
          <Text className="page-description">Consulta cobros por mes y revisa el estado actual de la cartera.</Text>
        </Box>
        <Flex align="end" gap="3" wrap="wrap">
          <label className="dashboard-month-control">
            <span>Consultar mes</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={event => {
                if (event.target.value) setSelectedMonth(event.target.value);
              }}
              aria-label="Selecciona el mes del dashboard"
            />
          </label>
          <Button variant="outline" colorPalette="blue" onClick={() => loadDashboard()} loading={loading}>
            <RefreshCw size={16} aria-hidden="true" /> Actualizar
          </Button>
        </Flex>
      </Flex>

      {error && <Box role="alert" className="notice-error">{error}</Box>}
      {loading && dashboard?.mes !== selectedMonth && <Box role="status" className="customers-card">Cargando resumen del negocio…</Box>}

      {dashboard?.mes === selectedMonth && <>
        <Text className="dashboard-section-label">COBROS · {selectedMonthLabel}</Text>
        <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} gap="4" mb="5">
          {[
            { label: 'Total cobrado', value: money(dashboard.resumen_mes.total), icon: Wallet, detail: `${dashboard.resumen_mes.transacciones} transacciones`, tone: 'blue' },
            { label: 'Promedio cobrado por día', value: money(dashboard.resumen_mes.promedio_diario), icon: ChartNoAxesCombined, detail: 'Promedio del mes completo', tone: 'green' },
            { label: 'Transacciones registradas', value: dashboard.resumen_mes.transacciones, icon: ReceiptText, detail: 'Pagos individuales y múltiples', tone: 'purple' }
          ].map(item => {
            const Icon = item.icon;
            return <Box key={item.label} className={`dashboard-stat dashboard-stat-${item.tone}`}>
              <Flex justify="space-between" align="flex-start">
                <Box><Text className="dashboard-stat-label">{item.label}</Text><Heading size="xl">{item.value}</Heading><Text className="dashboard-stat-detail">{item.detail}</Text></Box>
                <span className="dashboard-stat-icon"><Icon size={20} aria-hidden="true" /></span>
              </Flex>
            </Box>;
          })}
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, xl: 5 }} gap="4" mb="5">
          <section className="customers-card dashboard-chart-card">
            <Flex justify="space-between" align="flex-start" mb="4" gap="3">
              <Box><Heading size="md">Cobros diarios</Heading><Text className="table-subtitle">Por fecha de abono durante {selectedMonthLabel}</Text></Box>
              <Badge colorPalette="blue">{money(dashboard.resumen_mes.total)}</Badge>
            </Flex>
            <div className="dashboard-chart-scroll">
              <div className="dashboard-chart" role="img" aria-label={`Gráfico de cobros diarios de ${selectedMonthLabel}`}>
                {(dashboard.tendencia || []).map(day => (
                  <div
                    className="dashboard-chart-column"
                    key={day.dia}
                    title={`Día ${day.dia}: ${money(day.total)}`}
                    aria-label={`Día ${day.dia}: ${money(day.total)}`}
                  >
                    <div className="dashboard-chart-track">
                      <span style={{ height: `${day.total ? Math.max(6, (day.total / maxTrend) * 100) : 0}%` }} />
                    </div>
                    <Text className="dashboard-chart-label">{day.dia}</Text>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="customers-card dashboard-method-card">
            <Heading size="md">Formas de pago</Heading>
            <Text className="table-subtitle">Desglose de {selectedMonthLabel}</Text>
            {dashboard.metodos.length
              ? dashboard.metodos.map(method => <Flex className="dashboard-method-row" key={method.forma_pago} justify="space-between" gap="3">
                <Box><Text fontWeight="600">{method.forma_pago}</Text><Text className="table-subtitle">{method.transacciones} transacciones</Text></Box>
                <Text fontWeight="700">{money(method.total)}</Text>
              </Flex>)
              : <Text className="dashboard-empty">No hay pagos en el mes seleccionado.</Text>}
          </section>
        </SimpleGrid>

        <Text className="dashboard-section-label">CARTERA E INVENTARIO · ESTADO ACTUAL</Text>
        <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3" mb="5">
          {[
            { label: 'Contratos activos', value: operaciones.contratos_activos, icon: FileText, href: '/contratos' },
            { label: 'Saldo de contratos activos', value: money(operaciones.saldo_activo), icon: Wallet, href: '/reportes' },
            { label: 'Clientes registrados', value: operaciones.clientes, icon: Users, href: '/clientes' }
          ].map(item => {
            const Icon = item.icon;
            return <ChakraLink key={item.label} as={RouterLink} to={item.href} className={`dashboard-compact-stat${item.alert ? ' dashboard-compact-alert' : ''}`}>
              <Flex justify="space-between" align="center" gap="2"><Text className="dashboard-compact-label">{item.label}</Text><Icon size={17} aria-hidden="true" /></Flex>
              <Heading size="md">{item.value}</Heading>
              <span className="dashboard-card-link">Ver detalle <ArrowUpRight size={13} aria-hidden="true" /></span>
            </ChakraLink>;
          })}
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4" mb="5">
          <section className="customers-card dashboard-lots-card">
            <Flex align="center" gap="3" mb="3"><LandPlot size={19} aria-hidden="true" /><Heading size="md">Inventario de lotes</Heading></Flex>
            <div className="dashboard-inventory">
              <div><Text className="dashboard-inventory-number">{operaciones.lotes_disponibles}</Text><Text className="table-subtitle">Disponibles</Text></div>
              <div><Text className="dashboard-inventory-number">{operaciones.lotes_en_promesa}</Text><Text className="table-subtitle">En promesa</Text></div>
              <div><Text className="dashboard-inventory-number">{operaciones.lotes_vendidos}</Text><Text className="table-subtitle">Vendidos</Text></div>
            </div>
            <ChakraLink as={RouterLink} to="/lotificaciones" className="dashboard-inline-link">Administrar lotificaciones <ArrowUpRight size={14} /></ChakraLink>
          </section>
          <section className={`customers-card dashboard-alert-card${operaciones.cuotas_vencidas ? ' has-alerts' : ''}`}>
            <Flex align="center" gap="3" mb="3"><CircleAlert size={19} aria-hidden="true" /><Heading size="md">Atención</Heading></Flex>
            <Text><strong>{operaciones.cuotas_vencidas}</strong> cuotas vencidas · <strong>{money(operaciones.saldo_vencido)}</strong></Text>
            <Text className="table-subtitle"><strong>{operaciones.pagos_sin_comprobante}</strong> pagos sin foto de comprobante</Text>
            <ChakraLink as={RouterLink} to="/deudores" className="dashboard-inline-link">Revisar pendientes <ArrowUpRight size={14} /></ChakraLink>
          </section>
        </SimpleGrid>

        <section className="customers-card dashboard-recent-card">
          <Flex justify="space-between" align="center" gap="3" wrap="wrap" mb="4">
            <Box><Heading size="md">Transacciones de {selectedMonthLabel}</Heading><Text className="table-subtitle">Hasta 12 pagos recientes del mes seleccionado, ordenados por fecha de abono.</Text></Box>
            <ChakraLink as={RouterLink} to="/pagos" className="dashboard-inline-link">Ir a pagos <ArrowUpRight size={14} /></ChakraLink>
          </Flex>
          <div className="table-scroll">
            <Table.Root className="customers-table" size="sm">
              <Table.Header><Table.Row><Table.ColumnHeader>Fecha</Table.ColumnHeader><Table.ColumnHeader>Cliente / lote</Table.ColumnHeader><Table.ColumnHeader>Forma de pago</Table.ColumnHeader><Table.ColumnHeader>Recibo</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Monto</Table.ColumnHeader><Table.ColumnHeader textAlign="right">Imprimir</Table.ColumnHeader></Table.Row></Table.Header>
              <Table.Body>
                {dashboard.pagos_recientes.length
                  ? dashboard.pagos_recientes.map(payment => <Table.Row key={`${payment.tipo_transaccion}-${payment.id_pago}`}>
                    <Table.Cell>{dateLabel(payment.fecha_abono)}</Table.Cell>
                    <Table.Cell><strong>{payment.cliente}</strong><Text className="table-subtitle">{payment.lotificacion} / {payment.poligono} / Lote {payment.numero_lote}{payment.tipo_transaccion === 'Cuota' ? ` · Cuota ${payment.numero_cuota}` : ' · Prima'}</Text></Table.Cell>
                    <Table.Cell>{payment.forma_pago}</Table.Cell>
                    <Table.Cell>{payment.numero_recibo || `#${payment.id_pago}`}{payment.tipo_transaccion === 'Prima' && <Badge ml="2" colorPalette="blue">Prima</Badge>}{!(payment.tipo_transaccion === 'Prima' ? payment.id_documento_prima : payment.id_documento) && <Badge ml="2" colorPalette="orange">Sin foto</Badge>}</Table.Cell>
                    <Table.Cell textAlign="right"><strong>{money(payment.monto_total)}</strong></Table.Cell>
                    <Table.Cell textAlign="right"><ChakraLink as="a" href={`/recibo-print.html?${payment.tipo_transaccion === 'Prima' ? 'id_pago_prima' : 'id_pago'}=${payment.tipo_transaccion === 'Prima' ? payment.id_pago_prima : payment.id_pago}`} target="_blank" rel="noopener noreferrer" className="dashboard-inline-link" aria-label={`Imprimir recibo ${payment.numero_recibo || payment.id_pago}`}><Printer size={15} /> Recibo</ChakraLink></Table.Cell>
                  </Table.Row>)
                  : <Table.Row><Table.Cell colSpan={6} className="empty-row">Aún no hay pagos registrados.</Table.Cell></Table.Row>}
              </Table.Body>
            </Table.Root>
          </div>
        </section>
      </>}
    </Box>
  );
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <Flex className="app-shell">
      <aside className="app-sidebar">
        <ChakraLink as={RouterLink} to="/" className="brand">
          <span className="brand-icon"><Building2 size={21} aria-hidden="true" /></span>
          <span>LOTIFI</span>
        </ChakraLink>
        <Text className="nav-caption">MENÚ PRINCIPAL</Text>
        <nav className="app-navigation" aria-label="Navegación principal">
          {navigation.map(item => (
            <NavigationLink key={item.href} item={item} active={item.href === pathname} />
          ))}
        </nav>
        <div className="sidebar-footer">Sistema de administración</div>
      </aside>
      <main className="app-main">
        <header className="mobile-header">
          <ChakraLink as={RouterLink} to="/" className="brand">
            <span className="brand-icon"><Building2 size={20} aria-hidden="true" /></span>
            <span>LOTIFI</span>
          </ChakraLink>
          <nav className="mobile-navigation" aria-label="Navegación móvil">
            {navigation.map(item => <NavigationLink key={item.href} item={item} active={item.href === pathname} />)}
          </nav>
        </header>
        <div className="page-container">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/lotificaciones" element={<LotificacionesPage />} />
            <Route path="/contratos" element={<ContratosPage />} />
            <Route path="/pagos" element={<PagosPage />} />
            <Route path="/deudores" element={<DeudoresPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </Flex>
  );
}
