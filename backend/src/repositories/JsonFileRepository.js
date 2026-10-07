const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

class JsonFileRepository {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this._ensureSheet('Usuarios');
    this._ensureSheet('Comercios');
    this._ensureSheet('Productos');
    this._ensureSheet('Categorias');
    this._ensureSheet('Pedidos');
    this._ensureSheet('Calificaciones');
    this._ensureSheet('Notificaciones');
    this._ensureSheet('Cupones');
    this._ensureSheet('Pagos');
    this._ensureSheet('Promociones');
    this._ensureSheet('Servicios');
    this._ensureSheet('Solicitudes');
    this._ensureSheet('Anuncios');
    this._ensureSheet('TrabajosFallidos');
    this._ensureSheet('Verificaciones');
    this._ensureSheet('Invitaciones');
    this._ensureSheet('Subcategorias');
    console.log('[DB] JsonFileRepository: usando almacenamiento local en data/');
  }

  _getFilePath(sheetName) {
    return path.join(DATA_DIR, `${sheetName}.json`);
  }

  _ensureSheet(sheetName) {
    const filePath = this._getFilePath(sheetName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8');
    }
  }

  _read(sheetName) {
    try {
      const filePath = this._getFilePath(sheetName);
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  _write(sheetName, data) {
    const filePath = this._getFilePath(sheetName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async findAll(sheetName) {
    return this._read(sheetName);
  }

  async findById(sheetName, id) {
    const data = this._read(sheetName);
    return data.find(item => item.id === id) || null;
  }

  async findWhere(sheetName, field, value) {
    const data = this._read(sheetName);
    return data.filter(item => item[field] === value);
  }

  async findOne(sheetName, field, value) {
    const data = this._read(sheetName);
    return data.find(item => item[field] === value) || null;
  }

  async findWhereIn(sheetName, field, values) {
    if (!values || values.length === 0) return [];
    const data = this._read(sheetName);
    return data.filter(item => values.includes(item[field]));
  }

  async findWithFilters(sheetName, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return this.findAll(sheetName);
    }
    const data = this._read(sheetName);
    return data.filter(item => {
      for (const [field, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          if (!value.includes(item[field])) return false;
        } else {
          if (item[field] !== value) return false;
        }
      }
      return true;
    });
  }

  async create(sheetName, entry) {
    const data = this._read(sheetName);
    data.push(entry);
    this._write(sheetName, data);
    return { success: true, id: entry.id };
  }

  async update(sheetName, id, updates) {
    const data = this._read(sheetName);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) throw new Error('Registro no encontrado');
    data[index] = { ...data[index], ...updates };
    this._write(sheetName, data);
    return { success: true };
  }

  async delete(sheetName, id) {
    const data = this._read(sheetName);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) throw new Error('Registro no encontrado');
    data.splice(index, 1);
    this._write(sheetName, data);
    return { success: true };
  }

  async uploadImage(fileName, mimeType, buffer) {
    const imagesDir = path.join(DATA_DIR, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { id: fileName, url: `/uploads/${fileName}` };
  }

  async deleteImage(fileId) {
    const filePath = path.join(DATA_DIR, 'images', fileId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  }
}

module.exports = JsonFileRepository;