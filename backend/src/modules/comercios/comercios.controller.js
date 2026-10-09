const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');
const { esAbiertoAhora } = require('../../utils/horarios');
const cloudinaryService = require('../../services/cloudinary.service');

const SHEET = 'Comercios';

function conEstadoAbierto(comercio) {
  const horarioAbierto = esAbiertoAhora(comercio.horarios);
  const abierto = comercio.activo !== 'false' && horarioAbierto;
  return { ...comercio, abierto: abierto ? 'true' : 'false', horarioAbierto: horarioAbierto ? 'true' : 'false' };
}

exports.getAll = async (req, res, next) => {
  try {
    const comercios = await repository.findWithFilters(SHEET, { estado: 'aprobado' });
    const resultado = comercios
      .map(conEstadoAbierto)
      .sort((a, b) => (a.abierto === b.abierto ? 0 : a.abierto === 'true' ? -1 : 1));
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

exports.getAllAdmin = async (req, res, next) => {
  try {
    const [comercios, users] = await Promise.all([
      repository.findAll(SHEET),
      repository.findAll('Usuarios')
    ]);
    const result = comercios.map(c => {
      const user = users.find(u => u.comercioId === c.id);
      return { ...c, email: user?.email || '' };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getPendientes = async (req, res, next) => {
  try {
    const comercios = await repository.findWhere(SHEET, 'estado', 'pendiente');
    res.json(comercios);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const comercio = await repository.findById(SHEET, req.params.id);
    if (!comercio) return res.status(404).json({ error: 'Comercio no encontrado' });
    res.json(conEstadoAbierto(comercio));
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      nombreNegocio, nombrePropietario, telefono, direccion,
      horarios, categoria, redesSociales, descripcion,
      email, password, cobraEmpaque, tipoEmpaque, valorEmpaque, comision
    } = req.body;
    if (!nombreNegocio || !nombrePropietario || !telefono) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }
    const ciudad = req.body.ciudad === 'neiva' ? 'neiva' : 'palermo';
    const costoEnvio = req.body.costoEnvio || (ciudad === 'neiva' ? '30000' : '');
    const tiempoEstimado = req.body.tiempoEstimado || (ciudad === 'neiva' ? '100' : '');
    const { leerTarifas } = require('../../services/tarifas.service');
    const tarifas = await leerTarifas(repository);
    const comercio = {
      id: generateId(),
      nombreNegocio,
      nombrePropietario,
      telefono,
      direccion: direccion || '',
      horarios: horarios || '',
      categoria: categoria || '',
      redesSociales: redesSociales || '',
      descripcion: descripcion || '',
      logo: '',
      fotografias: '',
      productosPrincipales: '',
      cobraEmpaque: cobraEmpaque || 'no',
      tipoEmpaque: tipoEmpaque || 'pedido',
      valorEmpaque: valorEmpaque || '0',
      ciudad,
      ...(ciudad === 'neiva' ? { costoEnvio, tiempoEstimado } : {}),
      comision: comision === '' || comision == null ? tarifas.comisionVentas : Number(String(comision).replace(',', '.')) || 0,
      estado: 'aprobado',
      activo: 'true',
      fechaRegistro: formatDate(),
      calificacionPromedio: '0',
      totalCalificaciones: '0'
    };
    await repository.create(SHEET, comercio);

    if (email && password) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      const userRepo = require('../../repositories');
      await userRepo.create('Usuarios', {
        id: generateId(),
        nombre: nombrePropietario,
        email: String(email).toLowerCase().trim(),
        telefono,
        direccion: direccion || '',
        password: hashedPassword,
        rol: 'comercio',
        comercioId: comercio.id,
        activo: 'true',
        fechaRegistro: formatDate()
      });
    }

    res.status(201).json(comercio);
  } catch (error) {
    next(error);
  }
};

exports.toggleActivo = async (req, res, next) => {
  try {
    const comercio = await repository.findById(SHEET, req.params.id);
    if (!comercio) return res.status(404).json({ error: 'Comercio no encontrado' });
    const nuevoEstado = comercio.activo === 'true' ? 'false' : 'true';
    await repository.update(SHEET, req.params.id, { activo: nuevoEstado });
    res.json({ message: `Comercio ${nuevoEstado === 'true' ? 'activado' : 'desactivado'}`, activo: nuevoEstado });
  } catch (error) {
    next(error);
  }
};

exports.solicitarRegistro = async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const {
      nombreNegocio, nombrePropietario, telefono, direccion,
      horarios, categoria, redesSociales, descripcion, logo,
      fotografias, productosPrincipales, cobraEmpaque, tipoEmpaque, valorEmpaque
    } = body;

    const ciudad = body.ciudad === 'neiva' ? 'neiva' : 'palermo';
    const neivaDefaults = ciudad === 'neiva' ? { costoEnvio: '30000', tiempoEstimado: '100' } : {};

    const nuevo = {
      id: generateId(),
      nombreNegocio,
      nombrePropietario,
      telefono,
      direccion,
      horarios: horarios || '',
      categoria: categoria || '',
      redesSociales: redesSociales || '',
      descripcion: descripcion || '',
      logo: logo || '',
      fotografias: fotografias || '',
      productosPrincipales: productosPrincipales || '',
      cobraEmpaque: cobraEmpaque || 'no',
      tipoEmpaque: tipoEmpaque || 'pedido',
      valorEmpaque: valorEmpaque || '',
      ciudad,
      ...neivaDefaults,
      estado: 'pendiente',
      activo: 'true',
      fechaRegistro: formatDate(),
      calificacionPromedio: '0',
      totalCalificaciones: '0'
    };
    await repository.create(SHEET, nuevo);
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { email, password, ...comercioData } = req.body;

    if (req.user.rol === 'comercio') {
      if (req.user.comercioId !== req.params.id) {
        return res.status(403).json({ error: 'No tienes permisos para modificar este comercio' });
      }
      const permitidos = ['cobraEmpaque', 'tipoEmpaque', 'valorEmpaque', 'fachada'];
      for (const key of Object.keys(comercioData)) {
        if (!permitidos.includes(key)) delete comercioData[key];
      }
      if (comercioData.fachada !== undefined) {
        comercioData.fachada = String(comercioData.fachada).slice(0, 2000);
        if (comercioData.fachada && !/^https?:\/\//.test(comercioData.fachada) && !comercioData.fachada.startsWith('/uploads/')) {
          return res.status(400).json({ error: 'URL de fachada inválida' });
        }
      }
    }

    await repository.update(SHEET, req.params.id, comercioData);

    if (email !== undefined || password) {
      const users = await repository.findWhere('Usuarios', 'comercioId', req.params.id);
      const user = users.find(u => u.rol === 'comercio');
      const bcrypt = require('bcryptjs');
      const { generateId: genId, formatDate: fmt } = require('../../utils/helpers');

      if (email !== undefined) {
        const emailNorm = String(email || '').toLowerCase().trim();
        if (emailNorm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
          return res.status(400).json({ error: 'Correo electrónico inválido' });
        }
        if (emailNorm) {
          const allUsers = await repository.findAll('Usuarios');
          const dupe = allUsers.find(u => String(u.email || '').toLowerCase().trim() === emailNorm && u.id !== user?.id);
          if (dupe) {
            return res.status(409).json({ error: `El correo ${emailNorm} ya está en uso por otro usuario` });
          }
        }
        if (user) {
          const updateData = {};
          if (emailNorm) updateData.email = emailNorm;
          if (password) {
            updateData.password = await bcrypt.hash(password, 10);
          }
          if (Object.keys(updateData).length > 0) {
            await repository.update('Usuarios', user.id, updateData);
          }
        } else if (emailNorm) {
          // El comercio no tiene cuenta vinculada: crearla para que el cambio de correo funcione
          const comercioActual = await repository.findById(SHEET, req.params.id);
          await repository.create('Usuarios', {
            id: genId(),
            nombre: comercioActual?.nombrePropietario || comercioActual?.nombreNegocio || 'Comercio',
            email: emailNorm,
            telefono: comercioActual?.telefono || '',
            direccion: comercioActual?.direccion || '',
            password: await bcrypt.hash(password || `Tmp-${Date.now()}!Aa1`, 10),
            rol: 'comercio',
            comercioId: req.params.id,
            activo: 'true',
            fechaRegistro: fmt()
          });
        }
      } else if (password && user) {
        await repository.update('Usuarios', user.id, {
          password: await bcrypt.hash(password, 10)
        });
      }
    }

    res.json({ message: 'Comercio actualizado' });
  } catch (error) {
    next(error);
  }
};

const DIAS_PERMITIDOS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function parsearHorarioDia(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const m = String(valor).match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [h1, min1, h2, min2] = [m[1], m[2], m[3], m[4]].map(Number);
  if (min1 >= 60 || min2 >= 60 || h1 >= 24 || h2 > 24) return null;
  if (h1 + min1 === 0 && h2 + min2 === 0) return null;
  const z = n => String(n).padStart(2, '0');
  return `${z(h1)}:${z(min1)}-${z(h2)}:${z(min2)}`;
}

exports.updateHorarios = async (req, res, next) => {
  try {
    const { horarios } = req.body;
    if (!horarios || typeof horarios !== 'object' || Array.isArray(horarios)) {
      return res.status(400).json({ error: 'El campo horarios debe ser un objeto con los 7 días' });
    }

    if (req.user.rol === 'comercio' && req.user.comercioId !== req.params.id) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }

    const plan = {};
    for (const dia of DIAS_PERMITIDOS) {
      const rango = parsearHorarioDia(horarios[dia]);
      if (rango === null && horarios[dia] !== null && horarios[dia] !== undefined && horarios[dia] !== '') {
        return res.status(400).json({ error: `Horario inválido para el día ${dia}. Usa HH:MM-HH:MM` });
      }
      plan[dia] = rango;
    }

    await repository.update(SHEET, req.params.id, { horarios: JSON.stringify(plan) });
    res.json({ message: 'Horario de atención actualizado', horarios: JSON.stringify(plan) });
  } catch (error) {
    next(error);
  }
};

