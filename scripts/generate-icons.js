const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let n = i;
    for (let j = 0; j < 8; j++) n = (n & 1) ? (0xEDB88320 ^ (n >>> 1)) : (n >>> 1);
    table[i] = n;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcData = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crc]);
}

// Decodifica un PNG RGBA (colorType 6, bitDepth 8, sin entrelazar) a buffer de píxeles.
function decodeRGBA(buf) {
  if (!(buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71)) {
    throw new Error('No es un PNG válido');
  }
  let off = 8;
  let width = 0, height = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error(`PNG no soportado (bitDepth=${data[8]} colorType=${data[9]} interlace=${data[12]})`);
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    if (filter === 1) {
      for (let i = bpp; i < stride; i++) line[i] = (line[i] + line[i - bpp]) & 0xFF;
    } else if (filter === 2) {
      for (let i = 0; i < stride; i++) line[i] = (line[i] + prev[i]) & 0xFF;
    } else if (filter === 3) {
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF;
      }
    } else if (filter === 4) {
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        line[i] = (line[i] + paeth(a, prev[i], i >= bpp ? prev[i - bpp] : 0)) & 0xFF;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, data: out };
}

// Escala con promediado por área y alfa premultiplicado (evita halos en logos transparentes).
function resize(src, sw, sh, dw, dh) {
  const dst = Buffer.alloc(dw * dh * 4);
  const xr = sw / dw, yr = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor(y * yr), sy1 = Math.min(sh, Math.max(sy0 + 1, Math.ceil((y + 1) * yr)));
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor(x * xr), sx1 = Math.min(sw, Math.max(sx0 + 1, Math.ceil((x + 1) * xr)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * sw + sx) * 4;
          const al = src[i + 3];
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
        }
      }
      const di = (y * dw + x) * 4;
      if (a > 0) {
        dst[di] = Math.round(r / a);
        dst[di + 1] = Math.round(g / a);
        dst[di + 2] = Math.round(b / a);
        dst[di + 3] = Math.round(a / n);
      }
    }
  }
  return dst;
}

function encodeRGBA(width, height, data) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'frontend', 'public', 'logoGoPa.png');
const { width: sw, height: sh, data: src } = decodeRGBA(fs.readFileSync(logoPath));
console.log(`Logo fuente: ${sw}x${sh}`);

const apps = ['frontend', 'admin', 'comercio', 'domiciliario'];
for (const size of [192, 512]) {
  const resized = resize(src, sw, sh, size, size);
  const png = encodeRGBA(size, size, resized);
  for (const app of apps) {
    const dir = path.join(root, app, 'public');
    if (fs.existsSync(dir)) {
      fs.writeFileSync(path.join(dir, `icon-${size}.png`), png);
    }
  }
  console.log(`icon-${size}.png generado para: ${apps.join(', ')}`);
}
