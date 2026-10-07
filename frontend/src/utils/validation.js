const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

const PASSWORD_CHECKS = [
  { test: (p) => p.length >= 12, msg: 'al menos 12 caracteres' },
  { test: (p) => /[A-Z]/.test(p), msg: 'una letra mayúscula' },
  { test: (p) => /[a-z]/.test(p), msg: 'una letra minúscula' },
  { test: (p) => /[0-9]/.test(p), msg: 'un número' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), msg: 'un carácter especial' },
];

function passwordError(password) {
  const failed = PASSWORD_CHECKS.find((c) => !c.test(password || ''));
  return failed ? `La contraseña debe tener ${failed.msg}.` : null;
}

export function validateLogin({ email, password }) {
  const value = (email || '').trim();
  if (!value) return 'Ingresa tu correo electrónico.';
  if (!EMAIL_RE.test(value)) return 'Ingresa un correo electrónico válido.';
  if (!password) return 'Ingresa tu contraseña.';
  return null;
}

export function validateRegister(form) {
  if (!(form.nombre || '').trim()) return 'Ingresa tu nombre completo.';
  const email = (form.email || '').trim();
  if (!EMAIL_RE.test(email)) return 'Ingresa un correo electrónico válido.';
  if ((form.telefono || '').trim() && !PHONE_RE.test(form.telefono.trim())) return 'El teléfono no es válido.';
  const pwError = passwordError(form.password);
  if (pwError) return pwError;
  if (form.password !== form.confirmPassword) return 'Las contraseñas no coinciden.';
  if (!form.mayorEdad) return 'Debes confirmar que eres mayor de 18 años.';
  return null;
}

export function validateForgotPassword(email) {
  if (!EMAIL_RE.test((email || '').trim())) return 'Ingresa un correo electrónico válido.';
  return null;
}

export function validateResetPassword(newPassword, confirmPassword) {
  const pwError = passwordError(newPassword);
  if (pwError) return pwError;
  if (newPassword !== confirmPassword) return 'Las contraseñas no coinciden.';
  return null;
}

export function validateSolicitud(form) {
  const negocio = (form.nombreNegocio || '').trim();
  if (!negocio) return 'Ingresa el nombre del negocio.';
  if (negocio.length < 3) return 'El nombre del negocio debe tener al menos 3 caracteres.';
  if (negocio.length > 100) return 'El nombre del negocio no puede superar 100 caracteres.';

  if (!(form.nombrePropietario || '').trim()) return 'Ingresa el nombre del propietario.';

  const tel = (form.telefono || '').trim();
  if (!tel) return 'Ingresa el teléfono de contacto.';
  if (!PHONE_RE.test(tel)) return 'El teléfono no es válido.'; 

  const dir = (form.direccion || '').trim();
  if (!dir) return 'Ingresa la dirección.';
  if (dir.length < 5) return 'La dirección debe tener al menos 5 caracteres.';

  if (form.cobraEmpaque === 'si') {
    const valor = (form.valorEmpaque || '').trim();
    if (!valor) return 'Indica el valor del empaque.';
    if (!/^\d+(\.\d+)?$/.test(valor) || Number(valor) <= 0) return 'El valor del empaque debe ser un número mayor a 0.';
  }

  const cuentaEmail = (form.emailContacto || '').trim();
  if (!cuentaEmail) return 'Ingresa tu correo de contacto.';
  if (!EMAIL_RE.test(cuentaEmail)) return 'Ingresa un correo electrónico válido.';

  const redes = (form.redesSociales || '').trim();
  if (redes && /https?:\/\/|www\./i.test(redes)) return 'En redes sociales no se permiten enlaces: usa @usuario.';

  const desc = (form.descripcion || '').trim();
  if (desc.length > 150) return 'La descripción no puede superar 150 caracteres.';

  return null;
}

