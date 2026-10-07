const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const config = require('../config');
const sharp = require('sharp');
const cloudinary = require('./cloudinary.service');

const genAI = config.gemini?.apiKey ? new GoogleGenerativeAI(config.gemini.apiKey) : null;
const openai = config.openai?.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null;
const deepseek = config.deepseek?.apiKey ? new OpenAI({ 
  apiKey: config.deepseek.apiKey, 
  baseURL: 'https://api.deepseek.com/v1' 
}) : null;

const SYSTEM_PROMPT = `
Eres un extractor de menús de restaurantes. Recibes imágenes o texto de un menú y devuelves SOLO un JSON válido con la estructura exacta que se te indica.

REGLAS ESTRICTAS:
1. NO agregues explicaciones, saludos, ni texto extra. SOLO JSON.
2. Si no estás seguro de un campo, usa null o string vacío.
3. Precios: número decimal (ej: 25000, 18.50). Sin símbolos de moneda.
4. Categorías: normaliza a una de: "entradas", "platos fuertes", "acompañamientos", "bebidas", "postres", "combos", "especiales", "otras".
5. Si ves "incluye" o componentes, ponlos en "descripcion".
6. Ignora logotipos, decoración, texto legal, horarios, datos de contacto.
7. Para cada producto DEBES incluir "bounding_box" con coordenadas normalizadas 0-1: {x, y, width, height} donde (0,0) es esquina superior izquierda. El bounding_box debe delimitar SOLO la FOTOGRAFÍA del alimento, sin incluir texto, precios ni filas de otros productos. Recorta la zona más ajustada posible a la foto. IMPORTANTE: si el producto NO tiene fotografía visible en la carta, usa "bounding_box": null (no recortes texto).
8. Para cada producto DEBES incluir un "emoji" que represente visualmente el plato (ej: 🍔 para hamburguesa, 🍕 para pizza, 🥗 para ensalada, 🍜 para sopa, 🍗 para pollo, ☕ para café, 🥤 para gaseosa, 🍰 para postre, 🌮 para taco, 🍝 para pasta, 🍟 para papas, 🌭 para perro caliente, 🧀 para queso). Usa un solo emoji Unicode simple, sin variantes de piel ni composiciones complejas.

ESQUEMA DE SALIDA:
{
  "productos": [
    {
      "nombre": "string (max 100 chars)",
      "descripcion": "string (max 300 chars)",
      "precio": number,
      "categoria": "string (una de las listadas arriba)",
      "disponible": true,
      "bounding_box": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.15 },
      "emoji": "🍔"
    }
  ],
  "metadatos": {
    "moneda_detectada": "COP|USD|EUR|...",
    "idioma_detectado": "es|en|...",
    "confianza_global": 0.0-1.0
  }
}
`;

const OPENAI_PROMPT = SYSTEM_PROMPT + '\n\nResponde SOLO con el JSON válido, sin markdown, sin explicaciones.';

async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error descargando ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

function sanitizeJson(text) {
  return text
    .replace(/([^\\])"\s*\n\s*"([^"]*":)/g, '$1"\\n"$2')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

async function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('[AI] JSON.parse falló, intentando sanitizar...', e.message);
    const sanitized = sanitizeJson(text);
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      console.error('[AI] Error parsing tras sanitizar:', sanitized?.slice(0, 500));
      throw new Error('La IA devolvió JSON inválido');
    }
  }
}

async function callGemini(imageBuffers, promptText) {
  if (!genAI) throw new Error('GEMINI_API_KEY no configurada');
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const imageParts = imageBuffers.map((buf, i) => [
    { text: `Imagen ${i + 1}:` },
    { inlineData: { mimeType: buf.mimeType, data: buf.buffer.toString('base64') } }
  ]).flat();

  const prompt = [
    { text: SYSTEM_PROMPT },
    { text: promptText },
    ...imageParts,
  ];

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return tryParseJson(text);
}

