const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');
const emailService = require('../../services/email.service');
const { cola } = require('../../services/cola.service');
const { parseMenuFromDataUrls, cropAndUploadProducts, resolveEmoji } = require('../../services/menuParser.service');

const SHEET = 'Solicitudes';

const MAX_CARTA_BASE64 = 15 * 1024 * 1024;

exports.analizarCarta = async (req, res, next) => {
  try {
    const { cartaImagen } = req.body || {};
    if (!cartaImagen || typeof cartaImagen !== 'string') {
      return res.status(400).json({ error: 'Adjunta la carta (imagen o PDF) para analizar.' });
    }
    if (!/^data:((image\/(png|jpe?g|webp|heic|heif))|application\/pdf);base64,/i.test(cartaImagen)) {
      return res.status(400).json({ error: 'Formato no soportado. Sube una imagen (JPG, PNG, WebP) o un PDF.' });
    }
    if (cartaImagen.length > MAX_CARTA_BASE64) {
      return res.status(413).json({ error: 'La carta es demasiado grande. Máximo ~11 MB por archivo.' });
    }

    const resultado = await parseMenuFromDataUrls([cartaImagen]);

    // Extract buffer and mimeType from the base64 data URL
    const match = cartaImagen.match(/^data:([^;]+);base64,(.+)$/s);
    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    if (match) {
      mimeType = match[1];
      imageBuffer = Buffer.from(match[2], 'base64');
    }

    // Crop and upload product images to Cloudinary
    let productosConImagen = resultado.productos;
    if (imageBuffer && resultado.productos?.length > 0) {
      try {
        productosConImagen = await cropAndUploadProducts(imageBuffer, mimeType, resultado.productos);
        console.log('[Analizar Carta] Imágenes subidas:', productosConImagen.filter(p => p.imagen).length);
      } catch (cropErr) {
        console.warn('[Analizar Carta] Error recortando imágenes:', cropErr.message);
      }
    }

    res.json({
      productos: productosConImagen.map(p => ({
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        categoria: p.categoria,
        imagen: p.imagen || '',
        emoji: resolveEmoji(p),
      })),
      total: productosConImagen.length,
      confianza: resultado.metadatos?.confianza_global || 0.8,
    });
  } catch (error) {
    if (error.message?.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'El análisis con IA no está disponible en este momento.' });
    }
    if (error.message?.includes('CUOTA_AGOTADA')) {
      return res.status(429).json({ error: 'Se ha excedido el límite gratuito de análisis con IA (20 por día). Intenta mañana o contacta al administrador para aumentar la cuota.' });
    }
    console.error('[Analizar Carta]', error.message);
    res.status(502).json({ error: error.message || 'No se pudo analizar la carta. Intenta nuevamente.' });
  }
};

