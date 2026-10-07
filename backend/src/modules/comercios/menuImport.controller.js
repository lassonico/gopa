const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { parseMenuWithRetry, normalizeProducts } = require('../../services/menuParser.service');
const repository = require('../../repositories');
const { validate, schemas } = require('../../middleware/validation.middleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP) y PDF'), false);
    }
    cb(null, true);
  },
});

async function uploadToCloudinary(buffer, mimetype, folder = 'menus/temp') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { 
        resource_type: mimetype === 'application/pdf' ? 'raw' : 'image',
        folder,
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

exports.uploadMenu = [
  upload.array('menu', 5),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un archivo (imagen o PDF)' });
      }

      const uploadPromises = req.files.map(f => uploadToCloudinary(f.buffer, f.mimetype));
      const uploadResults = await Promise.all(uploadPromises);

      const imageUrls = uploadResults
        .filter(r => r.resource_type === 'image')
        .map(r => r.secure_url);
      
      const pdfUrls = uploadResults
        .filter(r => r.resource_type === 'raw')
        .map(r => r.secure_url);

      let allProducts = [];

      if (imageUrls.length > 0) {
        const parsed = await parseMenuWithRetry(imageUrls, 'images');
        allProducts.push(...parsed.productos);
      }

      if (pdfUrls.length > 0) {
        for (const pdfUrl of pdfUrls) {
          const parsed = await parseMenuWithRetry([pdfUrl], 'images');
          allProducts.push(...parsed.productos);
        }
      }

      const normalized = normalizeProducts({ productos: allProducts });

      const preview = {
        productos: normalized.productos,
        metadatos: {
          total_archivos: req.files.length,
          imagenes: imageUrls.length,
          pdfs: pdfUrls.length,
          ...normalized.metadatos,
        },
        _tempUrls: uploadResults.map(r => r.secure_url),
      };

      res.json({
        success: true,
        preview,
        message: `Se detectaron ${preview.productos.length} productos. Revisa y confirma para guardar.`,
      });
    } catch (error) {
      console.error('Menu upload error:', error);
      if (error.name === 'ZodError') {
        return res.status(422).json({ error: 'Error validando respuesta de IA', details: error.errors });
      }
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        return res.status(429).json({ error: 'Límite de API alcanzado. Intenta en unos minutos.' });
      }
      next(error);
    }
  }
];

exports.confirmMenuImport = async (req, res, next) => {
  try {
    const { comercioId, productos } = req.body;
    
    if (!comercioId || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ error: 'comercioId y array productos son requeridos' });
    }

    const comercio = await repository.findById('Comercios', comercioId);
    if (!comercio) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }
    if (comercio.usuarioId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado para este comercio' });
    }

    const validProducts = [];
    const errors = [];

    for (let i = 0; i < productos.length; i++) {
      const p = productos[i];
      const parsed = schemas.createProducto.safeParse({ 
        ...p, 
        comercioId,
        disponible: p.disponible !== false 
      });
      
      if (!parsed.success) {
        errors.push({ index: i, producto: p.nombre, errors: parsed.error.errors });
        continue;
      }
      validProducts.push(parsed.data);
    }

    if (validProducts.length === 0) {
      return res.status(400).json({ error: 'Ningún producto válido para importar', errors });
    }

    const created = await Promise.all(
      validProducts.map(p => repository.create('Productos', { 
        ...p, 
        id: require('crypto').randomUUID(),
        fechaCreacion: new Date().toISOString(),
      }))
    );

    res.status(201).json({
      success: true,
      message: `${created.length} productos importados correctamente`,
      importados: created.length,
      omitidos: errors.length,
      errores: errors.length > 0 ? errors : undefined,
      productos: created,
    });
  } catch (error) {
    next(error);
  }
};

exports.getImportPreview = async (req, res, next) => {
  try {
    const { tempUrls } = req.query;
    if (!tempUrls) {
      return res.status(400).json({ error: 'tempUrls requerido' });
    }
    const urls = Array.isArray(tempUrls) ? tempUrls : [tempUrls];
    const parsed = await parseMenuWithRetry(urls, 'images');
    res.json({ success: true, preview: normalizeProducts(parsed) });
  } catch (error) {
    next(error);
  }
};