import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/api';
import { useAuth } from '../App';
import { requestFcmToken } from '../services/firebase';
import Turnstile from '../components/Turnstile';
import logo from '/GoPalermoOscuro.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await auth.login({ email, password, turnstileToken });
      if (data.user.rol !== 'comercio') {
        setError('Acceso solo para comercios');
        return;
      }
      login(data.user, data.token);
      try { const fcmToken = await requestFcmToken(); if (fcmToken) await auth.updateFcmToken(fcmToken); } catch {}
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
      try { turnstileRef.current?.reset(); } catch {}
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12,
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
          <img src={logo} alt="GoPalermo" style={{ width: 220, height: 'auto', marginBottom: 16 }} />
          <h1 style={{ color: '#5e244e', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Comercio
          </h1>
          <p style={{ color: '#e68457', fontSize: 14 }}>
            Panel de control para tu negocio
          </p>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', color: '#991B1B', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Correo electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com" required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginLeft: 4, marginRight: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Contraseña</label>
            </div>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                </svg>
              </button>
            </div>
          </div>

          <Turnstile ref={turnstileRef} action="login" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: loading ? '#aa1c4180' : '#aa1c41', color: '#fff',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 8,
            }}
          >
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <Link to="/forgot-password" style={{ color: '#aa1c41', fontWeight: 600, textDecoration: 'none' }}>
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </div>
  );
}