exports.getAll = async (req, res, next) => {
  try {
    let solicitudes = await repository.findAll(SHEET);
    if (req.query.tipo) {
      solicitudes = solicitudes.filter(s => s.tipo === req.query.tipo);
    }
    solicitudes.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    res.json(solicitudes);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const solicitud = await repository.findById(SHEET, req.params.id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
};

exports.solicitarRegistroComercio = async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const {
      nombreNegocio, nombrePropietario, telefono, direccion,
      horarios, categoria, redesSociales, descripcion,
      productosPrincipales,
      cobraEmpaque, tipoEmpaque, valorEmpaque,
      productos, logo, fachada, dominical, email, pruebaSms
    } = body;

    const ciudad = body.ciudad === 'neiva' ? 'neiva' : 'palermo';
    const neivaDefaults = ciudad === 'neiva' ? { costoEnvio: '30000', tiempoEstimado: '100' } : {};

    // Contacto verificado obligatorio: email con código + teléfono con SMS
    const { emailVerificado, verificarPruebaSms } = require('../verificacion/verificacion.controller');
    const emailContacto = String(email || '').toLowerCase().trim();
    if (!emailContacto) {
      return res.status(400).json({ error: 'El correo de contacto es requerido' });
    }
    if (!(await emailVerificado(emailContacto))) {
      return res.status(400).json({ error: 'Debes verificar tu correo con el código enviado' });
    }
    if (!verificarPruebaSms(pruebaSms, telefono)) {
      return res.status(400).json({ error: 'Debes verificar tu teléfono con el código SMS' });
    }

    // Declaración de derechos de imagen (prueba para Ley 23/1982 y Decisión 351)
    const conImagenes = (Array.isArray(productos) && productos.some(p => p && p.imagen))
      || body.logo || body.fachada || body.tieneCarta;
    if (conImagenes && body.declaraDerechos !== true) {
      return res.status(400).json({ error: 'Debes declarar que tienes derechos sobre las imágenes' });
    }

    let cuentaPasswordHash = '';
    if (body.cuentaEmail && body.cuentaPassword) {
      const bcrypt = require('bcryptjs');
      cuentaPasswordHash = await bcrypt.hash(body.cuentaPassword, 10);
    }

    const nueva = {
      id: generateId(),
      tipo: 'registro_comercio',
      usuarioId: req.user?.id || '',
      usuarioNombre: nombrePropietario || req.user?.nombre || '',
      datos: JSON.stringify({
        nombreNegocio, nombrePropietario, telefono, direccion,
        horarios, categoria, redesSociales, descripcion,
        productosPrincipales,
        email: emailContacto,
        emailVerificado: 'true',
        telefonoVerificado: 'true',
        logo: logo || '',
        fachada: fachada || '',
        dominical: dominical === 'true' ? 'true' : 'false',
        declaraDerechos: body.declaraDerechos === true,
        declaraDerechosFecha: body.declaraDerechos === true ? new Date().toISOString() : '',
        cobraEmpaque: cobraEmpaque || 'no',
        tipoEmpaque: tipoEmpaque || 'pedido',
        valorEmpaque: valorEmpaque || '0',
        productos: Array.isArray(productos) ? productos : [],
        ciudad,
        ...neivaDefaults,
        cuentaEmail: body.cuentaEmail || '',
        cuentaPasswordHash
      }),
      estado: 'pendiente',
      fecha: formatDate()
    };
    await repository.create(SHEET, nueva);

    const notifRepo = require('../../repositories');
    await notifRepo.create('Notificaciones', {
      id: generateId(),
      titulo: 'Nueva solicitud de comercio',
      mensaje: `${nombreNegocio} solicitó registrarse como comercio`,
      destinatarioId: '',
      dirigidoA: 'admin',
      tipo: 'solicitud',
      leida: 'false',
      fecha: formatDate()
    });

    cola.encolar('email-admin', {
      subject: 'Nueva solicitud de comercio 🏪',
      texto: `El negocio <b>${nombreNegocio}</b> (propietario: ${nombrePropietario || nueva.usuarioNombre}, tel: ${telefono}) solicitó registrarse como comercio. Entra al panel de administración para revisarla y aprobarla.`
    });

    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
};

exports.solicitarRegistroDomiciliario = async (req, res, next) => {
  try {
    const { nombre, tipoDocumento, numeroDocumento, telefono, email, tipoVehiculo } = req.validatedBody || req.body;
    if (!nombre || !tipoDocumento || !numeroDocumento || !telefono || !email || !tipoVehiculo) {
      return res.status(400).json({ error: 'nombre, tipoDocumento, numeroDocumento, telefono, email y tipoVehiculo son requeridos' });
    }
    const nueva = {
      id: generateId(),
      tipo: 'registro_domiciliario',
      usuarioId: req.user?.id || '',
      usuarioNombre: nombre,
      datos: JSON.stringify({ nombre, tipoDocumento, numeroDocumento, telefono, email: String(email).toLowerCase().trim(), tipoVehiculo }),
      estado: 'pendiente',
      fecha: formatDate()
    };
    await repository.create(SHEET, nueva);

    const notifRepo = require('../../repositories');
    await notifRepo.create('Notificaciones', {
      id: generateId(),
      titulo: 'Nueva solicitud de domiciliario',
      mensaje: `${nombre} solicita ser domiciliario`,
      destinatarioId: '',
      dirigidoA: 'admin',
      tipo: 'solicitud',
      leida: 'false',
      fecha: formatDate()
    });

    cola.encolar('email-admin', {
      subject: 'Nueva solicitud de domiciliario 🛵',
      texto: `<b>${nombre}</b> (CC ${numeroDocumento}, tel: ${telefono}, vehículo: ${tipoVehiculo}) solicitó registrarse como domiciliario. Entra al panel de administración para revisarla y aprobarla.`
    });

    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
};

exports.aprobar = async (req, res, next) => {
  try {
    const solicitud = await repository.findById(SHEET, req.params.id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: `Esta solicitud ya está ${solicitud.estado}` });
    }

    if (solicitud.tipo === 'registro_domiciliario') {
      const { usuario, password } = req.body || {};
      if (!usuario || !password) {
        return res.status(400).json({ error: 'Para aprobar un domiciliario debes asignar usuario y contraseña.' });
      }
      const usuarioNorm = String(usuario).toLowerCase().trim();
      if (!/^[a-z0-9._-]{4,30}$/.test(usuarioNorm)) {
        return res.status(400).json({ error: 'Usuario inválido: 4-30 caracteres (letras, números, punto, guion o guion bajo).' });
      }
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
        return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres con letras y números.' });
      }
      const users = await repository.findAll('Usuarios');
      if (users.some(u => (u.usuario || '').toLowerCase() === usuarioNorm)) {
        return res.status(400).json({ error: `El usuario "${usuarioNorm}" ya existe. Elige otro.` });
      }
      if (users.some(u => u.email === usuarioNorm)) {
        return res.status(400).json({ error: `El usuario "${usuarioNorm}" coincide con un email existente. Elige otro.` });
      }

      const bcrypt = require('bcryptjs');
      let datos = {};
      try { datos = JSON.parse(solicitud.datos); } catch {}
      const emailDom = String(datos.email || '').toLowerCase().trim();
      if (emailDom && users.some(u => String(u.email || '').toLowerCase() === emailDom)) {
        return res.status(409).json({ error: `El correo ${emailDom} ya está en uso por otro usuario` });
      }

      await repository.update(SHEET, solicitud.id, { estado: 'aprobado' });

      const nuevoUsuario = {
        id: generateId(),
        nombre: solicitud.usuarioNombre || datos.nombre || '',
        email: emailDom,
        telefono: datos.telefono || '',
        direccion: '',
        password: await bcrypt.hash(password, 10),
        usuario: usuarioNorm,
        rol: 'domiciliario',
        activo: 'true',
        disponible: 'true',
        fechaRegistro: formatDate()
      };
      await repository.create('Usuarios', nuevoUsuario);

      if (emailDom) {
        cola.encolar('bienvenida-domiciliario', { email: emailDom, nombre: nuevoUsuario.nombre, usuario: usuarioNorm });
      }

      await repository.create('Notificaciones', {
        id: generateId(),
        titulo: '¡Bienvenido al equipo! 🛵',
        mensaje: `Tu solicitud fue aprobada. Ya puedes iniciar sesión en la app de domiciliarios con el usuario "${usuarioNorm}" asignado por el administrador.`,
        destinatarioId: nuevoUsuario.id,
        dirigidoA: '',
        tipo: 'cuenta',
        leida: 'false',
        fecha: formatDate()
      });

      return res.json({ message: `Domiciliario aprobado. Cuenta creada con usuario "${usuarioNorm}".` });
    }

    await repository.update(SHEET, req.params.id, { estado: 'aprobado' });

    if (solicitud.tipo === 'registro_comercio') {
      const datos = JSON.parse(solicitud.datos);
      const comercio = {
        id: generateId(),
        ...datos,
        estado: 'aprobado',
        activo: 'true',
        fechaRegistro: formatDate(),
        calificacionPromedio: '0',
        totalCalificaciones: '0'
      };
      delete comercio.productos;
      delete comercio.cuentaEmail;
      delete comercio.cuentaPasswordHash;
      delete comercio.email;
      delete comercio.emailVerificado;
      delete comercio.telefonoVerificado;
      delete comercio.declaraDerechos;
      delete comercio.declaraDerechosFecha;
      const comRepo = require('../../repositories');
      await comRepo.create('Comercios', comercio);

      if (Array.isArray(datos.productos) && datos.productos.length > 0) {
        const aLista = (v) => {
          const arr = Array.isArray(v) ? v : String(v || '').split(',');
          return arr.map(s => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 20);
        };
        for (const p of datos.productos) {
          if (!p || !p.nombre) continue;
          await comRepo.create('Productos', {
            id: generateId(),
            comercioId: comercio.id,
            nombre: String(p.nombre).slice(0, 255),
            descripcion: p.descripcion ? String(p.descripcion) : '',
            precio: Number(p.precio) || 0,
            categoria: p.categoria ? String(p.categoria).slice(0, 100) : '',
            imagen: p.imagen || '',
            emoji: resolveEmoji(p),
            derechos: datos.declaraDerechos === true ? 'true' : 'false',
            tallas: JSON.stringify(aLista(p.tallas)),
            colores: JSON.stringify(aLista(p.colores)),
            activo: 1,
          });
        }
      }

      // Acceso al dashboard: si el solicitante ya tiene cuenta (pidió logueado),
      // se vincula de inmediato. Si no, se envía invitación con botón para
      // crear su contraseña (el comercio la define, nunca viaja por el form).
      let cuentaCreada = false;
      let emailDestino = '';

      if (solicitud.usuarioId) {
        const u = await comRepo.findById('Usuarios', solicitud.usuarioId);
        if (u && (!u.comercioId || u.comercioId === comercio.id)) {
          await comRepo.update('Usuarios', u.id, { rol: 'comercio', comercioId: comercio.id });
          cuentaCreada = true;
          emailDestino = u.email || '';
        }
      }

      if (cuentaCreada && emailDestino) {
        cola.encolar('bienvenida-comercio', { email: emailDestino, nombre: datos.nombrePropietario || datos.nombreNegocio });
      } else {
        // Flujo con invitación: el email de contacto se verificó en el formulario
        const emailInv = String(datos.email || datos.cuentaEmail || '').toLowerCase().trim();
        if (emailInv) {
          const crypto = require('crypto');
          const token = crypto.randomBytes(32).toString('hex');
          const expira = new Date(Date.now() + 72 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
          await comRepo.create('Invitaciones', {
            id: generateId(),
            comercioId: comercio.id,
            email: emailInv,
            tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
            expira,
            usado: 'false',
          });
          const config = require('../../config');
          const base = config.comercioUrl || 'https://comercio.domipalermo.com';
          const link = `${base}/crear-password?token=${token}`;
          cola.encolar('email', {
            to: emailInv,
            subject: '¡Tu comercio fue aprobado! Crea tu contraseña - GoPalermo',
            html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #5E244E;">¡Felicidades, ${datos.nombreNegocio || 'tu negocio'} fue aprobado! 🎉</h2>
              <p>Ya puedes entrar a tu panel de comercio. Primero crea tu contraseña:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${link}" style="background: #5E244E; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; font-weight: bold;">Crear mi contraseña</a>
              </div>
              <p style="color: #999; font-size: 13px;">Este enlace vence en 72 horas. Si no lo solicitaste, ignora este correo.</p>
              <p style="color: #bbb; font-size: 12px; text-align: center;">GoPalermo &copy; ${new Date().getFullYear()}</p>
            </div>`,
          });
        }
      }
    }

    res.json({ message: 'Solicitud aprobada' });
  } catch (error) {
    next(error);
  }
};

exports.rechazar = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { estado: 'rechazado' });
    res.json({ message: 'Solicitud rechazada' });
  } catch (error) {
    next(error);
  }
};