async function callOpenAI(imageBuffers, promptText) {
  if (!openai) throw new Error('OPENAI_API_KEY no configurada');
  
  const messages = [
    { role: 'system', content: OPENAI_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        ...imageBuffers.map(buf => ({
          type: 'image_url',
          image_url: { url: `data:${buf.mimeType};base64,${buf.buffer.toString('base64')}`, detail: 'high' }
        }))
      ]
    }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  });
  
  const rawContent = response.choices[0].message.content;
  console.log('[OpenAI] Raw response:', rawContent?.slice(0, 500));
  return tryParseJson(rawContent);
}

async function callDeepSeek(imageBuffers, promptText) {
  if (!deepseek) throw new Error('DEEPSEEK_API_KEY no configurada');
  
  const messages = [
    { role: 'system', content: OPENAI_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        ...imageBuffers.map(buf => ({
          type: 'image_url',
          image_url: { url: `data:${buf.mimeType};base64,${buf.buffer.toString('base64')}`, detail: 'high' }
        }))
      ]
    }
  ];

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  });
  
  return tryParseJson(response.choices[0].message.content);
}

const PROVIDER_FNS = {
  gemini: callGemini,
  openai: callOpenAI,
  deepseek: callDeepSeek,
};

async function callAIWithFallback(imageBuffers, promptText) {
  const providers = config.aiProviders?.fallbackOrder || ['gemini', 'openai', 'deepseek'];
  const availableProviders = providers.filter(p => PROVIDER_FNS[p] && (
    p === 'gemini' && genAI ||
    p === 'openai' && openai ||
    p === 'deepseek' && deepseek
  ));

  // Check if any buffer is a non-image (PDF) - OpenAI/DeepSeek only support images
  const hasNonImage = imageBuffers.some(buf => !buf.mimeType?.startsWith('image/'));
  
  // Filter providers: OpenAI and DeepSeek only support images
  const supportedProviders = availableProviders.filter(p => {
    if (hasNonImage && (p === 'openai' || p === 'deepseek')) {
      console.log(`[AI] ${p} no soporta PDF, saltando...`);
      return false;
    }
    return true;
  });

  if (supportedProviders.length === 0) {
    throw new Error('No hay proveedores de IA que soporten el tipo de archivo (PDF requiere Gemini)');
  }

  let lastError;
  for (const provider of supportedProviders) {
    try {
      console.log(`[AI] Intentando con ${provider}...`);
      const result = await PROVIDER_FNS[provider](imageBuffers, promptText);
      console.log(`[AI] ✅ Éxito con ${provider}`);
      return { ...result, provider };
    } catch (error) {
      console.warn(`[AI] ${provider} falló:`, error.message);
      lastError = error;
      
      const isQuotaError = error.message?.includes('quota') || 
                          error.message?.includes('429') || 
                          error.message?.includes('Too Many Requests') ||
                          error.message?.includes('CUOTA_AGOTADA') ||
                          error.message?.includes('exceeded') ||
                          error.message?.includes('rate limit') ||
                          error.message?.includes('402') ||
                          error.message?.includes('Insufficient Balance') ||
                          error.message?.includes('insufficient_balance') ||
                          error.message?.includes('unsupported image') ||
                          error.message?.includes('Invalid MIME type');
       
       const isModelNotFoundError = error.message?.includes('404') || 
                                    error.message?.includes('Not Found') ||
                                    error.message?.toLowerCase().includes('not found') ||
                                    error.message?.toLowerCase().includes('model not found') ||
                                    error.message?.toLowerCase().includes('model not available');
        
       if (isQuotaError || isModelNotFoundError) {
         console.log(`[AI] ${provider} - ${isQuotaError ? 'cuota agotada' : 'modelo no disponible'}, probando siguiente...`);
         continue;
       }
       
       throw error;
    }
  }
  
  throw lastError || new Error('Todos los proveedores de IA fallaron');
}

async function parseMenuFromImages(imageUrls, mimeTypes = []) {
  const imageBuffers = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const base64 = await fetchAsBase64(imageUrls[i]);
    imageBuffers.push({ buffer: Buffer.from(base64, 'base64'), mimeType: mimeTypes[i] || 'image/jpeg' });
  }
  return callAIWithFallback(imageBuffers, 'Analiza estas imágenes del menú y extrae TODOS los productos con sus bounding boxes:');
}

