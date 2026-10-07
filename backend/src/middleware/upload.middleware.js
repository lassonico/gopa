const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'image/gif': [0x47, 0x49, 0x46, 0x38]
};

// HEIC/HEIF: caja 'ftyp' en bytes 4-7 (la marca varía: heic, heix, hevc, mif1...)
function isHeicBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  return buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
}

function validateMagicBytes(buffer, mimeType) {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return isHeicBuffer(buffer);
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.every((byte, i) => buffer[i] === byte);
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP, GIF, HEIC)'), false);
    }
    cb(null, true);
  }
});

const validateFileContent = (req, res, next) => {
  if (!req.file) return next();
  
  if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ error: 'Archivo inválido: contenido no coincide con el tipo MIME' });
  }
  
  next();
};

module.exports = { upload, validateFileContent };