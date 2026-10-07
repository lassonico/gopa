import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/api';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import { useToast } from '../components/Toast';
import { validateForgotPassword } from '../utils/validation';
import logo from '/GoPalermoClaro.svg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForgotPassword(email);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    try {
      const { data } = await auth.recoverPassword(email, turnstileToken);
      setSuccess(data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      try { turnstileRef.current?.reset(); } catch {}
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12,
    border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
    fontSize: 14, color: '#374151', transition: 'all 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: '#f8f9fa',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logo} alt="GoPalermo" style={{ width: 120, height: 'auto', marginBottom: 16 }} />
          <h1 style={{ color: '#5e244e', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Recuperar Contraseña
          </h1>
          <p style={{ color: '#e68457', fontSize: 14 }}>
            Ingresa tu correo y te enviaremos instrucciones.
          </p>
        </div>

        {success && (
          <div style={{
            background: '#D1FAE5', color: '#065F46', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Correo electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <Turnstile ref={turnstileRef} action="recover-password" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />
          <button
            type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: loading || (TURNSTILE_ENABLED && !turnstileToken) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 8, opacity: (TURNSTILE_ENABLED && !turnstileToken) || loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Enviando...' : 'Enviar instrucciones'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#6b7280' }}>
          <Link to="/login" style={{ color: '#aa1c41', fontWeight: 600, textDecoration: 'none' }}>
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
