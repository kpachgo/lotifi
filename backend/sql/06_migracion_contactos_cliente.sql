-- Agrega contactos de referencia para clientes sin modificar los datos existentes.
-- Ejecutar dentro de la base de datos `lotifi`.

USE lotifi;

CREATE TABLE IF NOT EXISTS contactos_cliente (
  id_contacto INT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  parentesco VARCHAR(50) NOT NULL,
  dui VARCHAR(15) DEFAULT NULL,
  telefono VARCHAR(50) NOT NULL,
  direccion VARCHAR(250) DEFAULT NULL,
  PRIMARY KEY (id_contacto),
  KEY idx_contactos_cliente (id_cliente),
  CONSTRAINT fk_contactos_cliente_cliente
    FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
