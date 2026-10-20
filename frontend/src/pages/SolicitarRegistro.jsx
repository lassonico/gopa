import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { comercios, uploads, verificacion } from '../services/api';
import { useAuth } from '../App';
import { auth as firebaseAuth } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useData } from '../contexts/DataContext';
import HorariosSelector, { planPorDefecto, serializarPlan } from '../components/HorariosSelector';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import Loader from '../components/Loader';
import { useToast } from '../components/Toast';
import { validateSolicitud, validarCampoSolicitud } from '../utils/validation';
import { esCategoriaTienda, CONSUMO_SUBS, TIENDAS_SUBS } from '../utils/tiendas';

export default function SolicitarRegistro() {
  const { user } = useAuth();
  const { categoriasList: catList } = useData();
  const [searchParams] = useSearchParams();
  const esNeivaInicial = searchParams.get('ciudad') === 'neiva';
  const [form, setForm] = useState({
    nombreNegocio: '', nombrePropietario: user?.nombre || '', telefono: '',
    direccion: '', horarios: serializarPlan(planPorDefecto()), categoria: '', redesSociales: '',
    descripcion: '', cartaImagen: '', logo: '', fachada: '',
    cobraEmpaque: 'no', tipoEmpaque: 'pedido', valorEmpaque: '',
    ciudad: esNeivaInicial ? 'neiva' : 'palermo',
    emailContacto: user?.email || ''
  });
  // Verificación de contacto (requisito de seguridad)
  const [emailCodigo, setEmailCodigo] = useState('');
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [emailCargando, setEmailCargando] = useState(false);
  const [smsCodigo, setSmsCodigo] = useState('');
  const [smsEnviado, setSmsEnviado] = useState(false);
  const [smsVerificado, setSmsVerificado] = useState(false);
  const [pruebaSms, setPruebaSms] = useState('');
  const [smsCargando, setSmsCargando] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaRef = useRef(null);
  const verifierRef = useRef(null);

  // Mensaje amable: nunca exponer detalles técnicos (cuota, formato interno, dominios)
  const mensajeSmsAmable = () => 'No pudimos enviar el código. Intenta nuevamente más tarde.';

  const obtenerVerifier = () => {
    if (verifierRef.current) return verifierRef.current;
    if (!recaptchaRef.current) {
      recaptchaRef.current = document.createElement('div');
      recaptchaRef.current.style.display = 'none';
      document.body.appendChild(recaptchaRef.current);
    }
    verifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaRef.current, { size: 'invisible' });
    return verifierRef.current;
  };

  const normalizarTelefonoCo = (t) => {
    const d = String(t || '').replace(/[^\d+]/g, '');
    if (!d) return '';
    if (d.startsWith('+')) return d;
    if (d.length === 10) return `+57${d}`;
    if (d.length === 11 && d.startsWith('0')) return `+57${d.slice(1)}`;
    return d;
  };

  const enviarCodigoEmail = async () => {
    const v = validarCampoSolicitud('emailContacto', form.emailContacto, form);
    if (v) { setErrores(er => ({ ...er, emailContacto: v })); toast.error(v); return; }
    setEmailCargando(true);
    try {
      await verificacion.enviarCodigoEmail(form.emailContacto.trim());
      setEmailEnviado(true);
      toast.success('Código enviado a tu correo.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo enviar el código.');
    } finally {
      setEmailCargando(false);
    }
  };

  const confirmarCodigoEmail = async () => {
    if (!emailCodigo.trim()) { toast.error('Ingresa el código de 6 dígitos.'); return; }
    setEmailCargando(true);
    try {
      await verificacion.confirmarCodigoEmail(form.emailContacto.trim(), emailCodigo.trim());
      setEmailVerificado(true);
      setErrores(er => ({ ...er, emailContacto: null }));
      guardarBorrador(form, grupoCategoria, productos, paso, {
        emailVerificado: true, emailPara: form.emailContacto.trim().toLowerCase(),
        smsVerificado, telPara: form.telefono, pruebaSms,
      });
      toast.success('Correo verificado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto.');
    } finally {
      setEmailCargando(false);
    }
  };

  const enviarCodigoSms = async () => {
    const tel = normalizarTelefonoCo(form.telefono);
    if (!tel) { toast.error('Ingresa un teléfono válido.'); return; }
    if (!firebaseAuth) { toast.error(mensajeSmsAmable()); return; }
    setSmsCargando(true);
    try {
      const appVerifier = obtenerVerifier();
      const result = await signInWithPhoneNumber(firebaseAuth, tel, appVerifier);
      setConfirmationResult(result);
      setSmsEnviado(true);
      toast.success('Código enviado por mensaje de texto.');
    } catch (err) {
      console.error('Error enviando SMS:', err?.code || err?.message);
      verifierRef.current = null;
      toast.error(mensajeSmsAmable());
    } finally {
      setSmsCargando(false);
    }
  };

  const confirmarCodigoSms = async () => {
    if (!confirmationResult) { toast.error('Solicita el código primero.'); return; }
    if (!smsCodigo.trim()) { toast.error('Ingresa el código SMS.'); return; }
    setSmsCargando(true);
    try {
      const result = await confirmationResult.confirm(smsCodigo.trim());
      const idToken = await result.user.getIdToken();
      const { data } = await verificacion.confirmarSms(idToken);
      setPruebaSms(data.prueba);
      setSmsVerificado(true);
      const telFinal = data.phone || form.telefono;
      setForm(f => ({ ...f, telefono: telFinal }));
      guardarBorrador({ ...form, telefono: telFinal }, grupoCategoria, productos, paso, {
        emailVerificado, emailPara: form.emailContacto.trim().toLowerCase(),
        smsVerificado: true, telPara: telFinal, pruebaSms: data.prueba,
      });
      toast.success('Teléfono verificado.');
    } catch (err) {
      const codigo = err?.code || '';
      if (codigo.includes('invalid-verification-code') || err.response?.status === 400) {
        toast.error('Código incorrecto. Intenta nuevamente.');
      } else if (codigo.includes('code-expired') || codigo.includes('session-expired')) {
        setSmsCodigo('');
        setConfirmationResult(null);
        toast.error('⏳ Este código ya venció. Te enviamos uno nuevo: tócalo e ingrésalo rapidito.');
        try { await enviarCodigoSms(); } catch {}
      } else {
        console.error('Error verificando SMS:', codigo || err?.message);
        toast.error(mensajeSmsAmable());
      }
    } finally {
      setSmsCargando(false);
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cartaFile, setCartaFile] = useState(null);
  const [productos, setProductos] = useState([]);
  const [analizando, setAnalizando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoFachada, setSubiendoFachada] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [declaraDerechos, setDeclaraDerechos] = useState(false);

  const hayImagenes = productos.some(p => p.imagen && p.imagen !== 'uploading')
    || !!form.logo || !!form.fachada || !!form.cartaImagen;
  const [errores, setErrores] = useState({});
  const [tocados, setTocados] = useState({});
  const [cuentaAtras, setCuentaAtras] = useState(6);
  const [grupoCategoria, setGrupoCategoria] = useState('');
  const [paso, setPaso] = useState(1);
  const turnstileRef = useRef(null);
  const toast = useToast();

  const CLAVE_BORRADOR = 'solicitud_borrador';

  const guardarBorrador = (f = form, g = grupoCategoria, ps = productos, p = paso, v = null) => {
    try {
      const { cartaImagen, ...formSinCarta } = f;
      const verif = v || {
        emailVerificado, emailPara: (f.emailContacto || '').trim().toLowerCase(),
        smsVerificado, telPara: f.telefono, pruebaSms,
      };
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
        form: formSinCarta, grupoCategoria: g, productos: ps, paso: p, verif,
        fecha: new Date().toISOString(),
      }));
    } catch {}
  };

  const limpiarBorrador = () => {
    try { localStorage.removeItem(CLAVE_BORRADOR); } catch {}
  };

  // Restaurar borrador (sin la carta, que se re-adjunta por tamaño).
  // Las verificaciones se conservan solo si el dato no cambió.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE_BORRADOR);
      if (!raw) return;
      const b = JSON.parse(raw);
      if (b?.form) setForm(f => ({ ...f, ...b.form, cartaImagen: '' }));
      if (b?.grupoCategoria) setGrupoCategoria(b.grupoCategoria);
      if (Array.isArray(b?.productos)) setProductos(b.productos);
      if (b?.paso === 2 || b?.paso === 3) setPaso(b.paso);
      const v = b?.verif;
      if (v?.emailVerificado && v.emailPara && String(b.form?.emailContacto || '').trim().toLowerCase() === v.emailPara) {
        setEmailVerificado(true);
        setEmailEnviado(true);
      }
      if (v?.smsVerificado && v.pruebaSms && String(b.form?.telefono || '') === v.telPara) {
        setSmsVerificado(true);
        setSmsEnviado(true);
        setPruebaSms(v.pruebaSms);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SUBS_POR_GRUPO = {
    consumo: [
      ...CONSUMO_SUBS,
      ...(catList || [])
        .filter(c => (c.grupo || '') === 'consumo' && !CONSUMO_SUBS.some(s => s.nombre.toLowerCase() === String(c.nombre || '').toLowerCase().trim()))
        .map(c => ({ nombre: c.nombre, icono: c.icono || '📦' })),
    ],
    tiendas: [
      ...TIENDAS_SUBS,
      ...(catList || [])
        .filter(c => (c.grupo || '') === 'tiendas' && !TIENDAS_SUBS.some(s => s.nombre.toLowerCase() === String(c.nombre || '').toLowerCase().trim()))
        .map(c => ({ nombre: c.nombre, icono: c.icono || '🛍️' })),
    ],
    dominicales: CONSUMO_SUBS,
  };
  const NOMBRES_GRUPO = { consumo: 'Consumo (comidas)', tiendas: 'Tiendas', dominicales: 'Especiales dominicales' };
  const esTienda = grupoCategoria === 'tiendas' || esCategoriaTienda(form.categoria, catList);

  const handleGrupoChange = (e) => {
    const grupo = e.target.value;
    setGrupoCategoria(grupo);
    const nuevoForm = { ...form, categoria: '' };
    setForm(nuevoForm);
    setTocados(t => ({ ...t, categoria: true }));
    setErrores(er => ({ ...er, categoria: grupo ? null : 'Selecciona la subcategoría.' }));
  };

  const validarPaso1 = () => {
    const campos = ['nombreNegocio', 'nombrePropietario', 'direccion', 'valorEmpaque'];
    const errs = {};
    campos.forEach(c => { errs[c] = validarCampoSolicitud(c, form[c], form); });
    setTocados(t => ({ ...t, ...Object.fromEntries(campos.map(k => [k, true])), categoria: true }));
    setErrores(er => ({ ...er, ...errs }));
    if (!grupoCategoria) { toast.error('Selecciona la categoría.'); return false; }
    if (!form.categoria) {
      setErrores(er => ({ ...er, categoria: 'Selecciona la subcategoría.' }));
      toast.error('Selecciona la subcategoría.');
      return false;
    }
    const mal = Object.values(errs).find(Boolean);
    if (mal) { toast.error(mal); return false; }
    return true;
  };

  const validarPaso2 = () => {
    const vTel = validarCampoSolicitud('telefono', form.telefono, form);
    const vMail = validarCampoSolicitud('emailContacto', form.emailContacto, form);
    setTocados(t => ({ ...t, telefono: true, emailContacto: true }));
    setErrores(er => ({ ...er, telefono: vTel, emailContacto: vMail }));
    if (vTel) { toast.error(vTel); return false; }
    if (vMail) { toast.error(vMail); return false; }
    if (!smsVerificado) { toast.error('Debes verificar tu teléfono con el código SMS.'); return false; }
    if (!emailVerificado) { toast.error('Debes verificar tu correo con el código enviado.'); return false; }
    const vRedes = validarCampoSolicitud('redesSociales', form.redesSociales, form);
    const vDesc = validarCampoSolicitud('descripcion', form.descripcion, form);
    if (vRedes || vDesc) {
      setErrores(er => ({ ...er, redesSociales: vRedes, descripcion: vDesc }));
      toast.error(vRedes || vDesc);
      return false;
    }
    return true;
  };

  const irPaso = (n) => {
    setPaso(n);
    guardarBorrador(form, grupoCategoria, productos, n);
    try { turnstileRef.current?.reset(); } catch {}
    setTurnstileToken('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const comercioLoginUrl = () => {
    try {
      const { protocol, hostname } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:5175/login`;
      }
      if (hostname.startsWith('app.')) {
        return `${protocol}//comercio.${hostname.slice(4)}/login`;
      }
    } catch {}
    return 'https://comercio.domipalermo.com/login';
  };

  // Tras enviar la solicitud, redirigir al inicio de sesión de comercios
  useEffect(() => {
    if (!success) return;
    setCuentaAtras(6);
    const t = setInterval(() => {
      setCuentaAtras(c => {
        if (c <= 1) {
          clearInterval(t);
          window.location.href = comercioLoginUrl();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [success]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nuevoForm = { ...form, [name]: value };
    setForm(nuevoForm);
    // Si cambia el dato verificado, hay que verificar de nuevo
    if (name === 'emailContacto' && emailVerificado) {
      setEmailVerificado(false);
      setEmailEnviado(false);
      setEmailCodigo('');
    }
    if (name === 'telefono' && smsVerificado) {
      setSmsVerificado(false);
      setSmsEnviado(false);
      setSmsCodigo('');
      setPruebaSms('');
      setConfirmationResult(null);
    }
    setTocados(t => ({ ...t, [name]: true }));
    setErrores(er => ({ ...er, [name]: validarCampoSolicitud(name, value, nuevoForm) }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const nuevoForm = { ...form, [name]: value };
    setTocados(t => ({ ...t, [name]: true }));
    setErrores(er => ({ ...er, [name]: validarCampoSolicitud(name, value, nuevoForm) }));
  };

  const handleCartaFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCartaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setForm({ ...form, cartaImagen: reader.result });
    reader.readAsDataURL(file);
  };

  const analizarCarta = async () => {
    if (!form.cartaImagen || analizando) return;
    setAnalizando(true);
    try {
      const { data } = await comercios.analizarCarta(form.cartaImagen);
      if (!data.productos?.length) {
        toast.error('No se detectaron productos en la carta. Agrégalos manualmente.');
        return;
      }
      setProductos(data.productos.map((p, idx) => ({
        id: `prod-${Date.now()}-${idx}`,
        nombre: p.nombre || '',
        descripcion: p.descripcion || '',
        precio: p.precio || 0,
        categoria: p.categoria || 'otras',
        imagen: p.imagen || '',
        emoji: p.emoji || '🍴',
        tallas: Array.isArray(p.tallas) ? p.tallas.join(', ') : (p.tallas || ''),
        colores: Array.isArray(p.colores) ? p.colores.join(', ') : (p.colores || ''),
      })));
      toast.success(`Se detectaron ${data.total} productos con imágenes. Revísalos y edita si es necesario.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo analizar la carta con IA.');
    } finally {
      setAnalizando(false);
    }
  };

  const agregarProducto = () => {
    setProductos(ps => [...ps, { 
      id: `prod-${Date.now()}-${ps.length}`, 
      nombre: '', descripcion: '', precio: 0, categoria: 'otras', imagen: '', emoji: '🍴',
      tallas: '', colores: ''
    }]);
  };

  const actualizarProducto = (idx, campo, valor) => {
    setProductos(ps => ps.map((p, i) => i === idx ? { ...p, [campo]: valor } : p));
  };

  const eliminarProducto = (idx) => {
    setProductos(ps => ps.filter((_, i) => i !== idx));
  };

  const handleProductImage = async (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5 MB.');
      return;
    }
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      actualizarProducto(idx, 'imagen', 'uploading');
      const { data } = await uploads.uploadBase64({ file: base64 });
      actualizarProducto(idx, 'imagen', data.url);
      toast.success('Imagen del producto subida.');
    } catch (err) {
      actualizarProducto(idx, 'imagen', '');
      toast.error('No se pudo subir la imagen. Intenta con otra.');
    }
  };

  const handleImagenNegocio = (campo, setSubiendo) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5 MB.');
      return;
    }
    setSubiendo(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await uploads.uploadBase64({ file: base64 });
      setForm(f => ({ ...f, [campo]: data.url }));
      toast.success('Imagen subida.');
    } catch (err) {
      toast.error('No se pudo subir la imagen. Intenta con otra.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleCancel = () => {
    setForm({
      nombreNegocio: '', nombrePropietario: user?.nombre || '', telefono: '',
      direccion: '', horarios: serializarPlan(planPorDefecto()), categoria: '', redesSociales: '',
      descripcion: '', cartaImagen: '', logo: '', fachada: '',
      cobraEmpaque: 'no', tipoEmpaque: 'pedido', valorEmpaque: '',
      ciudad: esNeivaInicial ? 'neiva' : 'palermo',
      emailContacto: user?.email || ''
    });
    setCartaFile(null);
    setProductos([]);
    setGrupoCategoria('');
    setDeclaraDerechos(false);
    setEmailCodigo('');
    setEmailEnviado(false);
    setEmailVerificado(false);
    setSmsCodigo('');
    setSmsEnviado(false);
    setSmsVerificado(false);
    setPruebaSms('');
    setConfirmationResult(null);
    setPaso(1);
    limpiarBorrador();
    setError('');
    setSuccess(false);
    setErrores({});
    setTocados({});
    try { turnstileRef.current?.reset(); } catch {}
    setTurnstileToken('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const todosErrores = {};
    ['nombreNegocio', 'nombrePropietario', 'telefono', 'direccion', 'valorEmpaque', 'emailContacto']
      .forEach(c => { todosErrores[c] = validarCampoSolicitud(c, form[c], form); });
    if (!grupoCategoria) { toast.error('Selecciona la categoría.'); return; }
    if (!form.categoria) { toast.error('Selecciona la subcategoría.'); return; }
    setTocados(Object.fromEntries(Object.keys(form).map(k => [k, true])));
    setErrores(er => ({ ...er, ...todosErrores }));
    const errorMsg = validateSolicitud(form);
    if (errorMsg) { toast.error(errorMsg); return; }
    if (!emailVerificado) { toast.error('Debes verificar tu correo de contacto.'); return; }
    if (!smsVerificado || !pruebaSms) { toast.error('Debes verificar tu teléfono con el código SMS.'); return; }
    if (!aceptaTerminos) { toast.error('Debes aceptar los Términos y Condiciones y la Política de Privacidad.'); return; }
    if (hayImagenes && !declaraDerechos) { toast.error('Debes declarar que tienes derechos sobre las imágenes.'); return; }
    
    setError('');
    setLoading(true);
    try {
      const { cartaImagen, ...formData } = form;
      const dataToSend = {
        ...formData,
        tieneCarta: !!cartaImagen,
        email: form.emailContacto.trim(),
        pruebaSms,
        dominical: grupoCategoria === 'dominicales' ? 'true' : 'false',
        declaraDerechos: hayImagenes ? declaraDerechos : false,
        productos: productos
          .filter(p => p.nombre.trim() && p.imagen !== 'uploading')
          .map(p => ({ 
            ...p, 
            nombre: p.nombre.trim(), 
            precio: Number(p.precio) || 0,
            imagen: p.imagen === 'uploading' ? '' : (p.imagen || ''),
            emoji: p.emoji || '🍴',
            tallas: String(p.tallas || '').split(',').map(s => s.trim()).filter(Boolean),
            colores: String(p.colores || '').split(',').map(s => s.trim()).filter(Boolean)
          })),
        turnstileToken,
      };
      const { data } = await comercios.solicitarRegistro(dataToSend);
      toast.success('Solicitud enviada. Quedó pendiente por aprobar.');
      limpiarBorrador();
      setSuccess(true);
    } catch (err) {
      const detalle = err.response?.data?.details;
      const mensaje = err.response?.data?.error || 'Error al enviar solicitud';
      setError(detalle ? `${mensaje}: ${detalle}` : mensaje);
      toast.error(detalle ? `${mensaje}: ${detalle}` : mensaje);
    } finally {
      try { turnstileRef.current?.reset(); } catch {}
      setTurnstileToken('');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
    fontSize: 14, color: '#374151', transition: 'all 0.2s',
  };

  const estiloCampo = (name) => {
    if (errores[name]) {
      return { ...inputStyle, border: '1px solid #f87171', background: '#fef2f2', color: '#991b1b' };
    }
    return inputStyle;
  };

  const mensajeError = (name) => {
    if (!errores[name]) return null;
    return (
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
        ⚠ {errores[name]}
      </p>
    );
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: '#5E244E' }}>¡Solicitud Enviada!</h2>
          <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
            Hemos recibido tu solicitud de registro.
          </p>
          <p style={{ margin: '12px 0 0', padding: '8px 12px', background: '#FFFBEB', borderRadius: 8, color: '#92400E', fontSize: 13, fontWeight: 600 }}>
            ⏳ Tu solicitud quedó pendiente por aprobar. Te notificaremos cuando sea revisada.
          </p>
          <p style={{ color: '#6b7280', fontSize: 12, margin: '12px 0 0' }}>
            En {cuentaAtras} segundo(s) te llevamos al inicio de sesión de comercios, donde entrarás cuando tu cuenta sea aprobada.
          </p>
          <a href={comercioLoginUrl()} className="btn btn-primary" style={{ width: '100%', textAlign: 'center', textDecoration: 'none', display: 'block', padding: '12px', marginTop: 16, boxSizing: 'border-box' }}>
            Ir a iniciar sesión de comercios
          </a>
          <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ background: 'linear-gradient(135deg, #5E244E, #aa1c41)', padding: '24px 24px 28px', color: '#fff' }}>
        <h1 style={{ fontSize: 22, margin: '12px 0 4px' }}>🏪 Registrar mi Comercio</h1>
        <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
          Completa el formulario para solicitar el registro de tu negocio.
        </p>
      </div>

      <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        {error && (
          <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {analizando && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 340, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', textAlign: 'center' }}>
              <Loader size={90} />
              <h3 style={{ margin: '0 0 8px', color: '#5E244E', fontSize: 18 }}>Procesando tu carta</h3>
              <p style={{ color: '#6b7280', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                La IA está procesando tu carta, este proceso tarda unos segundos.
              </p>
            </div>
          </div>
        )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }} aria-label="Progreso del formulario">
          {['Negocio', 'Contacto', 'Catálogo'].map((label, i) => {
            const n = i + 1;
            const activo = paso === n;
            const hecho = paso > n;
            return (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 6, borderRadius: 4, marginBottom: 4,
                  background: activo || hecho ? 'linear-gradient(to right, #961e44, #6c234b)' : '#e5e7eb',
                }} />
                <span style={{ fontSize: 11, fontWeight: activo ? 700 : 400, color: activo ? '#5E244E' : '#9ca3af' }}>
                  {n}. {label}
                </span>
              </div>
            );
          })}
        </div>

        {paso === 1 && (
        <>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Ciudad</label>
          <select name="ciudad" value={form.ciudad} onChange={handleChange} style={inputStyle}>
            <option value="palermo">Palermo</option>
            <option value="neiva">Neiva</option>
          </select>
        </div>

        {form.ciudad === 'neiva' && (
          <div style={{
            background: 'linear-gradient(135deg, #5c1b3f, #aa1c41)', color: '#fff',
            borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <strong style={{ fontSize: 13 }}>📍 Comercios Neiva</strong>
            <p style={{ fontSize: 12, opacity: 0.95, margin: 0 }}>
              Para Neiva aplica un domicilio fijo de ${(30000).toLocaleString('es-CO')} por pedido y un tiempo estimado de entrega de 1 h 40 min.
            </p>
          </div>
        )}

        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nombre del Negocio *</label>
          <input name="nombreNegocio" value={form.nombreNegocio} onChange={handleChange} onBlur={handleBlur} style={estiloCampo('nombreNegocio')} />
          {mensajeError('nombreNegocio')}
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nombre del Propietario *</label>
          <input name="nombrePropietario" value={form.nombrePropietario} onChange={handleChange} onBlur={handleBlur} style={estiloCampo('nombrePropietario')} />
          {mensajeError('nombrePropietario')}
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Dirección *</label>
          <input name="direccion" value={form.direccion} onChange={handleChange} onBlur={handleBlur} style={estiloCampo('direccion')} />
          {mensajeError('direccion')}
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Categoría *</label>
          <select value={grupoCategoria} onChange={handleGrupoChange} style={inputStyle}>
            <option value="">Seleccionar categoría...</option>
            <option value="consumo">🍔 Consumo (comidas)</option>
            <option value="tiendas">🛍️ Tiendas</option>
            <option value="dominicales">🍽️ Especiales dominicales</option>
          </select>
        </div>
        {grupoCategoria && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>
              Subcategoría de {NOMBRES_GRUPO[grupoCategoria]} *
            </label>
            <select name="categoria" value={form.categoria} onChange={handleChange} style={estiloCampo('categoria')}>
              <option value="">Seleccionar subcategoría...</option>
              {SUBS_POR_GRUPO[grupoCategoria].map(s => (
                <option key={s.nombre} value={s.nombre}>{s.icono} {s.nombre}</option>
              ))}
            </select>
            {mensajeError('categoria')}
          </div>
        )}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>
            Horarios de Atención *
          </label>
          <HorariosSelector value={form.horarios} onChange={horarios => setForm({ ...form, horarios })} />
          <p style={{ fontSize: 12, color: '#999', marginTop: 6, marginBottom: 0 }}>
            Define el horario de cada día. Tu comercio recibirá pedidos automáticamente solo dentro de estos horarios.
          </p>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#5E244E', marginBottom: 8, display: 'block' }}>
            📦 ¿Cobra empaque?
          </label>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
            Indica si cobras un valor adicional por el empaque de los pedidos.
          </p>
          <select name="cobraEmpaque" value={form.cobraEmpaque} onChange={handleChange} style={inputStyle}>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>

          {form.cobraEmpaque === 'si' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Tipo de cobro</label>
                <select name="tipoEmpaque" value={form.tipoEmpaque} onChange={handleChange} style={inputStyle}>
                  <option value="pedido">Por pedido</option>
                  <option value="empaque">Por empaque (unidad)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>
                  Valor {form.tipoEmpaque === 'empaque' ? 'por empaque' : 'por pedido'} (COP)
                </label>
                <input name="valorEmpaque" type="number" min="0" value={form.valorEmpaque} onChange={handleChange} onBlur={handleBlur}
                  placeholder="Ej: 2000" style={estiloCampo('valorEmpaque')} />
                {mensajeError('valorEmpaque')}
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => { if (validarPaso1()) irPaso(2); }}
          style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
            fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
          }}>
          Guardar y continuar →
        </button>
        </>
        )}

        {paso === 2 && (
        <>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#5E244E', marginBottom: 8, display: 'block' }}>
            📱 Teléfono de contacto *
          </label>
          <input name="telefono" value={form.telefono} onChange={handleChange} onBlur={handleBlur}
            placeholder="+57 300 123 4567" style={estiloCampo('telefono')} />
          {mensajeError('telefono')}
          {!smsVerificado ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={enviarCodigoSms} disabled={smsCargando}
                style={{ padding: '10px 14px', borderRadius: 8, background: '#5E244E', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
                {smsCargando ? 'Enviando...' : smsEnviado ? 'Reenviar SMS' : 'Enviar código SMS'}
              </button>
              {smsEnviado && (
                <>
                  <input value={smsCodigo} onChange={e => setSmsCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Código 6 dígitos" inputMode="numeric"
                    style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={confirmarCodigoSms} disabled={smsCargando}
                    style={{ padding: '10px 14px', borderRadius: 8, background: '#aa1c41', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
                    Verificar
                  </button>
                </>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, margin: '8px 0 0' }}>✅ Teléfono verificado</p>
          )}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#5E244E', marginBottom: 8, display: 'block' }}>
            📧 Correo de contacto *
          </label>
          <input name="emailContacto" type="email" value={form.emailContacto} onChange={handleChange} onBlur={handleBlur}
            placeholder="tu@correo.com" style={estiloCampo('emailContacto')} />
          {mensajeError('emailContacto')}
          {!emailVerificado ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={enviarCodigoEmail} disabled={emailCargando}
                style={{ padding: '10px 14px', borderRadius: 8, background: '#5E244E', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
                {emailCargando ? 'Enviando...' : emailEnviado ? 'Reenviar código' : 'Enviar código'}
              </button>
              {emailEnviado && (
                <>
                  <input value={emailCodigo} onChange={e => setEmailCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Código 6 dígitos" inputMode="numeric"
                    style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={confirmarCodigoEmail} disabled={emailCargando}
                    style={{ padding: '10px 14px', borderRadius: 8, background: '#aa1c41', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
                    Verificar
                  </button>
                </>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, margin: '8px 0 0' }}>✅ Correo verificado</p>
          )}
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
            Aquí recibirás el botón para crear tu contraseña cuando tu solicitud sea aprobada.
          </p>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Redes Sociales</label>
          <input name="redesSociales" value={form.redesSociales} onChange={handleChange} onBlur={handleBlur} placeholder="@tunegocio (sin enlaces)" style={estiloCampo('redesSociales')} />
          {mensajeError('redesSociales')}
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Descripción del Negocio</label>
          <textarea name="descripcion" value={form.descripcion} onChange={handleChange} onBlur={handleBlur} rows={3} maxLength={150} placeholder="Cuéntanos de tu negocio (máximo 150 caracteres)" style={estiloCampo('descripcion')} />
          {mensajeError('descripcion')}
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', textAlign: 'right' }}>{(form.descripcion || '').length}/150</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={() => irPaso(1)}
            style={{ padding: '14px 16px', borderRadius: 12, background: '#fff', color: '#5E244E', border: '1px solid #e5e7eb', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            ← Atrás
          </button>
          <button type="button" onClick={() => { if (validarPaso2()) irPaso(3); }}
            style={{ flex: 1, padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Guardar y continuar →
          </button>
        </div>
        </>
        )}

        {paso === 3 && (
        <>
        <div style={{ border: '1px dashed #e68457', borderRadius: 12, padding: 16, background: '#fff8f0' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#5E244E', marginBottom: 8, display: 'block' }}>
            {esTienda ? '📄 Sube tu catálogo de productos (opcional)' : '📄 Sube la carta o menú de tu negocio'}
          </label>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            {esTienda
              ? 'Adjunta una foto o PDF de tu catálogo para que la IA detecte tus productos automáticamente, o agrégalos manualmente abajo.'
              : 'Adjunta una foto o PDF de tu carta para que la IA detecte productos y recorte sus imágenes automáticamente.'}
          </p>
          <input type="file" accept="image/*,application/pdf" onChange={handleCartaFile} style={{ fontSize: 13 }} />

          {cartaFile && (
            <button type="button" onClick={analizarCarta} disabled={analizando}
              style={{ marginTop: 10, width: '100%', background: analizando ? '#d1d5db' : '#e68457', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: analizando ? 'not-allowed' : 'pointer' }}>
              {analizando ? '🤖 Analizando con IA…' : esTienda ? '🤖 Analizar catálogo con IA' : '🤖 Analizar carta con IA'}
            </button>
          )}

          <div style={{ marginTop: 16, borderTop: '1px solid #f3e2d3', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5E244E', marginBottom: 4 }}>
              Productos del negocio (opcional)
            </div>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>
              {productos.length > 0
                ? `Tienes ${productos.length} producto(s) — revisa, edita o elimina:`
                : 'Sin carta puedes agregar tus productos manualmente aquí:'}
            </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {productos.map((p, idx) => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #f0e5eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.imagen && p.imagen !== 'uploading' ? (
                        <img src={p.imagen} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                      ) : p.imagen === 'uploading' ? (
                        <div style={{ width: 48, height: 48, borderRadius: 6, border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#9ca3af' }}>⏳</div>
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 6, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: '#f9fafb', flexShrink: 0 }}>
                          {p.emoji || '🍴'}
                        </div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.imagen === 'uploading' ? (
                          <span style={{ fontSize: 12, color: '#6b7280' }}>⏳ Subiendo imagen a Cloudinary...</span>
                        ) : (
                          <label style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            fontSize: 13, fontWeight: 600, color: p.imagen ? '#166534' : '#5E244E',
                            background: p.imagen ? '#F0FDF4' : '#fff', border: p.imagen ? '1px solid #BBF7D0' : '1px dashed #5E244E',
                            borderRadius: 8, padding: '10px 12px', cursor: 'pointer', minHeight: 44,
                          }}>
                            {p.imagen ? '✅ Imagen lista — toca para cambiarla' : '📷 Subir imagen del producto'}
                            <input type="file" accept="image/*" onChange={e => handleProductImage(idx, e)} style={{ display: 'none' }} />
                          </label>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={p.nombre} onChange={e => actualizarProducto(idx, 'nombre', e.target.value)}
                        placeholder="Nombre del producto" maxLength={100}
                        style={{ ...inputStyle, padding: '10px 12px', flex: 2 }} />
                      <input value={p.precio} onChange={e => actualizarProducto(idx, 'precio', e.target.value.replace(/[^\d.]/g, ''))}
                        placeholder="Precio" inputMode="numeric"
                        style={{ ...inputStyle, padding: '10px 12px', flex: 1 }} />
                      <button type="button" onClick={() => eliminarProducto(idx)} title="Eliminar"
                        style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 8, width: 40, cursor: 'pointer', flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={p.descripcion} onChange={e => actualizarProducto(idx, 'descripcion', e.target.value)}
                        placeholder="Descripción (opcional)" maxLength={300}
                        style={{ ...inputStyle, padding: '10px 12px', flex: 2 }} />
                      <select value={p.categoria} onChange={e => actualizarProducto(idx, 'categoria', e.target.value)}
                        style={{ ...inputStyle, padding: '10px 12px', flex: 1 }}>
                        <option value="entradas">Entradas</option>
                        <option value="platos fuertes">Platos fuertes</option>
                        <option value="acompañamientos">Acompañamientos</option>
                        <option value="bebidas">Bebidas</option>
                        <option value="postres">Postres</option>
                        <option value="combos">Combos</option>
                        <option value="especiales">Especiales</option>
                        <option value="otras">Otras</option>
                      </select>
                    </div>
                    {esTienda && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={p.tallas || ''} onChange={e => actualizarProducto(idx, 'tallas', e.target.value)}
                          placeholder="Tallas (ej: S, M, L)" maxLength={200}
                          style={{ ...inputStyle, padding: '10px 12px', flex: 1 }} />
                        <input value={p.colores || ''} onChange={e => actualizarProducto(idx, 'colores', e.target.value)}
                          placeholder="Colores (ej: Rojo, Azul)" maxLength={200}
                          style={{ ...inputStyle, padding: '10px 12px', flex: 1 }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={agregarProducto}
                style={{ marginTop: 8, background: '#fff', color: '#5E244E', border: '1px dashed #5E244E', borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', minHeight: 48 }}>
                + Agregar producto manualmente
              </button>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#5E244E', marginBottom: 4, display: 'block' }}>
            🏬 Imagen de tu negocio (opcional)
          </label>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>
            Sube el logo y una foto de la fachada de tu negocio. Se mostrarán a los clientes.
            Máx. 5 MB por imagen · JPG, PNG, WebP o HEIC.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
                Logo
              </label>
              {form.logo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={form.logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                  <label style={{ fontSize: 12, color: '#5E244E', fontWeight: 600, cursor: 'pointer' }}>
                    Cambiar
                    <input type="file" accept="image/*" onChange={handleImagenNegocio('logo', setSubiendoLogo)} style={{ display: 'none' }} />
                  </label>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#5E244E', background: '#f9fafb', border: '1px dashed #5E244E', borderRadius: 8, padding: '12px', cursor: 'pointer', minHeight: 48 }}>
                  {subiendoLogo ? '⏳ Subiendo...' : '📷 Subir logo'}
                  <input type="file" accept="image/*" onChange={handleImagenNegocio('logo', setSubiendoLogo)} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
                Fachada del negocio
              </label>
              {form.fachada ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={form.fachada} alt="Fachada" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                  <label style={{ fontSize: 12, color: '#5E244E', fontWeight: 600, cursor: 'pointer' }}>
                    Cambiar
                    <input type="file" accept="image/*" onChange={handleImagenNegocio('fachada', setSubiendoFachada)} style={{ display: 'none' }} />
                  </label>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#5E244E', background: '#f9fafb', border: '1px dashed #5E244E', borderRadius: 8, padding: '12px', cursor: 'pointer', minHeight: 48 }}>
                  {subiendoFachada ? '⏳ Subiendo...' : '🏠 Subir fachada'}
                  <input type="file" accept="image/*" onChange={handleImagenNegocio('fachada', setSubiendoFachada)} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={() => irPaso(2)}
            style={{
              padding: '14px 16px', borderRadius: 12,
              background: '#fff', color: '#5E244E', border: '1px solid #e5e7eb',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
            ← Atrás
          </button>
          <div style={{ flex: 1 }} />
        </div>
        </>
        )}

        {paso === 3 && (
        <>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 14px', marginBottom: 4 }}>
          <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.5 }}>
            ✅ <strong>Sin contraseñas aquí.</strong> Cuando tu solicitud sea aprobada recibirás un correo
            con un botón para crear la contraseña de tu panel.
          </p>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={aceptaTerminos}
            onChange={e => setAceptaTerminos(e.target.checked)}
            style={{ width: 16, height: 16, marginTop: 1, accentColor: '#aa1c41' }} />
          <span>
            Acepto los{' '}
            <Link to="/terminos-condiciones" target="_blank" style={{ color: '#aa1c41', textDecoration: 'underline' }}>Términos y Condiciones</Link>{' '}
            y la{' '}
            <Link to="/politica-datos" target="_blank" style={{ color: '#aa1c41', textDecoration: 'underline' }}>Política de Privacidad</Link>
            {' '}de GoPalermo.
          </span>
        </label>

        {hayImagenes && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={declaraDerechos}
              onChange={e => setDeclaraDerechos(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 1, accentColor: '#aa1c41' }} />
            <span>
              Declaro que las imágenes subidas son de mi autoría o tengo autorización del titular
              (Ley 23 de 1982). Asumo responsabilidad por su contenido.
            </span>
          </label>
        )}

        <Turnstile ref={turnstileRef} action="register" onToken={setTurnstileToken} onExpire={() => {
          // El token expira a los ~5 min (ej. mientras sube imágenes): renovarlo solo
          setTurnstileToken('');
          setTimeout(() => { try { turnstileRef.current?.reset(); } catch {} }, 1500);
        }} onError={() => {
          setTurnstileToken('');
          setTimeout(() => { try { turnstileRef.current?.reset(); } catch {} }, 1500);
        }} />
        {TURNSTILE_ENABLED && !turnstileToken && (
          <button type="button" onClick={() => { try { turnstileRef.current?.reset(); } catch {} toast.info('Completa la verificación para continuar.'); }}
            style={{ fontSize: 12, color: '#aa1c41', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 4 }}>
            ↻ Revalidar verificación de seguridad
          </button>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={() => irPaso(2)} disabled={loading}
            style={{
              padding: '14px 16px', borderRadius: 12,
              background: '#fff', color: '#5E244E', border: '1px solid #e5e7eb',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}>
            ← Atrás
          </button>
          <button type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
              fontSize: 15, fontWeight: 600, border: 'none',
              cursor: loading || (TURNSTILE_ENABLED && !turnstileToken) ? 'not-allowed' : 'pointer',
              opacity: (TURNSTILE_ENABLED && !turnstileToken) || loading ? 0.6 : 1,
            }}>
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
          <button type="button" onClick={handleCancel} disabled={loading}
            style={{
              padding: '14px 16px', borderRadius: 12,
              background: '#fff', color: '#991b1b', border: '2px solid #fca5a5',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}>
            Cancelar
          </button>
        </div>
        </>
        )}
      </form>
      </div>
    </div>
  );
}