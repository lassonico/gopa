const { z } = require('zod');

const registerSchema = z.object({
  nombre: z.string().min(2).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Solo letras y espacios'),
  email: z.string().email().max(255).toLowerCase(),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/, 'Teléfono inválido').optional().or(z.literal('')),
  password: z.string().min(12).max(128).regex(/[A-Z]/, 'Debe tener mayúscula').regex(/[a-z]/, 'Debe tener minúscula').regex(/[0-9]/, 'Debe tener número').regex(/[^A-Za-z0-9]/, 'Debe tener carácter especial'),
  direccion: z.string().max(200).optional().or(z.literal('')),
  mayorEdad: z.boolean().refine(v => v === true, 'Debes confirmar que eres mayor de 18 años'),
});

const loginSchema = z.object({
  email: z.string().min(3, 'Mínimo 3 caracteres').max(255).toLowerCase(),
  password: z.string().min(1).max(128),
});

const googleLoginSchema = z.object({
    credential: z.string().min(100).optional(),
    access_token: z.string().min(20).max(2048).optional(),
  }).refine((data) => data.credential || data.access_token, {
    message: 'Credencial de Google requerida',
  });

const recoverPasswordSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(64),
  newPassword: z.string().min(12).max(128).regex(/[A-Z]/, 'Debe tener mayúscula').regex(/[a-z]/, 'Debe tener minúscula').regex(/[0-9]/, 'Debe tener número').regex(/[^A-Za-z0-9]/, 'Debe tener carácter especial'),
});

const updateFcmTokenSchema = z.object({
  fcmToken: z.string().min(100).max(500),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
});

const createUsuarioSchema = z.object({
  nombre: z.string().min(2).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
  email: z.string().email().max(255).toLowerCase(),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/).optional().or(z.literal('')),
  password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  direccion: z.string().max(200).optional().or(z.literal('')),
  rol: z.enum(['cliente', 'comercio', 'domiciliario', 'admin']),
  comercioId: z.string().uuid().optional().nullable(),
});

const updateUsuarioSchema = z.object({
  nombre: z.string().min(2).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).optional(),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/).optional().or(z.literal('')),
  direccion: z.string().max(200).optional().or(z.literal('')),
  rol: z.enum(['cliente', 'comercio', 'domiciliario', 'admin']).optional(),
  activo: z.enum(['true', 'false']).optional(),
  comercioId: z.string().uuid().optional().nullable(),
});

const listaFlexible = z.union([
  z.array(z.string().max(30)).max(20),
  z.string().max(1000),
]).optional().transform(v => {
  if (v === undefined) return undefined;
  const arr = Array.isArray(v) ? v : String(v).split(',');
  return arr.map(s => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 20);
});

const productoSolicitudSchema = z.object({
  nombre: z.string().min(2, 'Nombre del producto muy corto').max(100, 'Máximo 100 caracteres').transform(s => String(s).trim().slice(0, 100)),
  descripcion: z.string().max(3000, 'Descripción demasiado larga').optional().or(z.literal('')).transform(v => v ? String(v).trim().slice(0, 300) : ''),
  precio: z.union([
    z.number().min(0, 'Precio inválido').max(99999999, 'Precio demasiado alto'),
    z.string().regex(/^\d*\.?\d+$/, 'Precio inválido')
  ]).transform(v => Number(v) || 0),
  categoria: z.string().max(100).optional().or(z.literal('')).transform(v => v ? String(v).trim().slice(0, 100) : ''),
  imagen: z.string().url('Imagen inválida').max(2000).optional().or(z.literal('')),
  emoji: z.string().max(10).optional().or(z.literal('')),
  tallas: listaFlexible,
  colores: listaFlexible,
});

