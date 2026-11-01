import { useEffect, useMemo, useState } from 'react';
import { Badge, Box, Field, Heading, Input, SimpleGrid, Table, Text } from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api.js';

const money = value => `$${Number(value || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pageSize = 20;

export default function DeudoresPage() {
  const [deudores, setDeudores] = useState([]);
  const [lotificaciones, setLotificaciones] = useState([]);
  const [query, setQuery] = useState('');
  const [lotificacion, setLotificacion] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiRequest('/api/deudores'), apiRequest('/api/lotificaciones')])
      .then(([arrears, projects]) => {
        if (!Array.isArray(arrears) || !Array.isArray(projects)) throw new Error('El servidor devolvió datos inválidos.');
        setDeudores(arrears);
        setLotificaciones(projects);
      })
      .catch(requestError => setError(requestError.message || 'No se pudieron cargar los datos de mora.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => deudores.filter(item =>
    (item.cliente || '').toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')) &&
    (!lotificacion || String(item.id_lotificacion) === lotificacion)
  ), [deudores, lotificacion, query]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalDue = filtered.reduce((sum, item) => {
    const penal = item.tipo_financiamiento === 'penalizacion_fija';
    const cuotas = Number(penal ? item.total_cuotas_con_mora_gracia ?? 0 : item.total_cuotas_vencidas || 0);
    return sum + cuotas + Number(item.monto_mora || 0);
  }, 0);
  useEffect(() => { setPage(1); }, [query, lotificacion]);

  return (
    <Box>
      <Box className="page-heading"><Text className="eyebrow">SEGUIMIENTO FINANCIERO</Text><Heading size="2xl" className="page-title">Clientes en mora</Heading><Text className="page-description">Consulta cuotas vencidas, cargos y saldo pendiente por cliente.</Text></Box>
      {error && <Box role="alert" className="notice-error">{error}</Box>}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mb="5">
        <Box className="stat-card"><Text className="stat-label">Contratos con mora</Text><Heading size="xl">{filtered.length}</Heading></Box>
        <Box className="stat-card stat-card-danger"><Text className="stat-label">Total vencido y cargos</Text><Heading size="xl">{money(totalDue)}</Heading></Box>
      </SimpleGrid>
      <section className="customers-card">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mb="5">
          <Field.Root><Field.Label>Buscar cliente</Field.Label><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o apellido" /></Field.Root>
          <Field.Root><Field.Label>Lotificación</Field.Label><select className="native-select" value={lotificacion} onChange={event => setLotificacion(event.target.value)}><option value="">Todas las lotificaciones</option>{lotificaciones.map(item => <option key={item.id_lotificacion} value={item.id_lotificacion}>{item.nombre}</option>)}</select></Field.Root>
        </SimpleGrid>
        <div className="table-scroll">
          <Table.Root className="customers-table" size="sm">
            <Table.Header><Table.Row><Table.ColumnHeader>Cliente</Table.ColumnHeader><Table.ColumnHeader>Lotificación / Lote</Table.ColumnHeader><Table.ColumnHeader>Financiamiento</Table.ColumnHeader><Table.ColumnHeader>Cuotas vencidas</Table.ColumnHeader><Table.ColumnHeader>Cuota</Table.ColumnHeader><Table.ColumnHeader>Total vencido</Table.ColumnHeader><Table.ColumnHeader>Días</Table.ColumnHeader><Table.ColumnHeader>Mora</Table.ColumnHeader><Table.ColumnHeader>Total a pagar</Table.ColumnHeader></Table.Row></Table.Header>
            <Table.Body>
              {loading ? <Table.Row><Table.Cell colSpan={9} className="empty-row">Cargando deudores…</Table.Cell></Table.Row>
                : visible.length === 0 ? <Table.Row><Table.Cell colSpan={9} className="empty-row"><AlertTriangle size={25} aria-hidden="true" /><span>{deudores.length ? 'No hay resultados para estos filtros.' : 'No hay clientes en mora.'}</span></Table.Cell></Table.Row>
                  : visible.map(item => {
                    const penal = item.tipo_financiamiento === 'penalizacion_fija';
                    const cuotas = Number(penal ? item.total_cuotas_con_mora_gracia ?? 0 : item.total_cuotas_vencidas || 0);
                    const count = Number(penal ? item.cuotas_con_mora_gracia ?? item.cuotas_vencidas ?? 0 : item.cuotas_vencidas || 0);
                    const mora = Number(item.monto_mora || 0);
                    return <Table.Row key={item.id_contrato}>
                      <Table.Cell><strong>{item.cliente}</strong><Text className="table-subtitle">Contrato #{item.id_contrato}</Text></Table.Cell>
                      <Table.Cell>{item.lotificacion}<Text className="table-subtitle">{item.lote}</Text></Table.Cell>
                      <Table.Cell><Badge colorPalette={penal ? 'orange' : 'blue'}>{penal ? 'Penalización' : 'Interés'}</Badge></Table.Cell>
                      <Table.Cell>{count}</Table.Cell><Table.Cell>{money(item.valor_cuota)}</Table.Cell>
                      <Table.Cell>{money(cuotas)}</Table.Cell><Table.Cell><Badge colorPalette="red">{item.dias_mora} días</Badge></Table.Cell>
                      <Table.Cell className="money-danger">{money(mora)}</Table.Cell><Table.Cell><strong>{money(cuotas + mora)}</strong></Table.Cell>
                    </Table.Row>;
                  })}
            </Table.Body>
          </Table.Root>
        </div>
        {totalPages > 1 && <div className="pagination-bar"><Text className="table-subtitle">Página {page} de {totalPages}</Text><div className="pagination-actions"><button disabled={page === 1} onClick={() => setPage(current => current - 1)}>Anterior</button><button disabled={page === totalPages} onClick={() => setPage(current => current + 1)}>Siguiente</button></div></div>}
      </section>
    </Box>
  );
}