async function parseMenuFromText(text) {
  return callAIWithFallback([], `Extrae productos de este texto de menú:\n\n${text}`);
}

async function parseMenuFromDataUrls(dataUrls) {
  const imageBuffers = [];
  
  for (let i = 0; i < dataUrls.length; i++) {
    const m = String(dataUrls[i]).match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) throw new Error('Formato de carta inválido (se esperaba base64)');
    
    const buffer = Buffer.from(m[2], 'base64');
    imageBuffers.push({ buffer, mimeType: m[1] });
  }

  return callAIWithFallback(imageBuffers, 'Analiza estos archivos de menú y extrae TODOS los productos con sus bounding boxes:');
}

async function cropAndUploadProducts(imageBuffer, mimeType, productos) {
  try {
    console.log('[Crop] Productos recibidos:', productos.map(p => ({ nombre: p.nombre, bounding_box: p.bounding_box })));
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    const results = [];
    
    for (const producto of productos) {
      const box = producto.bounding_box;
      if (!box || typeof box.x !== 'number') {
        results.push({ ...producto, imagen: '', emoji: resolveEmoji(producto) });
        continue;
      }

      let x = Math.round(box.x * imgWidth);
      let y = Math.round(box.y * imgHeight);
      let width = Math.round(box.width * imgWidth);
      let height = Math.round(box.height * imgHeight);

      // Rechazar recortes minúsculos o fuera de rango: probablemente texto, no foto
      if (width < 40 || height < 40 || width > imgWidth || height > imgHeight) {
        results.push({ ...producto, imagen: '', emoji: resolveEmoji(producto) });
        continue;
      }

      // Ampliar ligeramente la caja para evitar cortes pegados al borde de la foto
      const EDGE = 0.12;
      x = Math.round(x - width * EDGE);
      y = Math.round(y - height * EDGE);
      width = Math.round(width * (1 + 2 * EDGE));
      height = Math.round(height * (1 + 2 * EDGE));

      const safeX = Math.max(0, Math.min(x, imgWidth - 1));
      const safeY = Math.max(0, Math.min(y, imgHeight - 1));
      const safeWidth = Math.max(1, Math.min(width, imgWidth - safeX));
      const safeHeight = Math.max(1, Math.min(height, imgHeight - safeY));

      try {
        const croppedBuffer = await sharp(imageBuffer)
          .extract({ left: safeX, top: safeY, width: safeWidth, height: safeHeight })
          .modulate({ saturation: 1.08, brightness: 1.03 })
          .resize(320, 320, { fit: 'cover', position: 'center' })
          .sharpen({ sigma: 0.9 })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();

        const uploadResult = await cloudinary.uploadBase64(
          `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`,
          'domicilios/productos'
        );
        
        results.push({ ...producto, imagen: uploadResult.url });
      } catch (cropErr) {
        console.warn(`Error recortando producto ${producto.nombre}:`, cropErr.message);
        results.push({ ...producto, imagen: '', emoji: resolveEmoji(producto) });
      }
    }

    return results;
  } catch (err) {
    console.error('Error en cropAndUploadProducts:', err.message);
    return productos.map(p => ({ ...p, imagen: '', emoji: resolveEmoji(p) }));
  }
}

const EMOJI_POR_CATEGORIA = {
  'entradas': '🥟',
  'platos fuertes': '🍽️',
  'acompañamientos': '🍟',
  'bebidas': '🥤',
  'postres': '🍰',
  'combos': '🍱',
  'especiales': '⭐',
  'otras': '🍴',
};

