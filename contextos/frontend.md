# Contexto del frontend de LOTIFI

## Objetivo

Migrar gradualmente la interfaz actual, hecha con HTML, Bootstrap y JavaScript directo al DOM, a **React + Chakra UI**. La meta es que todas las vistas compartan navegación, estilos y componentes sin perder los flujos existentes ni la conexión con el backend.

La migración está en curso: **no todo el frontend usa React todavía**. Las páginas antiguas se mantienen mientras se migra cada vista y se comprueba su comportamiento.

## Tecnologías

- **React 18** y **React DOM** para construir la interfaz.
- **Chakra UI 3** para componentes accesibles de interfaz y estilos base.
- **Emotion** como motor de estilos de Chakra.
- **React Router 6** para navegación entre vistas React.
- **Lucide React** para iconos.
- **Vite 6** y `@vitejs/plugin-react` para desarrollo y compilación.
- **CSS compartido** en `frontend/src/styles.css` para el diseño del layout y componentes personalizados.
- **Express** continúa siendo el servidor y expone la API y los archivos estáticos.

## Estructura nueva

- `frontend/src/main.jsx`: punto de entrada, Chakra Provider y router.
- `frontend/src/App.jsx`: layout, navegación y rutas.
- `frontend/src/api.js`: helper común para solicitudes HTTP.
- `frontend/src/pages/ClientesPage.jsx`: pantalla React de clientes.
- `frontend/src/pages/LotificacionesPage.jsx`: lotificaciones, polígonos y lotes.
- `frontend/src/pages/ContratosPage.jsx`: búsqueda de clientes, selección de lote y contratos.
- `frontend/src/pages/PagosPage.jsx`: pagos individuales y masivos, comprobantes e impresión de recibos.
- `frontend/src/pages/DeudoresPage.jsx`: consulta y filtros de deudores.
- `frontend/src/pages/ReportesPage.jsx`: reportes, detalle e impresión.
- `frontend/src/styles.css`: estilos compartidos y responsive.
- `frontend/vite.config.js`: configuración Vite, proxy local para `/api` y `/uploads`, y salida de producción en `backend/public`.
- `frontend/package.json`: dependencias y comandos del frontend.

## Ya implementado

- Aplicación React con Chakra UI y navegación adaptable a móvil.
- Panel principal inicial con accesos a las secciones.
- Navegación React Router para Inicio, Clientes, Lotificaciones, Contratos, Pagos, Deudores y Reportes.
- Vite redirige en desarrollo las rutas React al punto de entrada, evitando conflictos con las páginas HTML legacy que comparten nombres de rutas.
- Pantalla de **Clientes** con:
  - listado y búsqueda por nombre, apellido, DUI o teléfono;
  - paginación en grupos de 20;
  - formulario en modal para crear y editar;
  - integración con `GET /api/cliente`, `POST /api/cliente` y `PUT /api/cliente/:id`;
  - estados de carga, errores, confirmación y lista vacía.
- Vistas React iniciales para Lotificaciones, Contratos, Pagos, Deudores y Reportes, reutilizando la API existente.
- Express sirve el build React desde `backend/public` y permite acceder a sus rutas.
- `cliente.html` redirige a la nueva ruta `/clientes`.
- `iniciar-lotifi.bat` compila el frontend antes de iniciar el servidor.
- La salida de producción separa los paquetes de React, Chakra e iconos en distintos chunks.

## Pendiente

1. Validar manualmente cada módulo React con datos reales: formularios, filtros, errores, estados vacíos y navegación móvil.
2. Revisar específicamente los cálculos/fechas permitidos de pagos, los pagos masivos, carga de comprobantes, impresión y ventanas emergentes.
4. Revisar el recibo imprimible: se mantiene como documento HTML independiente mientras se valida su flujo desde Pagos.
5. Las páginas HTML/JS antiguas siguen en el repositorio y Express aún las sirve; retirarlas solo después de comprobar equivalencia y confirmar que no haya enlaces externos.
6. Agregar pruebas automatizadas para componentes y flujos principales. El frontend todavía no tiene un runner de pruebas configurado.
7. Revisar los avisos de `npm audit` reportados al instalar dependencias antes de actualizar versiones; no aplicar actualizaciones mayores automáticamente.

## Ejecutar

Primera instalación:

```powershell
cd frontend
npm install
```

Desarrollo con Vite (el backend debe estar disponible en `http://localhost:3002` para que funcione el proxy de API):

```powershell
cd frontend
npm run dev
```

Compilar el frontend:

```powershell
cd frontend
npm run build
```

Uso normal: ejecutar `iniciar-lotifi.bat`. El archivo compila el frontend y luego inicia Express en el puerto `3002`. También se puede iniciar con `cd backend` y `npm start`; el script `prestart` compila primero el frontend.

## Guía para continuar

- Migrar una vista por vez y validar el flujo funcional antes de pasar a la siguiente.
- Reutilizar `App.jsx`, `styles.css`, Chakra UI y `apiRequest`; no volver a crear una navegación o sistema de estilos específico para cada HTML.
- Conservar rutas y contratos de API del backend siempre que sea posible.
- No borrar una página o script antiguo hasta que su reemplazo React esté probado, incluyendo sus casos de impresión o carga de archivos.
- Después de cada cambio, ejecutar `npm run build` desde `frontend` y probar la ruta desde el servidor Express.