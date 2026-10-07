import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { servicios, uploads } from '../services/api';
import { useAuth } from '../App';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import { useToast } from '../components/Toast';
import { validateRegistroServicio } from '../utils/validation';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
  fontSize: 14, color: '#374151', boxSizing: 'border-box',
};

export default function RegistroServicio() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    tipoPersona: 'natural',
    nombre: '',
    servicio: '',
    descripcion: '',
    telefono: user?.telefono || '',
    logo: '',
    imagen: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({ logo: false, imagen: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const logoRef = useRef(null);
  const imagenRef = useRef(null);
  const turnstileRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImage = async (campo, e) => {
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
    setUploadingImg(prev => ({ ...prev, [campo]: true }));
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await uploads.uploadBase64({ file: base64 });
      setForm(prev => ({ ...prev, [campo]: data.url }));
      toast.success(campo === 'logo' ? 'Logo subido correctamente.' : 'Imagen del negocio subida.');
    } catch (err) {
      toast.error('No se pudo subir la imagen. Intenta con otra.');
    } finally {
      setUploadingImg(prev => ({ ...prev, [campo]: false }));
    }
  };

  const quitarImagen = (campo) => {
    setForm(prev => ({ ...prev, [campo]: '' }));
    if (campo === 'logo' && logoRef.current) logoRef.current.value = '';
    if (campo === 'imagen' && imagenRef.current) imagenRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorMsg = validateRegistroServicio(form);
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    if (!aceptaTerminos) { toast.error('Debes aceptar los Términos y Condiciones y la Política de Privacidad.'); return; }
    setError('');
    setLoading(true);
    try {
      await servicios.registroProveedor({ ...form, turnstileToken });
      toast.success('Solicitud enviada correctamente.');
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al enviar el registro. Intenta nuevamente.';
      setError(msg);
      toast.error(msg);
    } finally {
      try { turnstileRef.current?.reset(); } catch {}
      setTurnstileToken('');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#5E244E', fontSize: 20 }}>¡Solicitud Enviada!</h3>
          <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>
            Tu solicitud está pendiente de aprobación. Cuando sea autorizada, tu servicio aparecerá en la app.
          </p>
          <Link to="/" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', textDecoration: 'none', display: 'block', padding: '12px' }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ background: 'linear-gradient(135deg, #5E244E, #aa1c41)', padding: '24px 24px 28px', color: '#fff' }}>
        <h1 style={{ fontSize: 22, margin: '12px 0 4px' }}>🛠️ Ofrece tu servicio</h1>
        <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
          Ofrece tu servicio en la app pagando una tarifa mensual.
        </p>
      </div>

      <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        {error && (
          <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Tipo de persona *</label>
          <select name="tipoPersona" value={form.tipoPersona} onChange={handleChange} style={inputStyle}>
            <option value="natural">Natural</option>
            <option value="juridica">Jurídica</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nombre *</label>
          <input name="nombre" value={form.nombre} onChange={handleChange} style={inputStyle} placeholder="Nombre de la persona o empresa" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Servicio *</label>
          <input name="servicio" value={form.servicio} onChange={handleChange} style={inputStyle} placeholder="Ej: transporte de carga" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Descripción</label>
          <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows={3} style={inputStyle} placeholder="Describe el servicio que ofreces" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Teléfono de contacto *</label>
          <input name="telefono" value={form.telefono} onChange={handleChange} style={inputStyle} placeholder="+57 300 123 4567" />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            🖼️ Logo del negocio <span style={{ fontWeight: 400, color: '#6b7280' }}>(opcional)</span>
          </label>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
            Se mostrará junto a tu nombre en el listado de servicios.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {form.logo && form.logo !== 'uploading' && (
              <img src={form.logo} alt="Logo" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />
            )}
            {form.logo ? (
              <button type="button" onClick={() => quitarImagen('logo')} disabled={uploadingImg.logo}
                style={{ ...inputStyle, width: 'auto', background: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA', cursor: 'pointer' }}>
                Quitar logo
              </button>
            ) : (
              <button type="button" onClick={() => logoRef.current?.click()} disabled={uploadingImg.logo}
                style={{ ...inputStyle, width: 'auto', color: '#5E244E', borderStyle: 'dashed', cursor: 'pointer' }}>
                {uploadingImg.logo ? 'Subiendo...' : '📷 Subir logo'}
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage('logo', e)} />
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            🏪 Imagen del negocio <span style={{ fontWeight: 400, color: '#6b7280' }}>(opcional)</span>
          </label>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
            Se mostrará en la portada de tu perfil al abrir el detalle.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {form.imagen && form.imagen !== 'uploading' && (
              <img src={form.imagen} alt="Negocio" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />
            )}
            {form.imagen ? (
              <button type="button" onClick={() => quitarImagen('imagen')} disabled={uploadingImg.imagen}
                style={{ ...inputStyle, width: 'auto', background: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA', cursor: 'pointer' }}>
                Quitar imagen
              </button>
            ) : (
              <button type="button" onClick={() => imagenRef.current?.click()} disabled={uploadingImg.imagen}
                style={{ ...inputStyle, width: 'auto', color: '#5E244E', borderStyle: 'dashed', cursor: 'pointer' }}>
                {uploadingImg.imagen ? 'Subiendo...' : '📷 Subir imagen'}
              </button>
            )}
            <input ref={imagenRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage('imagen', e)} />
          </div>
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

          <Turnstile ref={turnstileRef} action="register" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />

        <button type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
            fontSize: 15, fontWeight: 600, border: 'none',
            cursor: loading || (TURNSTILE_ENABLED && !turnstileToken) ? 'not-allowed' : 'pointer',
            opacity: (TURNSTILE_ENABLED && !turnstileToken) || loading ? 0.6 : 1,
            marginTop: 8
          }}>
          {loading ? 'Enviando...' : 'Registrar Servicio'}
        </button>
      </form>
      </div>
    </div>
  );
}