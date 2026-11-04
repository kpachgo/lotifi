const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');

const R2_PREFIX = 'r2:';
const SIGNED_URL_TTL_SECONDS = 300;
const MAX_IMAGE_PIXELS = 40_000_000;
let r2Client;

class R2ConfigurationError extends Error {
  constructor(missingVariables) {
    super(`Configura en backend/.env las variables de R2: ${missingVariables.join(', ')}`);
    this.name = 'R2ConfigurationError';
  }
}

class R2StorageError extends Error {
  constructor(cause) {
    super('No se pudo guardar el comprobante en Cloudflare R2. Verifica la conexión, el nombre del bucket y los permisos.');
    this.name = 'R2StorageError';
    this.cause = cause;
  }
}

class InvalidImageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

function getR2Config() {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME'
  ];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new R2ConfigurationError(missing);

  return {
    accountId: process.env.R2_ACCOUNT_ID.trim(),
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
    bucket: process.env.R2_BUCKET_NAME.trim()
  };
}

function getR2Client(config) {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }
  return r2Client;
}

async function guardarComprobante(buffer, idPago) {
  const config = getR2Config();
  const optimizedBuffer = await optimizarComprobante(buffer);
  const key = `comprobantes/${idPago}/${randomUUID()}.webp`;
  try {
    await getR2Client(config).send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: 'image/webp',
      CacheControl: 'private, no-store',
      Metadata: { id_pago: String(idPago) }
    }));
  } catch (error) {
    throw new R2StorageError(error);
  }

  return `${R2_PREFIX}${key}`;
}

async function optimizarComprobante(buffer) {
  let optimizedBuffer;
  try {
    const image = sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS
    });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new InvalidImageError('El comprobante debe ser una imagen JPG, PNG o WebP válida.');
    }

    optimizedBuffer = await image
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError('No se pudo procesar la imagen. Verifica que sea válida y esté dentro del límite permitido.');
  }
  return optimizedBuffer;
}

async function obtenerUrlComprobante(rutaArchivo) {
  const ruta = String(rutaArchivo || '');
  if (!ruta.startsWith(R2_PREFIX)) {
    const nombre = path.basename(ruta.replace(/\\/g, '/'));
    return `/uploads/${encodeURIComponent(nombre)}`;
  }

  const config = getR2Config();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: ruta.slice(R2_PREFIX.length)
  });
  return getSignedUrl(getR2Client(config), command, {
    expiresIn: SIGNED_URL_TTL_SECONDS
  });
}

async function eliminarComprobante(rutaArchivo) {
  const ruta = String(rutaArchivo || '');
  if (ruta.startsWith(R2_PREFIX)) {
    const config = getR2Config();
    await getR2Client(config).send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: ruta.slice(R2_PREFIX.length)
    }));
    return;
  }

  const nombre = path.basename(ruta.replace(/\\/g, '/'));
  if (!nombre || nombre === '.' || nombre === path.sep) return;

  const uploadDirectories = [
    path.resolve(__dirname, '../uploads'),
    path.resolve(__dirname, '../backend/uploads')
  ];
  const errors = [];
  for (const directory of uploadDirectories) {
    try {
      await fs.unlink(path.join(directory, nombre));
    } catch (error) {
      if (error.code !== 'ENOENT') errors.push(error);
    }
  }
  if (errors.length) throw errors[0];
}

module.exports = {
  InvalidImageError,
  R2ConfigurationError,
  R2StorageError,
  eliminarComprobante,
  guardarComprobante,
  optimizarComprobante,
  obtenerUrlComprobante
};
