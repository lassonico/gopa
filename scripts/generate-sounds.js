const fs = require('fs');
const path = require('path');

function generateWAV(freq, duration, amplitude) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);

  // RIFF header
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  function writeString(str) {
    buffer.write(str, offset);
    offset += str.length;
  }
  function writeUInt16(val) {
    buffer.writeUInt16LE(val, offset);
    offset += 2;
  }
  function writeUInt32(val) {
    buffer.writeUInt32LE(val, offset);
    offset += 4;
  }

  writeString('RIFF');
  writeUInt32(36 + dataSize);
  writeString('WAVE');
  writeString('fmt ');
  writeUInt32(16);
  writeUInt16(1); // PCM
  writeUInt16(numChannels);
  writeUInt32(sampleRate);
  writeUInt32(sampleRate * numChannels * (bitsPerSample / 8));
  writeUInt16(numChannels * (bitsPerSample / 8));
  writeUInt16(bitsPerSample);
  writeString('data');
  writeUInt32(dataSize);

  // Generate sine wave with fade in/out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Fade envelope
    const fadeIn = Math.min(1, i / (sampleRate * 0.02));
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 0.05));
    const envelope = fadeIn * fadeOut;
    const sample = Math.sin(2 * Math.PI * freq * t) * amplitude * envelope;
    buffer.writeInt16LE(Math.round(sample * 32767), offset);
    offset += 2;
  }

  return buffer;
}

const root = path.resolve(__dirname, '..');

// Comercio: 880Hz (A5) - tono agudo, "ding" de nuevo pedido
const comercioSound = generateWAV(880, 0.4, 0.6);
const comercioDir = path.join(root, 'comercio', 'public');
if (fs.existsSync(comercioDir)) {
  fs.writeFileSync(path.join(comercioDir, 'notification.wav'), comercioSound);
  console.log('✓ Comercio notification.wav');
}

// Domiciliario: 660Hz (E5) - tono medio, "chime" de nuevo domicilio
const domSound = generateWAV(660, 0.4, 0.6);
const domDir = path.join(root, 'domiciliario', 'public');
if (fs.existsSync(domDir)) {
  fs.writeFileSync(path.join(domDir, 'notification.wav'), domSound);
  console.log('✓ Domiciliario notification.wav');
}
