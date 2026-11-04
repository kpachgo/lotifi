# LOTIFI: cambios pendientes y contexto de trabajo

Este documento conserva el estado de las mejoras recientes y los pendientes funcionales para continuar el proyecto en otra sesión.

## Contexto financiero de contratos

Actualmente el sistema implementa dos tipos de financiamiento:

1. **Interés sobre saldo** (`interes_saldo`): calcula la cuota con interés financiero y aplica el interés correspondiente al saldo.
2. **Penalización fija** (`penalizacion_fija`): no cobra interés financiero, pero puede aplicar una penalización por atraso según los días de gracia.

Se requiere contemplar un tercer tipo de contrato: **cuota establecida sin cargos adicionales**. En este modelo el cliente paga únicamente la cuota definida para el contrato; no se agrega interés financiero ni penalización.

Este tercer tipo **no está implementado todavía**. El esquema actual limita `contratos.tipo_financiamiento` a `interes_saldo` y `penalizacion_fija`, y la interfaz y los controladores solo contemplan esas dos opciones. No basta con agregar una opción al formulario: hay que soportar el modelo en la base de datos, la creación del contrato, el cálculo y generación de cuotas, el procesamiento de pagos, los pagos parciales o excedentes, los cargos por atraso, los reportes y la impresión de recibos.

Antes de implementarlo, definir y documentar cómo se comportan en este tipo de contrato los pagos parciales, los pagos mayores que la cuota, la liquidación anticipada y los pagos atrasados. La regla indicada es que no se agreguen cargos y se cobre únicamente la cuota establecida.

## Cambios recientes implementados, pendientes de validación manual

- **Lotificaciones:** se agregaron acciones para editar lotificaciones, polígonos y lotes desde la interfaz React.
- **Búsqueda en Contratos:** busca automáticamente tras 300 ms, comienza con 2 caracteres, limita los resultados a 10 y anima su aparición.
- **Búsqueda en Pagos:** aplica debounce de 300 ms, mínimo de 2 caracteres, resultados de clientes limitados a 10 y animación. También conserva la búsqueda de cuenta por código de lote.
- **Recibos:** se agregó una acción para reimprimir los recibos de pagos existentes; la página de impresión consulta la API desde el mismo origen y permanece abierta tras imprimir para permitir reimpresiones.
- **Comprobantes:** se integró Sharp para convertir imágenes JPG, PNG y WebP a WebP optimizado y Cloudflare R2 privado para almacenarlas. Los enlaces de lectura son temporales y las credenciales se configuran en `backend/.env` usando como guía `backend/.env.example`. Los comprobantes locales históricos siguen teniendo una ruta de lectura compatible.
- **Carga de comprobantes en Pagos:** si se omite la foto al registrar el pago, se puede adjuntar después desde el último pago sin comprobante. Los errores de configuración, conexión o acceso a R2 se muestran dentro del modal de carga.
- **Dashboard de inicio:** permite consultar cobros por mes; presenta total, promedio diario, transacciones, gráfico diario, desglose por forma de pago y hasta 12 pagos recientes. Cartera e inventario se muestran como estado actual y las cuotas vencidas con su saldo se agrupan en una sola alerta.
- **Prima del contrato:** Pagos tendrá una sección separada para registrar una vez el cobro completo de la prima, sus fechas, forma de pago, recibo y comprobante R2; también permite consultar e imprimir su recibo. Para instalaciones existentes, ejecutar `backend/sql/05_migracion_pagos_prima.sql` antes de usar la función. Los pagos de prima nuevos se incluyen en el dashboard mensual sin modificar el saldo de las cuotas.

Estos cambios compilaron durante su implementación, pero se deben probar manualmente con el servidor y datos reales, especialmente la reimpresión de recibos desde el historial de cuotas.
El bucket de R2 es privado, pero la aplicación aún no tiene autenticación de usuarios: cualquier persona que pueda acceder a la API podría solicitar enlaces temporales de comprobantes. No exponer la aplicación públicamente hasta implementar y exigir autorización en esas rutas.

## Pendientes de trabajo

1. Diseñar e implementar de extremo a extremo el tipo de contrato de cuota establecida sin cargos adicionales, después de acordar sus casos de pagos parciales, excedentes, atraso y liquidación.
2. Validar manualmente la edición de lotificaciones, polígonos y lotes, incluyendo el comportamiento protegido de lotes con contrato.
3. Configurar y probar las credenciales de Cloudflare R2 en `backend/.env`, verificar carga, enlace temporal, borrado de objetos al anular pagos y uso del bucket privado.
4. Validar las búsquedas interactivas de Contratos y Pagos y confirmar que solo se presentan hasta 10 resultados y que no se aplican cargos de búsqueda mientras se escribe.
5. Probar la impresión inicial y la reimpresión de recibos previamente registrados en el navegador y servidor usados en producción. Verificar los datos y la alineación con el formulario físico.
6. Validar pagos individuales y masivos, comprobantes, fechas permitidas, pagos retroactivos, pagos parciales, excedentes y anulación del último pago.
7. Agregar pruebas automatizadas para los flujos principales; el frontend aún no tiene un runner de pruebas configurado.
8. Revisar los avisos moderados de `npm audit` del frontend antes de actualizar dependencias; no aplicar actualizaciones mayores automáticamente.

## Archivos de referencia

- [Contexto y guía del frontend](./frontend.md)
- [Formulario de contratos](../frontend/src/pages/ContratosPage.jsx)
- [Lógica de pagos](../frontend/src/pages/PagosPage.jsx)
- [Esquema de base de datos](../backend/sql/01_schema_lotifi.sql)
- [Controlador de contratos](../backend/controllers/contratos.controller.js)
