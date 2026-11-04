-- LOTIFI - Migracion para anular el ultimo pago de un contrato (sin perder datos)
-- Fecha: 2026-10-29
-- 1) pagos.id_movimiento agrupa las filas que genera un mismo registro de pago
--    (una fila por cuota cubierta + filas -EX- de capital extra).
-- 2) pagos_anulados guarda la bitacora de lo anulado.

USE lotifi;

SET @existe := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pagos'
    AND COLUMN_NAME = 'id_movimiento'
);
SET @sql := IF(
  @existe = 0,
  'ALTER TABLE pagos ADD COLUMN id_movimiento INT NULL AFTER id_pago, ADD KEY idx_pagos_movimiento (id_movimiento)',
  'SELECT 1'
);
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS pagos_anulados (
  id_anulacion INT NOT NULL AUTO_INCREMENT,
  id_contrato INT NOT NULL,
  id_movimiento INT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  abono_capital DECIMAL(10,2) NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  detalle JSON NOT NULL,
  fecha_anulacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_anulacion),
  KEY idx_pagos_anulados_contrato (id_contrato),
  CONSTRAINT fk_pagos_anulados_contrato
    FOREIGN KEY (id_contrato) REFERENCES contratos (id_contrato)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
