const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

// Tablas conocidas + validación de identificadores: los valores van
// parametrizados (?), pero tabla/columna se interpolan; solo se permiten
// nombres alfanuméricos de tablas existentes para cerrar inyección por claves.
const ALLOWED_TABLES = new Set([
  'Usuarios', 'Comercios', 'Productos', 'Categorias', 'Subcategorias',
  'Pedidos', 'Calificaciones', 'Notificaciones', 'Cupones', 'Pagos',
  'Promociones', 'Servicios', 'Solicitudes', 'Mandados', 'Anuncios',
  'TrabajosFallidos', 'Verificaciones', 'Invitaciones', 'Configuraciones', 'configuraciones',
]);
const IDENT_RE = /^[A-Za-z0-9_]+$/;

function assertIdent(name, kind) {
  if (kind === 'tabla' ? !ALLOWED_TABLES.has(name) : !IDENT_RE.test(name || '')) {
    const err = new Error(`${kind === 'tabla' ? 'Tabla' : 'Columna'} no permitida`);
    err.status = 400;
    throw err;
  }
  return name;
}

class MySQLRepository {
  constructor() {
    this.pool = null;
    this._migrated = false;
  }

  async _getPool() {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: config.mysql.host,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        port: config.mysql.port,
        waitForConnections: true,
        connectionLimit: 25,
        queueLimit: 0
      });
      await this._initTables();
      if (!this._migrated) {
        await this._migrateSchema();
        this._migrated = true;
      }
    }
    return this.pool;
  }

  async _initTables() {
    const pool = this.pool;
    const queries = [
      `CREATE TABLE IF NOT EXISTS Usuarios (
        id VARCHAR(64) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL DEFAULT '',
        email VARCHAR(255) NOT NULL DEFAULT '',
        telefono VARCHAR(50) DEFAULT '',
        direccion TEXT,
        password VARCHAR(255) DEFAULT '',
        googleId VARCHAR(255) DEFAULT '',
        avatar TEXT,
        rol VARCHAR(50) DEFAULT 'cliente',
        activo TINYINT(1) DEFAULT 1,
        fechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
        resetToken VARCHAR(255) DEFAULT '',
        resetTokenExpiresAt VARCHAR(40) DEFAULT '',
        comercioId VARCHAR(64) DEFAULT '',
        disponible TINYINT(1) DEFAULT 1,
        usuario VARCHAR(60) DEFAULT '',
        telefonoVerificado TINYINT(1) DEFAULT 0,
        codigoSms VARCHAR(10) DEFAULT '',
        codigoSmsExpiracion VARCHAR(40) DEFAULT '',
        codigoSmsReintentos INT DEFAULT 0,
        ultimoSmsEnviado VARCHAR(40) DEFAULT '',
        codigoSmsTelefono VARCHAR(20) DEFAULT '',
        calificacionPromedio DECIMAL(3,2) DEFAULT 0.00,
        totalCalificaciones INT DEFAULT 0,
        fcmToken TEXT,
        refreshToken VARCHAR(500) DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS Comercios (
        id VARCHAR(64) PRIMARY KEY,
        nombreNegocio VARCHAR(255) NOT NULL DEFAULT '',
        nombrePropietario VARCHAR(255) DEFAULT '',
        telefono VARCHAR(50) DEFAULT '',
        direccion TEXT,
        horarios VARCHAR(255) DEFAULT '',
        categoria VARCHAR(100) DEFAULT '',
        redesSociales TEXT,
        descripcion TEXT,
        logo TEXT,
        fachada TEXT,
        fotografias TEXT,
        productosPrincipales TEXT,
        estado VARCHAR(50) DEFAULT 'aprobado',
        activo TINYINT(1) DEFAULT 1,
        fechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
        calificacionPromedio DECIMAL(3,2) DEFAULT 0.00,
        totalCalificaciones INT DEFAULT 0,
        costoEnvio DECIMAL(12,2) DEFAULT 0.00,
        tiempoEstimado VARCHAR(50) DEFAULT '',
        rangoPrecio VARCHAR(50) DEFAULT '',
        cobraEmpaque VARCHAR(5) DEFAULT 'no',
        tipoEmpaque VARCHAR(20) DEFAULT 'pedido',
        valorEmpaque VARCHAR(20) DEFAULT '',
        allowedIps TEXT,
        cartaImagen LONGTEXT,
        ciudad VARCHAR(50) DEFAULT 'palermo',
        dominical VARCHAR(5) DEFAULT 'false',
        comision DECIMAL(5,2) DEFAULT 10
      )`,
      `CREATE TABLE IF NOT EXISTS Productos (
        id VARCHAR(64) PRIMARY KEY,
        comercioId VARCHAR(64) NOT NULL DEFAULT '',
        nombre VARCHAR(255) NOT NULL DEFAULT '',
        descripcion TEXT,
        precio DECIMAL(12,2) DEFAULT 0,
        categoria VARCHAR(100) DEFAULT '',
        subcategoriaId VARCHAR(64) DEFAULT '',
        imagen TEXT,
        tallas TEXT,
        colores TEXT,
        derechos VARCHAR(5) DEFAULT 'false',
        menuDia VARCHAR(5) DEFAULT 'false',
        menuFecha VARCHAR(20) DEFAULT '',
        activo TINYINT(1) DEFAULT 1,
        destacado TINYINT(1) DEFAULT 0,
        pedidosCount INT DEFAULT 0,
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS Categorias (
        id VARCHAR(64) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL DEFAULT '',
        descripcion TEXT,
        icono VARCHAR(255) DEFAULT '',
        grupo VARCHAR(20) DEFAULT 'otros',
        activo TINYINT(1) DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS Subcategorias (
        id VARCHAR(64) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL DEFAULT '',
        categoriaId VARCHAR(64) NOT NULL DEFAULT '',
        descripcion TEXT,
        activo TINYINT(1) DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS Pedidos (
        id VARCHAR(64) PRIMARY KEY,
        clienteId VARCHAR(64) NOT NULL DEFAULT '',
        clienteNombre VARCHAR(255) DEFAULT '',
        comercioId VARCHAR(64) NOT NULL DEFAULT '',
        productos JSON,
        direccionEntrega TEXT,
        notas TEXT,
        total DECIMAL(12,2) DEFAULT 0,
        subtotal DECIMAL(12,2) DEFAULT 0,
        descuento DECIMAL(12,2) DEFAULT 0,
        codigoCupon VARCHAR(100) DEFAULT '',
        recargo VARCHAR(20) DEFAULT '0',
        fechaProgramada DATETIME,
        metodoPago VARCHAR(50) DEFAULT 'enlace',
        estado VARCHAR(50) DEFAULT 'pendiente',
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fechaEntrega DATETIME,
        pagoEstado VARCHAR(50) DEFAULT 'pendiente',
        domiciliarioId VARCHAR(64) DEFAULT '',
        costoEmpaque VARCHAR(20) DEFAULT '0',
        tipoEmpaque VARCHAR(20) DEFAULT '',
        lat VARCHAR(40) DEFAULT '',
        lng VARCHAR(40) DEFAULT '',
        costoDomicilio VARCHAR(20) DEFAULT '0',
        domiciliarioLat VARCHAR(40) DEFAULT '',
        domiciliarioLng VARCHAR(40) DEFAULT '',
        ultimaUbicacion VARCHAR(40) DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS Calificaciones (
        id VARCHAR(64) PRIMARY KEY,
        comercioId VARCHAR(64) NOT NULL DEFAULT '',
        pedidoId VARCHAR(64) NOT NULL DEFAULT '',
        domiciliarioId VARCHAR(64) DEFAULT '',
        clienteId VARCHAR(64) DEFAULT '',
        clienteNombre VARCHAR(255) DEFAULT '',
        calificacionGeneral DECIMAL(3,2) DEFAULT 0.00,
        calidadProductos DECIMAL(3,2) DEFAULT 0.00,
        tiempoPreparacion DECIMAL(3,2) DEFAULT 0.00,
        tiempoEntrega DECIMAL(3,2) DEFAULT 0.00,
        atencionComercio DECIMAL(3,2) DEFAULT 0.00,
        atencionDomiciliario DECIMAL(3,2) DEFAULT 0.00,
        comentario TEXT,
        visible TINYINT(1) DEFAULT 1,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS Notificaciones (
        id VARCHAR(64) PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL DEFAULT '',
        mensaje TEXT,
        tipo VARCHAR(50) DEFAULT 'general',
        dirigidoA VARCHAR(50) DEFAULT 'todos',
        destinatarioId VARCHAR(64) DEFAULT '',
        leida TINYINT(1) DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        enviadoFirebase TINYINT(1) DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS Cupones (
        id VARCHAR(64) PRIMARY KEY,
        codigo VARCHAR(100) NOT NULL DEFAULT '',
        tipo VARCHAR(50) NOT NULL DEFAULT '',
        valor DECIMAL(12,2) DEFAULT 0,
        compraMinima DECIMAL(12,2) DEFAULT 0,
        fechaInicio DATETIME,
        fechaVencimiento DATETIME,
        limiteUsos INT DEFAULT 0,
        usosActuales INT DEFAULT 0,
        exclusivoUsuario VARCHAR(64) DEFAULT '',
        soloNuevos TINYINT(1) DEFAULT 0,
        activo TINYINT(1) DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS Pagos (
        id VARCHAR(64) PRIMARY KEY,
        pedidoId VARCHAR(64) NOT NULL DEFAULT '',
        valor DECIMAL(12,2) DEFAULT 0,
        clienteId VARCHAR(64) DEFAULT '',
        estado VARCHAR(50) DEFAULT 'pendiente',
        referencia VARCHAR(100) DEFAULT '',
        metodo VARCHAR(50) DEFAULT 'enlace',
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fechaPago DATETIME,
        wompiTransactionId VARCHAR(100) DEFAULT '',
        wompiStatus VARCHAR(20) DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS Promociones (
        id VARCHAR(64) PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL DEFAULT '',
        descripcion TEXT,
        tipo VARCHAR(50) DEFAULT '',
        valor VARCHAR(255) DEFAULT '',
        comercioId VARCHAR(64) DEFAULT '',
        imagen TEXT,
        fechaVencimiento DATETIME,
        activo TINYINT(1) DEFAULT 1,
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        link TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS Anuncios (
        id VARCHAR(64) PRIMARY KEY,
        comercioId VARCHAR(64) DEFAULT '',
        titulo VARCHAR(255) NOT NULL DEFAULT '',
        imagen TEXT,
        valor DECIMAL(12,2) DEFAULT 20000,
        dias INT DEFAULT 5,
        estado VARCHAR(50) DEFAULT 'pendiente',
        referencia VARCHAR(100) DEFAULT '',
        wompiTransactionId VARCHAR(100) DEFAULT '',
        wompiStatus VARCHAR(20) DEFAULT '',
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fechaPago DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS Servicios (
        id VARCHAR(64) PRIMARY KEY,
        tipoPersona VARCHAR(50) DEFAULT '',
        nombre VARCHAR(255) NOT NULL DEFAULT '',
        servicio VARCHAR(255) DEFAULT '',
        telefono VARCHAR(50) DEFAULT '',
        whatsapp VARCHAR(50) DEFAULT '',
        descripcion TEXT,
        precio DECIMAL(12,2) DEFAULT 0,
        categoria VARCHAR(100) DEFAULT '',
        estado VARCHAR(50) DEFAULT 'pendiente',
        activo TINYINT(1) DEFAULT 1,
        fechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS Solicitudes (
        id VARCHAR(64) PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL DEFAULT '',
        usuarioId VARCHAR(64) DEFAULT '',
        usuarioNombre VARCHAR(255) DEFAULT '',
        datos JSON,
        estado VARCHAR(50) DEFAULT 'pendiente',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS Mandados (
        id VARCHAR(64) PRIMARY KEY,
        clienteId VARCHAR(64) DEFAULT '',
        clienteNombre VARCHAR(255) DEFAULT '',
        clienteTelefono VARCHAR(50) DEFAULT '',
        direccion TEXT,
        enlace VARCHAR(500) DEFAULT '',
        lat VARCHAR(40) DEFAULT '',
        lng VARCHAR(40) DEFAULT '',
        estado VARCHAR(50) DEFAULT 'solicitado',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    for (const sql of queries) {
      await pool.execute(sql);
    }
    console.log('[DB] Tablas inicializadas');
  }

  async _migrateSchema() {
    const pool = this.pool;
    const migrations = [
      // ---- USUARIOS ----
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS refreshToken VARCHAR(500) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS usuario VARCHAR(60) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS telefonoVerificado TINYINT(1) DEFAULT 0`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS codigoSms VARCHAR(10) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS codigoSmsExpiracion VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS codigoSmsReintentos INT DEFAULT 0`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS ultimoSmsEnviado VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS codigoSmsTelefono VARCHAR(20) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS terminosVersion VARCHAR(20) DEFAULT ''`,
      `ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS terminosFecha VARCHAR(40) DEFAULT ''`,
      `UPDATE Usuarios SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Usuarios SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      `UPDATE Usuarios SET disponible = 1 WHERE BINARY disponible = 'true'`,
      `UPDATE Usuarios SET disponible = 0 WHERE BINARY disponible = 'false' OR disponible IS NULL OR BINARY disponible = ''`,
      `UPDATE Usuarios SET calificacionPromedio = 0 WHERE calificacionPromedio = '' OR calificacionPromedio IS NULL`,
      `UPDATE Usuarios SET totalCalificaciones = 0 WHERE totalCalificaciones = '' OR totalCalificaciones IS NULL`,
      // ---- COMERCIOS ----
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS cobraEmpaque VARCHAR(5) DEFAULT 'no'`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS tipoEmpaque VARCHAR(20) DEFAULT 'pedido'`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS valorEmpaque VARCHAR(20) DEFAULT ''`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS allowedIps TEXT`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS cartaImagen LONGTEXT`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS ciudad VARCHAR(50) DEFAULT 'palermo'`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS fachada TEXT`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS dominical VARCHAR(5) DEFAULT 'false'`,
      `ALTER TABLE Comercios ADD COLUMN IF NOT EXISTS comision DECIMAL(5,2) DEFAULT 10`,
      `UPDATE Comercios SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Comercios SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      `UPDATE Comercios SET calificacionPromedio = 0 WHERE calificacionPromedio = '' OR calificacionPromedio IS NULL`,
      `UPDATE Comercios SET totalCalificaciones = 0 WHERE totalCalificaciones = '' OR totalCalificaciones IS NULL`,
      `UPDATE Comercios SET costoEnvio = 0 WHERE costoEnvio = '' OR costoEnvio IS NULL`,
      // ---- PRODUCTOS ----
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) DEFAULT ''`,
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS subcategoriaId VARCHAR(64) DEFAULT ''`,
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS tallas TEXT`,
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS colores TEXT`,
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS derechos VARCHAR(5) DEFAULT 'false'`,
      `UPDATE Productos SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Productos SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      `UPDATE Productos SET destacado = 1 WHERE BINARY destacado = 'true'`,
      `UPDATE Productos SET destacado = 0 WHERE BINARY destacado = 'false' OR destacado IS NULL OR BINARY destacado = ''`,
      // ---- CATEGORIAS ----
      `ALTER TABLE Categorias ADD COLUMN IF NOT EXISTS grupo VARCHAR(20) DEFAULT 'otros'`,
      `UPDATE Categorias SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Categorias SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      // ---- SUBCATEGORIAS ----
      `UPDATE Subcategorias SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Subcategorias SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      // ---- PEDIDOS ----
      `UPDATE Pedidos SET productos = '[]' WHERE productos IS NULL OR productos = ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS lat VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS lng VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS costoDomicilio VARCHAR(20) DEFAULT '0'`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS domiciliarioLat VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS domiciliarioLng VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS ultimaUbicacion VARCHAR(40) DEFAULT ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS descuento DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS codigoCupon VARCHAR(100) DEFAULT ''`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS recargo VARCHAR(20) DEFAULT '0'`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS fechaProgramada DATETIME`,
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS menuDia VARCHAR(5) DEFAULT 'false'`,
      `ALTER TABLE Productos ADD COLUMN IF NOT EXISTS menuFecha VARCHAR(20) DEFAULT ''`,
      // ---- PAGOS ----
      `ALTER TABLE Pagos ADD COLUMN IF NOT EXISTS wompiTransactionId VARCHAR(100) DEFAULT ''`,
      `ALTER TABLE Pagos ADD COLUMN IF NOT EXISTS wompiStatus VARCHAR(20) DEFAULT ''`,
      // ---- NOTIFICACIONES ----
      `UPDATE Notificaciones SET leida = 1 WHERE BINARY leida = 'true'`,
      `UPDATE Notificaciones SET leida = 0 WHERE BINARY leida = 'false' OR leida IS NULL OR BINARY leida = ''`,
      `UPDATE Notificaciones SET enviadoFirebase = 1 WHERE BINARY enviadoFirebase = 'true'`,
      `UPDATE Notificaciones SET enviadoFirebase = 0 WHERE BINARY enviadoFirebase = 'false' OR enviadoFirebase IS NULL OR BINARY enviadoFirebase = ''`,
      // ---- CUPONES ----
      `UPDATE Cupones SET soloNuevos = 1 WHERE BINARY soloNuevos = 'true'`,
      `UPDATE Cupones SET soloNuevos = 0 WHERE BINARY soloNuevos = 'false' OR soloNuevos IS NULL OR BINARY soloNuevos = ''`,
      `UPDATE Cupones SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Cupones SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      // ---- PROMOCIONES ----
      `UPDATE Promociones SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Promociones SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      // ---- SERVICIOS ----
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS tipoPersona VARCHAR(50) DEFAULT ''`,
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS servicio VARCHAR(255) DEFAULT ''`,
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS telefono VARCHAR(50) DEFAULT ''`,
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50) DEFAULT ''`,
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'pendiente'`,
      `UPDATE Servicios SET activo = 1 WHERE BINARY activo = 'true'`,
      `UPDATE Servicios SET activo = 0 WHERE BINARY activo = 'false' OR activo IS NULL OR BINARY activo = ''`,
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS logo TEXT`,
      `ALTER TABLE Servicios ADD COLUMN IF NOT EXISTS imagen TEXT`,
      // ---- CALIFICACIONES ----
      `UPDATE Calificaciones SET visible = 1 WHERE BINARY visible = 'true'`,
      `UPDATE Calificaciones SET visible = 0 WHERE BINARY visible = 'false' OR visible IS NULL OR BINARY visible = ''`,
      // ---- SOLICITUDES ----
      `UPDATE Solicitudes SET datos = '{}' WHERE datos IS NULL OR datos = ''`,
      // ---- MANDADOS ----
      `ALTER TABLE Mandados ADD COLUMN IF NOT EXISTS domiciliarioId VARCHAR(64) DEFAULT ''`,
      `ALTER TABLE Mandados ADD COLUMN IF NOT EXISTS domiciliarioNombre VARCHAR(255) DEFAULT ''`,
      `ALTER TABLE Mandados ADD COLUMN IF NOT EXISTS fechaEntrega DATETIME`,
      // ---- DLQ ----
      `CREATE TABLE IF NOT EXISTS TrabajosFallidos (
        id VARCHAR(64) PRIMARY KEY,
        tipo VARCHAR(100) NOT NULL DEFAULT '',
        payload TEXT,
        error VARCHAR(500) DEFAULT '',
        intentos INT DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_trabajos_tipo ON TrabajosFallidos(tipo)`,
    ];
    try {
      const [cols] = await pool.execute(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'resetTokenExpiresAt'`
      );
      if (Number(cols[0].c) === 0) {
        await pool.execute(`ALTER TABLE Usuarios ADD COLUMN resetTokenExpiresAt VARCHAR(40) DEFAULT ''`);
      }
    } catch {}
    for (const sql of migrations) {
      try { await pool.execute(sql); } catch {}
    }
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_usuarios_email ON Usuarios(email)`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON Usuarios(rol)`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_comercioId ON Usuarios(comercioId)`,
      `CREATE INDEX IF NOT EXISTS idx_comercios_categoria ON Comercios(categoria)`,
      `CREATE INDEX IF NOT EXISTS idx_comercios_estado ON Comercios(estado)`,
      `CREATE INDEX IF NOT EXISTS idx_comercios_ciudad ON Comercios(ciudad)`,
      `CREATE INDEX IF NOT EXISTS idx_productos_comercioId ON Productos(comercioId)`,
      `CREATE INDEX IF NOT EXISTS idx_productos_categoria ON Productos(categoria)`,
      `CREATE INDEX IF NOT EXISTS idx_productos_subcategoriaId ON Productos(subcategoriaId)`,

      `CREATE INDEX IF NOT EXISTS idx_subcategorias_categoriaId ON Subcategorias(categoriaId)`,
      `CREATE INDEX IF NOT EXISTS idx_pedidos_clienteId ON Pedidos(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_pedidos_comercioId ON Pedidos(comercioId)`,
      `CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON Pedidos(estado)`,
      `CREATE INDEX IF NOT EXISTS idx_pedidos_fechaCreacion ON Pedidos(fechaCreacion)`,
      `CREATE INDEX IF NOT EXISTS idx_pedidos_domiciliarioId ON Pedidos(domiciliarioId)`,
      `CREATE INDEX IF NOT EXISTS idx_calificaciones_comercioId ON Calificaciones(comercioId)`,
      `CREATE INDEX IF NOT EXISTS idx_calificaciones_pedidoId ON Calificaciones(pedidoId)`,
      `CREATE INDEX IF NOT EXISTS idx_calificaciones_pedidoId ON Calificaciones(pedidoId)`,
      `CREATE INDEX IF NOT EXISTS idx_calificaciones_clienteId ON Calificaciones(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_calificaciones_domiciliarioId ON Calificaciones(domiciliarioId)`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatarioId ON Notificaciones(destinatarioId)`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_dirigidoA ON Notificaciones(dirigidoA)`,
      `CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON Cupones(codigo)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_pedidoId ON Pagos(pedidoId)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_referencia ON Pagos(referencia)`,
      `CREATE INDEX IF NOT EXISTS idx_promociones_comercioId ON Promociones(comercioId)`,
      `CREATE INDEX IF NOT EXISTS idx_solicitudes_usuarioId ON Solicitudes(usuarioId)`,
      `CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo ON Solicitudes(tipo)`,
      `CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON Solicitudes(estado)`,
      `CREATE INDEX IF NOT EXISTS idx_anuncios_referencia ON Anuncios(referencia)`,
      `CREATE INDEX IF NOT EXISTS idx_anuncios_comercioId ON Anuncios(comercioId)`,
      `CREATE INDEX IF NOT EXISTS idx_anuncios_estado ON Anuncios(estado)`,
      `CREATE TABLE IF NOT EXISTS Verificaciones (
        id VARCHAR(64) PRIMARY KEY,
        canal VARCHAR(20) NOT NULL DEFAULT '',
        destino VARCHAR(255) NOT NULL DEFAULT '',
        codigoHash VARCHAR(255) DEFAULT '',
        verificado TINYINT(1) DEFAULT 0,
        intentos INT DEFAULT 0,
        expira DATETIME,
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_verif_canal_destino ON Verificaciones(canal, destino)`,
      `CREATE TABLE IF NOT EXISTS Invitaciones (
        id VARCHAR(64) PRIMARY KEY,
        comercioId VARCHAR(64) NOT NULL DEFAULT '',
        email VARCHAR(255) NOT NULL DEFAULT '',
        tokenHash VARCHAR(255) NOT NULL DEFAULT '',
        expira DATETIME,
        usado TINYINT(1) DEFAULT 0,
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_invit_token ON Invitaciones(tokenHash)`,
    ];
    for (const sql of indexes) {
      try { await pool.execute(sql); } catch {}
    }
    // Convert VARCHAR columns to proper types after data cleanup
    const typeMigrations = [
      `ALTER TABLE Usuarios MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Usuarios MODIFY COLUMN disponible TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Usuarios MODIFY COLUMN calificacionPromedio DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Usuarios MODIFY COLUMN totalCalificaciones INT DEFAULT 0`,
      `ALTER TABLE Comercios MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Comercios MODIFY COLUMN calificacionPromedio DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Comercios MODIFY COLUMN totalCalificaciones INT DEFAULT 0`,
      `ALTER TABLE Comercios MODIFY COLUMN costoEnvio DECIMAL(12,2) DEFAULT 0.00`,
      `ALTER TABLE Productos MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Productos MODIFY COLUMN destacado TINYINT(1) DEFAULT 0`,
      `ALTER TABLE Categorias MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Notificaciones MODIFY COLUMN leida TINYINT(1) DEFAULT 0`,
      `ALTER TABLE Notificaciones MODIFY COLUMN enviadoFirebase TINYINT(1) DEFAULT 0`,
      `ALTER TABLE Cupones MODIFY COLUMN soloNuevos TINYINT(1) DEFAULT 0`,
      `ALTER TABLE Cupones MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Promociones MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Servicios MODIFY COLUMN activo TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Calificaciones MODIFY COLUMN visible TINYINT(1) DEFAULT 1`,
      `ALTER TABLE Calificaciones MODIFY COLUMN calificacionGeneral DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Calificaciones MODIFY COLUMN calidadProductos DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Calificaciones MODIFY COLUMN tiempoPreparacion DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Calificaciones MODIFY COLUMN tiempoEntrega DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Calificaciones MODIFY COLUMN atencionComercio DECIMAL(3,2) DEFAULT 0.00`,
      `ALTER TABLE Calificaciones MODIFY COLUMN atencionDomiciliario DECIMAL(3,2) DEFAULT 0.00`,
    ];
    for (const sql of typeMigrations) {
      try { await pool.execute(sql); } catch {}
    }
    // Convert TEXT to JSON where applicable
    const jsonMigrations = [
      `ALTER TABLE Pedidos MODIFY COLUMN productos JSON`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS costoEmpaque VARCHAR(20) DEFAULT '0'`,
      `ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS tipoEmpaque VARCHAR(20) DEFAULT ''`,
      `ALTER TABLE Solicitudes MODIFY COLUMN datos JSON`,
    ];
    for (const sql of jsonMigrations) {
      try { await pool.execute(sql); } catch {}
    }
    console.log('[DB] Migración de esquema completada');
  }

  _toLegacyFormat(row) {
    if (!row) return row;
    const boolFields = ['activo', 'destacado', 'visible', 'leida', 'enviadoFirebase', 'soloNuevos', 'disponible', 'verificado', 'usado'];
    for (const field of boolFields) {
      if (row[field] !== undefined && row[field] !== null) {
        row[field] = row[field] ? 'true' : 'false';
      }
    }
    const decimalFields = ['calificacionPromedio', 'totalCalificaciones'];
    for (const field of decimalFields) {
      if (row[field] !== undefined && row[field] !== null) {
        row[field] = String(row[field]);
      }
    }
    if (row.productos && typeof row.productos === 'object') {
      row.productos = JSON.stringify(row.productos);
    }
    if (row.datos && typeof row.datos === 'object') {
      row.datos = JSON.stringify(row.datos);
    }
    return row;
  }

  async findAll(table) {
    assertIdent(table, 'tabla');
    const pool = await this._getPool();
    const [rows] = await pool.execute(`SELECT * FROM \`${table}\``);
    return rows.map(r => this._toLegacyFormat(r));
  }

  async findById(table, id) {
    assertIdent(table, 'tabla');
    const pool = await this._getPool();
    const [rows] = await pool.execute(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    return this._toLegacyFormat(rows[0] || null);
  }

  // Un solo registro por campo (usa índices, LIMIT 1): ideal para login por email
  async findOne(table, field, value) {
    assertIdent(table, 'tabla');
    assertIdent(field, 'columna');
    const pool = await this._getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM \`${table}\` WHERE \`${field}\` = ? LIMIT 1`,
      [value]
    );
    return this._toLegacyFormat(rows[0] || null);
  }

  async findWhere(table, field, value) {
    assertIdent(table, 'tabla');
    assertIdent(field, 'columna');
    const pool = await this._getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM \`${table}\` WHERE \`${field}\` = ?`,
      [value]
    );
    return rows.map(r => this._toLegacyFormat(r));
  }

  async findWhereIn(table, field, values) {
    if (!values || values.length === 0) return [];
    assertIdent(table, 'tabla');
    assertIdent(field, 'columna');
    const pool = await this._getPool();
    const placeholders = values.map(() => '?').join(', ');
    const [rows] = await pool.execute(
      `SELECT * FROM \`${table}\` WHERE \`${field}\` IN (${placeholders})`,
      values
    );
    return rows.map(r => this._toLegacyFormat(r));
  }

  async findWithFilters(table, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return this.findAll(table);
    }
    assertIdent(table, 'tabla');
    const pool = await this._getPool();
    const conditions = [];
    const values = [];
    for (const [field, value] of Object.entries(filters)) {
      assertIdent(field, 'columna');
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`\`${field}\` IN (${placeholders})`);
        values.push(...value);
      } else {
        conditions.push(`\`${field}\` = ?`);
        values.push(value);
      }
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(`SELECT * FROM \`${table}\` ${whereClause}`, values);
    return rows.map(r => this._toLegacyFormat(r));
  }

  _toMySQLValue(table, data) {
    const boolFields = ['activo', 'destacado', 'visible', 'leida', 'enviadoFirebase', 'soloNuevos', 'disponible', 'verificado', 'usado'];
    const out = { ...data };
    for (const field of boolFields) {
      if (out[field] !== undefined && out[field] !== null) {
        out[field] = out[field] === true || out[field] === 'true' || out[field] === 1 || out[field] === '1' ? 1 : 0;
      }
    }
    for (const key of Object.keys(out)) {
      const iso = this._toMySQLDate(out[key]);
      if (iso !== out[key]) out[key] = iso;
    }
    return out;
  }

  // MySQL (modo estricto) no acepta el formato ISO 8601 con "T...Z" en columnas
  // DATETIME. Los controladores usan formatDate() (= toISOString()), así que aquí
  // se normaliza a "YYYY-MM-DD HH:mm:ss" (UTC) antes de escribir.
  _toMySQLDate(value) {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? value : value.toISOString().slice(0, 19).replace('T', ' ');
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toISOString().slice(0, 19).replace('T', ' ');
    }
    return value;
  }

  // Columnas reales por tabla (cacheadas). Sirve para que un payload con
  // campos extra no reviente el INSERT/UPDATE con "Unknown column": se
  // descartan en lugar de romper la operación completa.
  async _knownColumns(pool, table) {
    if (!this._cols) this._cols = new Map();
    if (this._cols.has(table)) return this._cols.get(table);
    try {
      const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
      const set = new Set(rows.map(r => r.Field));
      this._cols.set(table, set);
      return set;
    } catch {
      return null;
    }
  }

  async create(table, data) {
    assertIdent(table, 'tabla');
    const pool = await this._getPool();
    const clean = this._toMySQLValue(table, data);
    const known = await this._knownColumns(pool, table);
    const keys = known ? Object.keys(clean).filter(k => known.has(k)) : Object.keys(clean);
    if (keys.length === 0) throw new Error(`No hay campos válidos para crear en ${table}`);
    keys.forEach(k => assertIdent(k, 'columna'));
    const values = keys.map(k => clean[k]);
    const placeholders = keys.map(() => '?').join(', ');
    const columns = keys.map(k => `\`${k}\``).join(', ');
    await pool.execute(
      `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`,
      values
    );
    return { success: true, id: data.id };
  }

  async update(table, id, data) {
    assertIdent(table, 'tabla');
    const pool = await this._getPool();
    const clean = this._toMySQLValue(table, data);
    const known = await this._knownColumns(pool, table);
    const keys = known ? Object.keys(clean).filter(k => known.has(k)) : Object.keys(clean);
    if (keys.length === 0) throw new Error('No hay campos para actualizar');
    keys.forEach(k => assertIdent(k, 'columna'));
    const values = keys.map(k => clean[k]);
    const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
    const [result] = await pool.execute(
      `UPDATE \`${table}\` SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new Error('Registro no encontrado');
    return { success: true };
  }

  async delete(table, id) {
    assertIdent(table, 'tabla');
    const pool = await this._getPool();
    const [result] = await pool.execute(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new Error('Registro no encontrado');
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

module.exports = MySQLRepository;