const EMOJI_POR_PISTA = [
  [['hamburguesa', 'hamburg', 'burg', 'burger'], '🍔'],
  [['cheese', 'queso'], '🧀'],
  [['pizza'], '🍕'],
  [['perro', 'hotdog', 'hot dog', 'salchicha', 'salchi'], '🌭'],
  [['taco', 'burrit'], '🌮'],
  [['arepa'], '🌽'],
  [['gaseosa', 'refresco', 'limonada', 'jugo', 'malteada', 'smoothie', 'batido', 'coco', 'té', 'cafe', 'agua', 'colonial', 'manzana', 'pepsi', 'coca', 'sprite', 'fanta'], '🥤'],
  [['cerveza'], '🍺'],
  [['vino'], '🍷'],
  [['coctel', 'cóctel', 'cocktail'], '🍹'],
  [['papa', 'fritas', 'patacón', 'patacon', 'yuca', 'acompañamiento', 'acompa'], '🍟'],
  [['ensalad'], '🥗'],
  [['pasta', 'espaguet', 'lasagna', 'ravioli', 'fettuccine'], '🍝'],
  [['sopa', 'sancocho', 'crema'], '🍜'],
  [['postre', 'torta', 'tres leches', 'helado', 'brownie', 'cheesecake'], '🍰'],
  [['pollo'], '🍗'],
  [['carne', 'res', 'costilla', 'asado', 'steak'], '🥩'],
  [['camarón', 'camaron', 'marisco', 'pescado'], '🍤'],
  [['sandwich', 'submarino'], '🥪'],
  [['combo'], '🍱'],
];

function isValidEmoji(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  const t = s.trim();
  if (t.length > 4 || t.length < 1) return false;
  const cp = [...t][0].codePointAt(0);
  const v = [...t].find(ch => ch.codePointAt(0) >= 0x1F300);
  if (!v) return false;
  return [...t].filter(ch => ch.codePointAt(0) >= 0x1F300).length <= 2;
}

function resolveEmoji(producto) {
  const p = producto || {};
  const directo = (p.emoji && String(p.emoji).trim()) || '';
  if (isValidEmoji(directo)) return directo;

  const nombre = String(p.nombre || '').toLowerCase();
  const descripcion = String(p.descripcion || '').toLowerCase();

  for (const [pistas, emoji] of EMOJI_POR_PISTA) {
    if (pistas.some(pi => nombre.includes(pi) || descripcion.includes(pi))) {
      return emoji;
    }
  }

  const categoria = String(p.categoria || '').toLowerCase().trim();
  return EMOJI_POR_CATEGORIA[categoria] || '🍴';
}

function normalizeProducts(parsed) {
  const validCategories = [
    'entradas', 'platos fuertes', 'acompañamientos', 
    'bebidas', 'postres', 'combos', 'especiales', 'otras'
  ];

  const productos = parsed.productos
    .filter(p => p.nombre && p.nombre.trim().length > 0)
    .map((p, idx) => {
      const categoria = (p.categoria || 'otras').toLowerCase().trim();
      const catNormalizada = validCategories.includes(categoria) ? categoria : 'otras';
      const producto = {
        ...p,
        nombre: String(p.nombre).trim().slice(0, 100),
        descripcion: p.descripcion ? String(p.descripcion).trim().slice(0, 300) : '',
        precio: Number(p.precio) || 0,
        categoria: catNormalizada,
      };
      const emoji = resolveEmoji(producto);
      return {
        ...producto,
        disponible: p.disponible !== false,
        _originalIndex: idx,
        _confianza: parsed.metadatos?.confianza_global || 0.8,
        bounding_box: p.bounding_box || null,
        emoji,
      };
    })
    .filter(p => p.precio > 0 && p.nombre.length >= 2);

  return {
    productos,
    metadatos: {
      moneda_detectada: parsed.metadatos?.moneda_detectada || 'COP',
      idioma_detectado: parsed.metadatos?.idioma_detectado || 'es',
      confianza_global: parsed.metadatos?.confianza_global || 0.8,
      total_extraidos: productos.length,
    },
  };
}

async function parseMenuWithRetry(input, type = 'images', retries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (type === 'images') {
        return await parseMenuFromImages(input);
      } else {
        return await parseMenuFromText(input);
      }
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  parseMenuFromImages,
  parseMenuFromText,
  parseMenuFromDataUrls,
  parseMenuWithRetry,
  normalizeProducts,
  cropAndUploadProducts,
  resolveEmoji,
};