const solicitarComercioSchema = z.object({
  nombreNegocio: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres').regex(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ&$#.\-\s]+$/, 'Caracteres no permitidos. Solo letras, números y .-#$&'),
  nombrePropietario: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Solo letras y espacios'),
  telefono: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Teléfono inválido. Usa solo números, espacios o guiones'),
  direccion: z.string().min(5, 'Mínimo 5 caracteres').max(200, 'Máximo 200 caracteres'),
  horarios: z.string().max(500).optional().or(z.literal('')),
  categoria: z.string().max(100).optional().or(z.literal('')),
  redesSociales: z.string().max(300).optional().or(z.literal(''))
    .refine(v => !/https?:\/\/|www\./i.test(v || ''), 'Sin enlaces: usa @usuario'),
  descripcion: z.string().max(150, 'Máximo 150 caracteres').optional().or(z.literal('')),
  dominical: z.enum(['true', 'false']).optional(),
  productosPrincipales: z.string().max(500).optional().or(z.literal('')),
  logo: z.string().max(500).optional().or(z.literal('')),
  fotografias: z.string().max(10000000).optional().or(z.literal('')),
  cobraEmpaque: z.enum(['no', 'si']).optional(),
  tipoEmpaque: z.enum(['pedido', 'empaque']).optional(),
  valorEmpaque: z.string().regex(/^\d+([.,]\d+)?$/, 'Valor inválido').max(20).optional().or(z.literal('')).transform(v => v ? String(v).trim().replace(',', '.') : ''),
  cartaImagen: z.string().max(15000000).optional().or(z.literal('')),
  logo: z.string().url('Logo inválido').max(2000).optional().or(z.literal('')),
  fachada: z.string().url('Fachada inválida').max(2000).optional().or(z.literal('')),
  productos: z.array(productoSolicitudSchema).max(100).optional(),
  ciudad: z.enum(['palermo', 'neiva']).optional().default('palermo'),
  declaraDerechos: z.boolean().optional(),
  email: z.string().email('Correo de contacto inválido').max(255).toLowerCase().optional().or(z.literal('')),
  pruebaSms: z.string().min(10, 'Verificación SMS requerida').optional().or(z.literal('')),
  cuentaEmail: z.string().email().max(255).toLowerCase().optional().or(z.literal('')),
  cuentaPassword: z.string().max(128).regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/, 'Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo').optional().or(z.literal('')),
});

const registroServicioSchema = z.object({
  tipoPersona: z.enum(['natural', 'juridica']),
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').regex(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-\.]+$/, 'Caracteres no permitidos. Solo letras, números, espacios, guiones y puntos'),
  servicio: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  telefono: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Teléfono inválido. Usa solo números, espacios o guiones'),
  logo: z.string().max(2000).optional().or(z.literal('')),
  imagen: z.string().max(2000).optional().or(z.literal('')),
});

const solicitarDomiciliarioSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\.]+$/, 'Caracteres no permitidos. Solo letras, espacios, guiones y puntos'),
  tipoDocumento: z.enum(['Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte']),
  numeroDocumento: z.string().regex(/^\d{5,15}$/, 'Número de documento inválido (solo números, entre 5 y 15 dígitos)'),
  telefono: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Teléfono inválido. Usa solo números, espacios o guiones'),
  email: z.string().email('Ingresa un correo electrónico válido').max(255).toLowerCase(),
  tipoVehiculo: z.enum(['Bicicleta', 'Moto']),
});

const createComercioSchema = z.object({
  nombre: z.string().min(3).max(150).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.]+$/),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  direccion: z.string().min(5).max(200),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/),
  email: z.string().email().max(255).toLowerCase(),
  categoriaId: z.string().uuid().optional(),
  horarioApertura: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  horarioCierre: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  tiempoEntregaPromedio: z.number().int().min(5).max(180).optional(),
  costoEnvio: z.number().min(0).max(99999.99).optional(),
  pedidoMinimo: z.number().min(0).max(99999.99).optional(),
  activo: z.enum(['true', 'false']).optional().default('true'),
});

const updateComercioSchema = z.object({
  nombre: z.string().min(3).max(150).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.]+$/).optional(),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  direccion: z.string().min(5).max(200).optional(),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/).optional().or(z.literal('')),
  email: z.string().email().max(255).toLowerCase().optional(),
  password: z.string().min(6).max(200).optional().or(z.literal('')),
  categoriaId: z.string().uuid().optional().nullable(),
  horarioApertura: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  horarioCierre: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  tiempoEntregaPromedio: z.number().int().min(5).max(180).optional(),
  costoEnvio: z.number().min(0).max(99999.99).optional().or(z.literal('')),
  pedidoMinimo: z.number().min(0).max(99999.99).optional().or(z.literal('')),
  activo: z.enum(['true', 'false']).optional(),
  allowedIps: z.array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^(\d{1,3}\.){3}\*$|^(\d{1,3}\.){2}\*\.\*$|^(\d{1,3}\.)\*\.\*\.\*$/)).optional(),
  cobraEmpaque: z.enum(['no', 'si']).optional(),
  tipoEmpaque: z.enum(['pedido', 'empaque']).optional(),
  valorEmpaque: z.string().regex(/^\d+([.,]\d+)?$/, 'Valor inválido').max(20).optional().or(z.literal('')).transform(v => v ? String(v).trim().replace(',', '.') : ''),
  comision: z.number().min(0).max(100).optional().or(z.literal('')),
  ciudad: z.enum(['palermo', 'neiva']).optional(),
});