exports.aprobar = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { estado: 'aprobado' });
    res.json({ message: 'Comercio aprobado' });
  } catch (error) {
    next(error);
  }
};

exports.rechazar = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { estado: 'rechazado' });
    res.json({ message: 'Comercio rechazado' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Comercio eliminado' });
  } catch (error) {
    next(error);  }
};

exports.resetPasswordAdmin = async (req, res, next) => {
  try {
    const users = await repository.findAll('Usuarios');
    const user = users.find(u => u.comercioId === req.params.id && u.rol === 'comercio');
    if (!user || !user.email) {
      return res.status(400).json({ error: 'Este comercio no tiene una cuenta vinculada con email.' });
    }

    const resetToken = require('crypto').randomBytes(24).toString('hex');
    await repository.update('Usuarios', user.id, {
      resetToken,
      resetTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    const base = process.env.COMERCIO_URL || 'https://comercio.domipalermo.com';
    const resetLink = `${base}/reset-password?token=${resetToken}`;
    const emailService = require('../../services/email.service');
    const r = await emailService.sendPasswordReset(user.email, resetLink);
    if (!r.success) {
      return res.status(502).json({ error: 'No se pudo enviar el correo de recuperación.' });
    }
    res.json({ message: `Correo de restablecimiento enviado a ${user.email}` });
  } catch (error) {
    next(error);
  }
};

exports.subirLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo requerido' });
    }
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'La imagen no debe superar 2MB' });
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Solo se permiten imágenes PNG, JPG, WebP' });
    }

    const comercio = await repository.findById(SHEET, req.params.id);
    if (!comercio) return res.status(404).json({ error: 'Comercio no encontrado' });

    // Subir a Cloudinary con optimización (f_auto, q_auto, max 600px) o fallback local
    const { url } = await cloudinaryService.upload(req.file.buffer, 'comercios/logos', { width: 600 });

    // Limpiar logo anterior si existe
    if (comercio.logo) {
      const prevId = await cloudinaryService.extractPublicId(comercio.logo);
      if (prevId) await cloudinaryService.remove(prevId).catch(() => {});
    }

    await repository.update(SHEET, req.params.id, { logo: url });
    res.json({ logoUrl: url, message: 'Logo actualizado' });
  } catch (error) {
    next(error);
  }
};

