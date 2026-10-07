const cloudinary = require('../../services/cloudinary.service');
const sharp = require('sharp');

function esHeic(buffer, mimeType) {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return true;
  if (!buffer || buffer.length < 12) return false;
  return buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
}

// iPhone (HEIC) → JPEG para compatibilidad universal
async function normalizarHeic(buffer, mimeType) {
  if (!esHeic(buffer, mimeType)) return { buffer, mimeType };
  try {
    const jpeg = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
    return { buffer: jpeg, mimeType: 'image/jpeg' };
  } catch (e) {
    const err = new Error('No se pudo procesar la imagen HEIC. Prueba con JPG o PNG.');
    err.status = 400;
    throw err;
  }
}

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' });
    }
    const { buffer } = await normalizarHeic(req.file.buffer, req.file.mimetype);
    const result = await cloudinary.upload(buffer, 'domicilios');
    res.json({ url: result.url, publicId: result.publicId });
  } catch (error) {
    next(error);
  }
};

exports.uploadBase64 = async (req, res, next) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen (campo file requerido)' });
    }
    const match = String(file).match(/^data:([^;]+);base64,(.+)$/s);
    let dataUrl = file;
    if (match && esHeic(null, match[1])) {
      const buffer = Buffer.from(match[2], 'base64');
      const { buffer: norm } = await normalizarHeic(buffer, match[1]);
      dataUrl = `data:image/jpeg;base64,${norm.toString('base64')}`;
    }
    const result = await cloudinary.uploadBase64(dataUrl, 'domicilios/productos');
    res.json({ url: result.url, publicId: result.publicId });
  } catch (error) {
    next(error);
  }
};
