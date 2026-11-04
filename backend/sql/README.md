# SQL de referencia (Lotifi)

Archivos:
- `backend/sql/01_schema_lotifi.sql`: esquema base completo alineado al codigo actual.
- `backend/sql/02_reset_tablas.sql`: limpia datos para pruebas (mantiene estructura).
- `backend/sql/03_migracion_alter_motor_financiero.sql`: migra una BD existente con `ALTER TABLE` (sin borrar datos).
- `backend/sql/04_migracion_anular_pagos.sql`: agrega `pagos.id_movimiento` y la bitacora `pagos_anulados` (necesaria para "Anular ultimo pago").
- `backend/sql/05_migracion_pagos_prima.sql`: agrega el registro independiente de cobros de prima y sus comprobantes.
- `backend/sql/06_migracion_contactos_cliente.sql`: agrega contactos adicionales de referencia para clientes.

Uso rapido:
1. Crear estructura: ejecutar `01_schema_lotifi.sql`.
2. Vaciar datos: ejecutar `02_reset_tablas.sql`.
3. Migrar BD existente (sin perder datos): ejecutar `03_migracion_alter_motor_financiero.sql`.
4. Para actualizar una BD existente con el registro independiente de primas: ejecutar `05_migracion_pagos_prima.sql`.
5. Para agregar contactos de referencia a una BD existente: ejecutar `06_migracion_contactos_cliente.sql`.

Nota:
- Este esquema fue construido en base al codigo backend actual.
- Si tu BD productiva ya existe y tiene datos, aplica cambios con migraciones controladas antes de usar `TRUNCATE`.