const createProductoSchema = z.object({
  comercioId: z.string().uuid(),
  categoriaId: z.string().uuid(),
  nombre: z.string().min(3).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.\,\&]+$/),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  precio: z.number().min(0.01).max(99999.99),
  precioOferta: z.number().min(0.01).max(99999.99).optional().nullable(),
  imagen: z.string().url().optional().or(z.literal('')),
  disponible: z.enum(['true', 'false']).optional().default('true'),
  stock: z.number().int().min(0).max(99999).optional().default(0),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const updateProductoSchema = z.object({
  nombre: z.string().min(3).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.\,\&]+$/).optional(),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  precio: z.number().min(0.01).max(99999.99).optional(),
  precioOferta: z.number().min(0.01).max(99999.99).optional().nullable(),
  imagen: z.string().url().optional().or(z.literal('')),
  disponible: z.enum(['true', 'false']).optional(),
  stock: z.number().int().min(0).max(99999).optional(),
  categoriaId: z.string().uuid().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const createCategoriaSchema = z.object({
  nombre: z.string().min(3).max(50).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
  descripcion: z.string().max(300).optional().or(z.literal('')),
  imagen: z.string().url().optional().or(z.literal('')),
  orden: z.number().int().min(0).optional().default(0),
  activa: z.enum(['true', 'false']).optional().default('true'),
});

const updateCategoriaSchema = z.object({
  nombre: z.string().min(3).max(50).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).optional(),
  descripcion: z.string().max(300).optional().or(z.literal('')),
  imagen: z.string().url().optional().or(z.literal('')),
  orden: z.number().int().min(0).optional(),
  activa: z.enum(['true', 'false']).optional(),
});

const createPedidoSchema = z.object({
  comercioId: z.string().uuid(),
  productos: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: z.number().int().min(1).max(100),
    observaciones: z.string().max(200).optional().or(z.literal('')),
  })).min(1),
  direccionEntrega: z.string().min(5).max(200),
  referencia: z.string().max(200).optional().or(z.literal('')),
  metodoPago: z.enum(['efectivo', 'tarjeta', 'transferencia', 'pse', 'enlace']),
  notas: z.string().max(500).optional().or(z.literal('')),
});

const updatePedidoStatusSchema = z.object({
  estado: z.enum(['pendiente', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado']),
  domiciliarioId: z.string().uuid().optional().nullable(),
  motivoCancelacion: z.string().max(200).optional().or(z.literal('')),
});

const createCalificacionSchema = z.object({
  pedidoId: z.string().uuid(),
  puntuacion: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional().or(z.literal('')),
});

const createNotificacionSchema = z.object({
  userId: z.string().uuid(),
  titulo: z.string().min(3).max(100),
  mensaje: z.string().min(5).max(500),
  tipo: z.enum(['info', 'success', 'warning', 'error', 'pedido', 'promocion']),
  data: z.record(z.unknown()).optional(),
});

const createCuponSchema = z.object({
  codigo: z.string().min(4).max(20).regex(/^[A-Z0-9]+$/, 'Solo mayúsculas y números'),
  descripcion: z.string().min(10).max(200),
  tipoDescuento: z.enum(['porcentaje', 'monto_fijo']),
  valorDescuento: z.number().min(1),
  montoMinimo: z.number().min(0).optional(),
  usoMaximo: z.number().int().min(1).optional(),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
  comercioId: z.string().uuid().optional(),
});

const updateCuponSchema = z.object({
  descripcion: z.string().min(10).max(200).optional(),
  valorDescuento: z.number().min(1).optional(),
  montoMinimo: z.number().min(0).optional(),
  usoMaximo: z.number().int().min(1).optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
  activo: z.enum(['true', 'false']).optional(),
});

const createPagoSchema = z.object({
  pedidoId: z.string().uuid(),
  monto: z.number().min(0.01).max(999999.99),
  metodo: z.enum(['tarjeta', 'transferencia', 'efectivo', 'link_pago']),
  referencia: z.string().max(100).optional(),
});

const createDomiciliarioSchema = z.object({
  nombre: z.string().min(2).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
  email: z.string().email().max(255).toLowerCase(),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/),
  documento: z.string().min(6).max(20).regex(/^[0-9]+$/),
  vehiculo: z.enum(['moto', 'bici', 'carro', 'pie']),
  placa: z.string().max(10).optional(),
  zonaCobertura: z.array(z.string()).max(10).optional(),
});

const updateDomiciliarioSchema = z.object({
  nombre: z.string().min(2).max(100).regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).optional(),
  telefono: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/).optional(),
  vehiculo: z.enum(['moto', 'bici', 'carro', 'pie']).optional(),
  placa: z.string().max(10).optional(),
  zonaCobertura: z.array(z.string()).max(10).optional(),
  activo: z.enum(['true', 'false']).optional(),
});

