const db = require('../config/db');

const contactFields = {
  nombres: { label: 'Nombres', maxLength: 100, required: true },
  apellidos: { label: 'Apellidos', maxLength: 100, required: true },
  parentesco: { label: 'Parentesco', maxLength: 50, required: true },
  dui: { label: 'DUI', maxLength: 15 },
  telefono: { label: 'Teléfono de contacto', maxLength: 50, required: true },
  direccion: { label: 'Dirección', maxLength: 250 }
};

function validarContactos(contactos) {
  if (!Array.isArray(contactos)) return { error: 'La lista de contactos no es válida.' };

  const normalizados = [];
  for (const [index, contacto] of contactos.entries()) {
    if (!contacto || typeof contacto !== 'object' || Array.isArray(contacto)) {
      return { error: `El contacto ${index + 1} no es válido.` };
    }

    const normalizado = {};
    for (const [field, rules] of Object.entries(contactFields)) {
      const value = contacto[field] == null ? '' : contacto[field];
      if (typeof value !== 'string') {
        return { error: `${rules.label} del contacto ${index + 1} no es válido.` };
      }

      normalizado[field] = value.trim();
      if (rules.required && !normalizado[field]) {
        return { error: `Ingresa ${rules.label.toLowerCase()} del contacto ${index + 1}.` };
      }
      if (normalizado[field].length > rules.maxLength) {
        return {
          error: `${rules.label} del contacto ${index + 1} no puede superar ${rules.maxLength} caracteres.`
        };
      }
    }
    normalizados.push(normalizado);
  }

  return { contactos: normalizados };
}

async function reemplazarContactos(conn, idCliente, contactos) {
  await conn.query('DELETE FROM contactos_cliente WHERE id_cliente = ?', [idCliente]);
  if (!contactos.length) return;

  const values = contactos.map(contacto => [
    idCliente,
    contacto.nombres,
    contacto.apellidos,
    contacto.parentesco,
    contacto.dui || null,
    contacto.telefono,
    contacto.direccion || null
  ]);
  await conn.query(
    `INSERT INTO contactos_cliente
      (id_cliente, nombres, apellidos, parentesco, dui, telefono, direccion)
     VALUES ?`,
    [values]
  );
}

// LISTAR
exports.listar = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM cliente ORDER BY id_cliente DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR CLIENTE:', error);
    res.status(500).json(error);
  }
};

// CREAR
exports.crear = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { nombres, apellidos, dui, nit, telefono, direccion } = req.body;
    const contactosIncluidos = Object.prototype.hasOwnProperty.call(req.body, 'contactos');
    const resultadoContactos = contactosIncluidos
      ? validarContactos(req.body.contactos)
      : { contactos: [] };
    if (resultadoContactos.error) {
      return res.status(400).json({ error: resultadoContactos.error });
    }
    const nitNormalizado =
      typeof nit === 'string' ? (nit.trim() || null) : (nit || null);

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO cliente 
       (nombres, apellidos, dui, nit, telefono, direccion)
       VALUES (?,?,?,?,?,?)`,
      [nombres, apellidos, dui, nitNormalizado, telefono, direccion]
    );
    await reemplazarContactos(conn, result.insertId, resultadoContactos.contactos);
    await conn.commit();

    return res.status(201).json({ ok: true, id_cliente: result.insertId });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('ERROR REVERTIR CREACIÓN DE CLIENTE:', rollbackError);
    }
    console.error('ERROR CREAR CLIENTE:', error);
    return res.status(500).json({ error: 'No se pudo guardar el cliente.' });
  } finally {
    conn.release();
  }
};

// OBTENER
exports.obtener = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM cliente WHERE id_cliente = ?',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No se encontró el cliente.' });

    const [contactos] = await db.query(
      `SELECT id_contacto, nombres, apellidos, parentesco, dui, telefono, direccion
       FROM contactos_cliente
       WHERE id_cliente = ?
       ORDER BY id_contacto`,
      [req.params.id]
    );
    return res.json({ ...rows[0], contactos });
  } catch (error) {
    console.error('ERROR OBTENER CLIENTE:', error);
    return res.status(500).json({ error: 'No se pudo obtener el cliente.' });
  }
};

// ACTUALIZAR
exports.actualizar = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { nombres, apellidos, dui, nit, telefono, direccion } = req.body;
    const contactosIncluidos = Object.prototype.hasOwnProperty.call(req.body, 'contactos');
    const resultadoContactos = contactosIncluidos
      ? validarContactos(req.body.contactos)
      : null;
    if (resultadoContactos?.error) {
      return res.status(400).json({ error: resultadoContactos.error });
    }
    const nitNormalizado =
      typeof nit === 'string' ? (nit.trim() || null) : (nit || null);

    await conn.beginTransaction();
    const [[cliente]] = await conn.query(
      'SELECT id_cliente FROM cliente WHERE id_cliente = ? FOR UPDATE',
      [req.params.id]
    );
    if (!cliente) {
      await conn.rollback();
      return res.status(404).json({ error: 'No se encontró el cliente.' });
    }

    await conn.query(
      `UPDATE cliente SET
        nombres=?, apellidos=?, dui=?, nit=?, telefono=?, direccion=?
       WHERE id_cliente=?`,
      [nombres, apellidos, dui, nitNormalizado, telefono, direccion, req.params.id]
    );
    if (contactosIncluidos) {
      await reemplazarContactos(conn, req.params.id, resultadoContactos.contactos);
    }
    await conn.commit();

    return res.json({ ok: true });
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('ERROR REVERTIR ACTUALIZACIÓN DE CLIENTE:', rollbackError);
    }
    console.error('ERROR ACTUALIZAR CLIENTE:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el cliente.' });
  } finally {
    conn.release();
  }
};

// ELIMINAR
exports.eliminar = async (req, res) => {
  try {
    await db.query(
      'DELETE FROM cliente WHERE id_cliente = ?',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json(error);
  }
};
