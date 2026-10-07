import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { solicitudes } from '../services/api';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import { useToast } from '../components/Toast';
import { validateRegistroDomiciliario } from '../utils/validation';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
  fontSize: 14, color: '#374151', boxSizing: 'border-box',
};

export default function RegistroDomiciliario() {
  const [form, setForm] = useState({
    nombre: '',
    tipoDocumento: '',
    numeroDocumento: '',
    telefono: '',
    email: '',
    tipoVehiculo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const turnstileRef = useRef(null);
  const toast = useToast();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateRegistroDomiciliario(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!aceptaTerminos) { toast.error('Debes aceptar los Términos y Condiciones y la Política de Privacidad.'); return; }
    setLoading(true);
    try {
      await solicitudes.registroDomiciliario({ ...form, turnstileToken });
      toast.success('Solicitud enviada. Quedó pendiente por aprobar.');
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al enviar la solicitud. Intenta nuevamente.';
      setError(msg);
      toast.error(msg);
      try { turnstileRef.current?.reset(); } catch {}
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h3 style={{ margin: '0 0 8px', color: '#5E244E', fontSize: 20 }}>¡Solicitud Enviada!</h3>
          <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: 14 }}>
            Hemos recibido tu solicitud para ser domiciliario.
          </p>
          <p style={{ margin: '0 0 24px', padding: '8px 12px', background: '#FFFBEB', borderRadius: 8, color: '#92400E', fontSize: 13, fontWeight: 600 }}>
            ⏳ Tu solicitud quedó pendiente por aprobar. Te contactaremos cuando sea revisada.
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
        <h1 style={{ fontSize: 22, margin: '12px 0 4px' }}>🛵 Sé domiciliario</h1>
        <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
          Completa el formulario para solicitar unirte a nuestro equipo de repartidores.
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
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nombre completo *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} maxLength={100} style={inputStyle} placeholder="Nombre completo" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Tipo de documento *</label>
            <select name="tipoDocumento" value={form.tipoDocumento} onChange={handleChange} style={inputStyle}>
              <option value="">Seleccionar...</option>
              <option value="Cédula de ciudadanía">Cédula de ciudadanía</option>
              <option value="Cédula de extranjería">Cédula de extranjería</option>
              <option value="Pasaporte">Pasaporte</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Número de documento *</label>
            <input name="numeroDocumento" value={form.numeroDocumento} onChange={handleChange} inputMode="numeric" maxLength={15} style={inputStyle} placeholder="Número de documento" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Teléfono *</label>
            <input name="telefono" value={form.telefono} onChange={handleChange} style={inputStyle} placeholder="+57 300 123 4567" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Correo electrónico *</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} maxLength={255} style={inputStyle} placeholder="tu@correo.com" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Tipo de vehículo *</label>
            <select name="tipoVehiculo" value={form.tipoVehiculo} onChange={handleChange} style={inputStyle}>
              <option value="">Seleccionar...</option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Moto">Moto</option>
            </select>
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
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
}
