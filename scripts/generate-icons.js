const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createMinimalPNG(size) {
  const rawData = Buffer.alloc(size * size * 4 + size);
  for (let y = 0; y < size; y++) {
    rawData[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      rawData[offset] = 0x5E;
      rawData[offset+1] = 0x24;
      rawData[offset+2] = 0x4E;
      rawData[offset+3] = 0xFF;
    }
  }
  const deflated = zlib.deflateSync(rawData);
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
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

const apps = ['frontend', 'admin', 'comercio', 'domiciliario'];
const root = path.resolve(__dirname, '..');

for (const app of apps) {
  const dir = path.join(root, app, 'public');
  if (fs.existsSync(dir)) {
    fs.writeFileSync(path.join(dir, 'icon-192.png'), createMinimalPNG(192));
    fs.writeFileSync(path.join(dir, 'icon-512.png'), createMinimalPNG(512));
    console.log('icons created for ' + app);
  }
}
