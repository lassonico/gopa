import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/api';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import logo from '/GoPalermoClaro.svg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileRef = useRef(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await auth.recoverPassword(email, turnstileToken);
      setSuccess(data.message || 'Si el correo existe, recibirás instrucciones.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      try { turnstileRef.current?.reset(); } catch {}
      setTurnstileToken('');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
    fontSize: 14, color: '#374151', transition: 'all 0.2s', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
      background: '#f8f9fa',
      fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 400, margin: 'auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logo} alt="GoPalermo" style={{ width: 120, height: 'auto', marginBottom: 16 }} />
          <h1 style={{ color: '#5e244e', fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            Recuperar Contraseña
          </h1>
          <p style={{ color: '#e68457', fontSize: 14, margin: 0 }}>
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
        {error && (
          <div style={{
            background: '#FEF2F2', color: '#991B1B', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Correo electrónico
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              style={inputStyle}
            />
          </div>

          <Turnstile ref={turnstileRef} action="recover-password" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => { setTurnstileToken(''); setTurnstileError(true); }} />

          {turnstileError && (
            <p style={{ fontSize: 11, color: '#92400E', background: '#FFFBEB', borderRadius: 8, padding: '8px 10px', margin: 0 }}>
              El verificador de seguridad no se pudo cargar en este dominio. Aún puedes intentar enviar.
            </p>
          )}

          <button
            type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken && !turnstileError)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: loading || (TURNSTILE_ENABLED && !turnstileToken && !turnstileError) ? '#aa1c4180' : '#aa1c41', color: '#fff',
              fontSize: 15, fontWeight: 600, border: 'none',
              cursor: loading || (TURNSTILE_ENABLED && !turnstileToken && !turnstileError) ? 'not-allowed' : 'pointer',
              opacity: (TURNSTILE_ENABLED && !turnstileToken && !turnstileError) ? 0.6 : 1,
              transition: 'all 0.2s', marginTop: 8,
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
