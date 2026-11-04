-- Registra por separado el cobro de la prima y su comprobante.
-- Ejecutar dentro de la base de datos `lotifi`.

USE lotifi;

CREATE TABLE IF NOT EXISTS pagos_prima (
  id_pago_prima INT NOT NULL AUTO_INCREMENT,
  id_contrato INT NOT NULL,
  fecha_abono DATE NOT NULL,
  fecha_recibo DATE NOT NULL,
  forma_pago ENUM('Efectivo','Remesa','Transferencia','Cheque') NOT NULL,
  banco VARCHAR(100) DEFAULT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  numero_recibo VARCHAR(30) NOT NULL,
  PRIMARY KEY (id_pago_prima),
  UNIQUE KEY uq_pagos_prima_contrato (id_contrato),
  KEY idx_pagos_prima_fecha_abono (fecha_abono),
  CONSTRAINT fk_pagos_prima_contrato
    FOREIGN KEY (id_contrato) REFERENCES contratos (id_contrato)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS documentos_prima (
  id_documento_prima INT NOT NULL AUTO_INCREMENT,
  id_pago_prima INT NOT NULL,
  ruta_archivo VARCHAR(255) NOT NULL,
  fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_documento_prima),
  UNIQUE KEY uq_documentos_prima_pago (id_pago_prima),
  CONSTRAINT fk_documentos_prima_pago
    FOREIGN KEY (id_pago_prima) REFERENCES pagos_prima (id_pago_prima)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
