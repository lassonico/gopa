const config = require('../config');
const fs = require('fs');
const path = require('path');

const cloudinary = require('cloudinary').v2;

const IMAGES_DIR = path.join(__dirname, '../../data/images');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const hasCloudinaryConfig = () =>
  Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function localUpload(buffer) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const filePath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { url: `/uploads/${filename}`, publicId: `local/${filename}` };
}

// Genera URL de entrega optimizada (webp/avif + calidad automática + redimensionado con límite)
function deliveryUrl(publicId, width) {
  if (!hasCloudinaryConfig()) return null;
  const params = { secure: true, fetch_format: 'auto', quality: 'auto' };
  if (width) {
    params.crop = 'limit';
    params.width = width;
  }
  return cloudinary.url(publicId, params);
}

async function upload(buffer, folder = 'domicilios', { width } = {}) {
  if (!hasCloudinaryConfig()) {
    return localUpload(buffer);
  }
  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (err, result) => {
        if (err) {
          console.error('Cloudinary upload falló, usando almacenamiento local:', err.message || err);
          resolve(localUpload(buffer));
        } else {
          resolve({ url: deliveryUrl(result.public_id, width), publicId: result.public_id });
        }
      }
    );
    uploadStream.end(buffer);
  });
}

async function uploadBase64(base64String, folder = 'domicilios', { width } = {}) {
  if (!hasCloudinaryConfig()) {
    const buffer = Buffer.from(base64String.replace(/^data:[^;]+;base64,/, ''), 'base64');
    return localUpload(buffer);
  }
  const result = await cloudinary.uploader.upload(base64String, { folder });
  return { url: deliveryUrl(result.public_id, width), publicId: result.public_id };
}

async function remove(publicId) {
  if (!publicId || publicId.startsWith('local/')) return;
  await cloudinary.uploader.destroy(publicId);
}

async function extractPublicId(url) {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    return `local/${url.split('/').pop()}`;
  }
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    if (uploadIndex === -1) return null;

    let tail = segments.slice(uploadIndex + 1);
    // Quitar segmentos de transformación (p. ej. f_auto,q_auto,c_limit,w_600) al inicio
    while (tail.length > 1 && /[_,]/.test(tail[0]) && !/^v\d+$/.test(tail[0])) {
      tail = tail.slice(1);
    }
    // Quitar versión (v<digits>)
    if (/^v\d+$/.test(tail[0])) tail = tail.slice(1);

    const file = tail.pop();
    if (!file) return null;
    const name = file.replace(/\.[a-zA-Z0-9]+$/, '');
    return tail.length ? `${tail.join('/')}/${name}` : name;
  } catch {
    return null;
  }
}

module.exports = { upload, uploadBase64, remove, extractPublicId, deliveryUrl };