export function validarCampoSolicitud(name, value, form) {
  switch (name) {
    case 'nombreNegocio': {
      const v = String(value || '').trim();
      if (!v) return 'Ingresa el nombre del negocio.';
      if (v.length < 3) return 'El nombre del negocio debe tener al menos 3 caracteres.';
      if (v.length > 100) return 'El nombre del negocio no puede superar 100 caracteres.';
      if (/[<>]/.test(v)) return 'Caracteres no permitidos.';
      return null;
    }
    case 'nombrePropietario': {
      const v = String(value || '').trim();
      if (!v) return 'Ingresa el nombre del propietario.';
      if (/[<>]/.test(v)) return 'Caracteres no permitidos.';
      return null;
    }
    case 'telefono': {
      const v = String(value || '').trim();
      if (!v) return 'Ingresa el teléfono de contacto.';
      if (!PHONE_RE.test(v)) return 'El teléfono no es válido.';
      return null;
    }
    case 'direccion': {
      const v = String(value || '').trim();
      if (!v) return 'Ingresa la dirección.';
      if (v.length < 5) return 'La dirección debe tener al menos 5 caracteres.';
      if (/[<>]/.test(v)) return 'Caracteres no permitidos.';
      return null;
    }
    case 'valorEmpaque': {
      if (form?.cobraEmpaque !== 'si') return null;
      const v = String(value || '').trim();
      if (!v) return 'Indica el valor del empaque.';
      if (!/^\d+(\.\d+)?$/.test(v) || Number(v) <= 0) return 'El valor del empaque debe ser un número mayor a 0.';
      return null;
    }
    case 'cuentaEmail': {
      const v = String(value || '').trim();
      if (!v) return 'Ingresa el correo de tu panel.';
      if (!EMAIL_RE.test(v)) return 'Ingresa un correo electrónico válido.';
      return null;
    }
    case 'emailContacto': {
      const v = String(value || '').trim();
      if (!v) return 'Ingresa tu correo de contacto.';
      if (!EMAIL_RE.test(v)) return 'Ingresa un correo electrónico válido.';
      return null;
    }
    case 'cuentaPassword': {
      const v = String(value || '');
      if (!v) return 'Ingresa una contraseña para tu panel.';
      return passwordError(v);
    }
    case 'categoria': {
      if (!String(value || '').trim()) return 'Selecciona la subcategoría.';
      return null;
    }
    case 'redesSociales': {
      const v = String(value || '').trim();
      if (v && /https?:\/\/|www\./i.test(v)) return 'Sin enlaces: usa @usuario.';
      if (/[<>]/.test(v)) return 'Caracteres no permitidos.';
      return null;
    }
    case 'descripcion': {
      const v = String(value || '').trim();
      if (v.length > 150) return 'Máximo 150 caracteres.';
      if (/[<>]/.test(v)) return 'Caracteres no permitidos.';
      return null;
    }
    default:
      return null;
  }
}

export function validateRegistroServicio(form) {
  const nombre = (form.nombre || '').trim();
  if (!nombre) return 'Ingresa tu nombre o el de tu empresa.';
  if (nombre.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (nombre.length > 100) return 'El nombre no puede superar 100 caracteres.';

  const servicio = (form.servicio || '').trim();
  if (!servicio) return 'Ingresa el servicio que ofreces.';
  if (servicio.length < 3) return 'El servicio debe tener al menos 3 caracteres.';

  const tel = (form.telefono || '').trim();
  if (!tel) return 'Ingresa tu teléfono de contacto.';
  if (!PHONE_RE.test(tel)) return 'El teléfono no es válido.';

  if ((form.descripcion || '').length > 500) return 'La descripción no puede superar 500 caracteres.';

  return null;
}

export function validateRegistroDomiciliario(form) {
  const nombre = (form.nombre || '').trim();
  if (!nombre) return 'Ingresa tu nombre completo.';
  if (nombre.length < 2 || nombre.length > 100) return 'El nombre debe tener entre 2 y 100 caracteres.';
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\.]+$/.test(nombre)) return 'El nombre solo puede contener letras, espacios, guiones y puntos.';

  if (!form.tipoDocumento) return 'Selecciona tu tipo de documento.';
  if (!['Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte'].includes(form.tipoDocumento)) return 'Tipo de documento no válido.';

  const doc = (form.numeroDocumento || '').trim();
  if (!doc) return 'Ingresa tu número de documento.';
  if (!/^\d{5,15}$/.test(doc)) return 'El número de documento debe tener entre 5 y 15 dígitos numéricos.';

  const tel = (form.telefono || '').trim();
  if (!tel) return 'Ingresa tu teléfono de contacto.';
  if (!PHONE_RE.test(tel)) return 'El teléfono no es válido.';

  const emailDom = (form.email || '').trim();
  if (!emailDom) return 'Ingresa tu correo electrónico.';
  if (!EMAIL_RE.test(emailDom)) return 'Ingresa un correo electrónico válido.';

  if (!form.tipoVehiculo) return 'Selecciona tu tipo de vehículo.';
  if (!['Bicicleta', 'Moto'].includes(form.tipoVehiculo)) return 'Tipo de vehículo no válido.';

  return null;
}

export { EMAIL_RE, PHONE_RE, PASSWORD_CHECKS, passwordError };