const FIELD_LABELS = {
  nombre: 'Nombre', nombreNegocio: 'Nombre del negocio', nombrePropietario: 'Propietario',
  email: 'Correo', cuentaEmail: 'Correo del panel', cuentaPassword: 'Contraseña del panel',
  password: 'Contraseña', telefono: 'Teléfono', direccion: 'Dirección', horarios: 'Horarios',
  categoria: 'Categoría', descripcion: 'Descripción', precio: 'Precio', ciudad: 'Ciudad',
  numeroDocumento: 'Documento', tipoDocumento: 'Tipo de documento', tipoVehiculo: 'Vehículo',
  valorEmpaque: 'Valor del empaque', producto: 'Producto', productos: 'Productos',
};

const friendlyDetails = (errors) => {
  const shown = (errors || []).slice(0, 3);
  const parts = shown.map(e => {
    const last = String(e.path?.[e.path.length - 1] ?? '');
    const label = FIELD_LABELS[last] || last || 'Campo';
    // Mensajes internos de zod en inglés → genérico en español
    let msg = String(e.message || 'valor inválido');
    if (/^(Required|Invalid|Expected)/i.test(msg) || /expected/i.test(msg)) {
      msg = 'valor inválido';
    }
    return `${label}: ${msg}`.slice(0, 160);
  });
  const extra = (errors || []).length > 3 ? ` (+${errors.length - 3} más)` : '';
  return parts.join('; ') + extra;
};

const validate = (schema) => (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    req.validatedBody = data;
    next();
  } catch (error) {
    if (error.errors) {
      const raw = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      console.error(`[Validación 400] ${req.method} ${req.originalUrl} :: ${raw}`);
      return res.status(400).json({ error: 'Datos inválidos', details: friendlyDetails(error.errors) });
    }
    console.error(`[Validación 400] ${req.method} ${req.originalUrl} :: ${error.message}`);
    return res.status(400).json({ error: 'Datos inválidos' });
  }
};

module.exports = {
  validate,
  schemas: {
    register: registerSchema,
    login: loginSchema,
    googleLogin: googleLoginSchema,
    recoverPassword: recoverPasswordSchema,
    resetPassword: resetPasswordSchema,
    updateFcmToken: updateFcmTokenSchema,
    changePassword: changePasswordSchema,
    createUsuario: createUsuarioSchema,
    updateUsuario: updateUsuarioSchema,
    createComercio: createComercioSchema,
    solicitarComercio: solicitarComercioSchema,
    registroServicio: registroServicioSchema,
    solicitarDomiciliario: solicitarDomiciliarioSchema,
    updateComercio: updateComercioSchema,
    createProducto: createProductoSchema,
    updateProducto: updateProductoSchema,
    createCategoria: createCategoriaSchema,
    updateCategoria: updateCategoriaSchema,
    createPedido: createPedidoSchema,
    updatePedidoStatus: updatePedidoStatusSchema,
    createCalificacion: createCalificacionSchema,
    createNotificacion: createNotificacionSchema,
    createCupon: createCuponSchema,
    updateCupon: updateCuponSchema,
    createPago: createPagoSchema,
    createDomiciliario: createDomiciliarioSchema,
    updateDomiciliario: updateDomiciliarioSchema,
  },
};