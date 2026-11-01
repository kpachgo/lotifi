import { Box, Flex, Heading, Link as ChakraLink, Text } from '@chakra-ui/react';
import { Building2, ChartNoAxesCombined, CircleAlert, CreditCard, FileText, Map, Users } from 'lucide-react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
  return (
    <Box className="dashboard-page">
      <Text className="eyebrow">PANEL PRINCIPAL</Text>
      <Heading size="2xl" className="page-title">Sistema de lotificaciones</Heading>
      <Text className="page-description">Accede a las herramientas de administración de LOTIFI.</Text>
      <div className="dashboard-grid">
        {navigation.slice(1).map(item => {
          const Icon = item.icon;
          return (
            <ChakraLink key={item.href} as={RouterLink} to={item.href} className="dashboard-card">
              <span className="dashboard-card-icon"><Icon size={22} aria-hidden="true" /></span>
              <Heading size="md">{item.label}</Heading>
              <Text>Administrar {item.label.toLowerCase()}</Text>
            </ChakraLink>
          );
        })}
      </div>
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
