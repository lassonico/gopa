import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/api';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import { useToast } from '../components/Toast';
import { validateLogin } from '../utils/validation';
import { useAuth } from '../App';
import { requestFcmToken } from '../services/firebase';
import logo from '/GoPalermoClaro.svg';
import DataPixelArc from '../components/DataPixelArc';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);
  const toast = useToast();
  const { login } = useAuth();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setGsiReady(true);
    script.onerror = () => setGsiReady(false);
    document.body.appendChild(script);
  }, []);

  const handleGoogleLogin = () => {
    if (!window.google?.accounts?.oauth2) {
      toast.error('Error al cargar Google Sign-In. Recarga la página e inténtalo de nuevo.');
      return;
    }
    setGoogleLoading(true);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        scope: 'openid email profile',
        callback: async (resp) => {
          if (resp?.error || !resp?.access_token) {
            setGoogleLoading(false);
            toast.error(resp?.error === 'access_denied'
              ? 'No autorizaste el acceso con Google.'
              : 'No se pudo iniciar sesión con Google.');
            return;
          }
          try {
            const { data } = await auth.googleLogin({ access_token: resp.access_token });
            login(data.user, data.token);
            try { const fcmToken = await requestFcmToken(); if (fcmToken) await auth.updateFcmToken(fcmToken); } catch {}
          } catch (err) {
            toast.error(err.response?.data?.error || 'Error al autenticar con Google');
          } finally {
            setGoogleLoading(false);
          }
        },
        error_callback: () => {
          setGoogleLoading(false);
        },
      });
      client.requestAccessToken();
    } catch {
      setGoogleLoading(false);
      toast.error('Error al conectar con Google.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateLogin({ email, password });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    try {
      const { data } = await auth.login({ email, password, turnstileToken });
      login(data.user, data.token);
      try { const fcmToken = await requestFcmToken(); if (fcmToken) await auth.updateFcmToken(fcmToken); } catch {}
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      try { turnstileRef.current?.reset(); } catch {}
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12,
    border: '1px solid rgba(254,231,179,0.35)', background: 'transparent', outline: 'none',
    fontSize: 14, color: '#fee7b3', transition: 'all 0.2s',
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: '#6C234B',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <DataPixelArc
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', minWidth: 0, minHeight: 0,
        }}
      />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backdropFilter: 'blur(13px)', WebkitBackdropFilter: 'blur(13px)',
      }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={logo} alt="GoPalermo" style={{ width: 250, height: 'auto', marginBottom: 16 }} />
          <h1 style={{ color: '#fee7b3', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Plermo en un solo lugar
          </h1>
          <p style={{ color: '#fee7b3', fontSize: 14 }}>
            Inicia sesion
          </p>
        </div>

        <div style={{
          background: 'transparent',
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          border: '1px solid rgba(254,231,179,0.15)',
        }}>
          <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || !gsiReady}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '12px 16px', borderRadius: 12,
            border: '1px solid rgba(254,231,179,0.35)',
            background: 'transparent',
            color: '#fee7b3', fontSize: 14, fontWeight: 500,
            cursor: (googleLoading || !gsiReady) ? 'not-allowed' : 'pointer',
            opacity: (googleLoading || !gsiReady) ? 0.7 : 1,
            transition: 'all 0.2s', marginBottom: 24,
          }}
        >
          {googleLoading ? 'Autenticando...' : !gsiReady ? 'Cargando...' : (
            <>
              <GoogleIcon />
              Continuar con Google
            </>
          )}
        </button>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#ffffff', marginBottom: 6, marginLeft: 4 }}>
              Correo electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#fee7b3', opacity: 0.7 }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                style={inputStyle}
                className="login-glass"
                onFocus={e => { e.target.style.borderColor = '#e68457'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(254,231,179,0.35)'; }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginLeft: 4, marginRight: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>Contraseña</label>
              <Link to="/olvide-password" style={{ fontSize: 12, color: '#E58357', fontWeight: 500 }}>¿Olvidaste tu contraseña?</Link>
            </div>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#fee7b3', opacity: 0.7 }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: 44 }}
                className="login-glass"
                onFocus={e => { e.target.style.borderColor = '#e68457'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(254,231,179,0.35)'; }}
              />
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#fee7b3', cursor: 'pointer', padding: 4 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                </svg>
              </button>
            </div>
          </div>

          <Turnstile ref={turnstileRef} action="login" theme="dark" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />
          <button
            type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: '#e58357', color: '#fff',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : (TURNSTILE_ENABLED && !turnstileToken) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 8, opacity: (TURNSTILE_ENABLED && !turnstileToken) ? 0.6 : 1,
            }}
          >
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#f0e6ee' }}>
          ¿No tienes una cuenta?{' '}
          <Link to="/register" style={{ color: '#E58357', fontWeight: 600, textDecoration: 'none' }}>
            Regístrate gratis
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