exports.eliminarLogo = async (req, res, next) => {
  try {
    const comercio = await repository.findById(SHEET, req.params.id);
    if (!comercio) return res.status(404).json({ error: 'Comercio no encontrado' });
    if (comercio.logo) {
      const publicId = await cloudinaryService.extractPublicId(comercio.logo);
      if (publicId) await cloudinaryService.remove(publicId).catch(() => {});
    }
    await repository.update(SHEET, req.params.id, { logo: '' });
    res.json({ message: 'Logo eliminado' });
  } catch (error) {
    next(error);
  }
};

exports.getIpWhitelist = async (req, res, next) => {
  try {
    const comercio = await repository.findById(SHEET, req.params.id);
    if (!comercio) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }
    
    // Verificar autorización
    if (req.user.rol !== 'admin' && req.user.comercioId !== req.params.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    let allowedIps = [];
    try {
      const parsed = JSON.parse(comercio.allowedIps || '[]');
      if (Array.isArray(parsed)) allowedIps = parsed;
    } catch {}
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.ip || 
                     req.connection?.remoteAddress || 
                     'unknown';
    
    res.json({ 
      allowedIps,
      currentIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      isEnabled: allowedIps.length > 0
    });
  } catch (error) {
    next(error);
  }
};

exports.updateIpWhitelist = async (req, res, next) => {
  try {
    if (req.user.rol !== 'admin' && req.user.comercioId !== req.params.id) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    const { allowedIps } = req.body;
    
    if (!Array.isArray(allowedIps)) {
      return res.status(400).json({ error: 'allowedIps debe ser un array' });
    }
    
    // Validar cada IP
    const { validateIpPattern } = require('../../middleware/ipWhitelist.middleware');
    const invalidIps = allowedIps.filter(ip => !ip || !ip.trim() || !validateIpPattern(ip.trim()));
    
    if (invalidIps.length > 0) {
      return res.status(400).json({ 
        error: 'IPs inválidas', 
        invalid: invalidIps,
        message: 'Formatos válidos: IP exacta (192.168.1.1), CIDR (192.168.1.0/24), o comodín (192.168.1.*)'
      });
    }
    
    const cleanIps = allowedIps.map(ip => ip.trim()).filter(Boolean);
    
    await repository.update(SHEET, req.params.id, { allowedIps: JSON.stringify(cleanIps) });
    
    res.json({ 
      message: 'Whitelist de IPs actualizada', 
      allowedIps: cleanIps,
      isEnabled: cleanIps.length > 0
    });
  } catch (error) {
    next(error);
  }
};

exports.testIpWhitelist = async (req, res, next) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP a testear requerida' });
    }
    
    const comercio = await repository.findById(SHEET, req.params.id);
    if (!comercio) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }
    
    const { ipMatches } = require('../../middleware/ipWhitelist.middleware');
    const allowedIps = comercio.allowedIps || [];
    
    const isAllowed = allowedIps.length === 0 || allowedIps.some(pattern => ipMatches(ip, pattern));
    
    res.json({ 
      testedIp: ip,
      isAllowed,
      allowedIps: comercio.allowedIps || [],
      message: isAllowed ? 'IP permitida' : 'IP bloqueada'
    });
  } catch (error) {
    next(error);
  }
};