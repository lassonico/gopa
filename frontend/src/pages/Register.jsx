import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/api';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import { useToast } from '../components/Toast';
import { validateRegister } from '../utils/validation';
import { useAuth } from '../App';
import { requestFcmToken } from '../services/firebase';
import logo from '/GoPalermoOscuro.svg';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '', direccion: '', confirmPassword: '', mayorEdad: false });
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
    return () => { document.body.removeChild(script); };
  }, []);

  const handleGoogleRegister = () => {
    if (!form.mayorEdad) {
      toast.error('Debes confirmar que eres mayor de 18 años.');
      return;
    }
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

  const handleChange = e => setForm({
    ...form,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateRegister(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    try {
      const { data } = await auth.register({ ...form, turnstileToken });
      login(data.user, data.token);
      try { const fcmToken = await requestFcmToken(); if (fcmToken) await auth.updateFcmToken(fcmToken); } catch {}
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrarse');
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
          <img src={logo} alt="GoPalermo" style={{ width: 220, height: 'auto', marginBottom: 16 }} />
          <h1 style={{ color: '#5e244e', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Únete a GoPalermo
          </h1>
          <p style={{ color: '#e68457', fontSize: 14 }}>
            Crea tu cuenta para empezar a pedir.
          </p>
        </div>

        <button
          onClick={handleGoogleRegister}
          disabled={googleLoading || !gsiReady}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #e5e7eb',
            background: '#fff', color: '#374151', fontSize: 14, fontWeight: 500,
            cursor: (googleLoading || !gsiReady) ? 'not-allowed' : 'pointer',
            opacity: (googleLoading || !gsiReady) ? 0.7 : 1,
            transition: 'all 0.2s', marginBottom: 24,
          }}
        >
          {googleLoading ? 'Autenticando...' : !gsiReady ? 'Cargando...' : (
            <>
              <GoogleIcon />
              Registrarse con Google
            </>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ padding: '0 16px', fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
            O continúa con email
          </span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Nombre completo
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej. Juan Pérez"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Correo electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@correo.com"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Teléfono
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <input name="telefono" type="tel" value={form.telefono} onChange={handleChange} placeholder="+57 300 123 4567"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Dirección
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Cra 15 #85-42, Palermo"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="••••••••"
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
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, marginLeft: 4 }}>
              Mínimo 12 caracteres, una mayúscula, una minúscula, un número y un símbolo.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Confirmar contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <Turnstile ref={turnstileRef} action="register" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" name="mayorEdad" checked={!!form.mayorEdad} onChange={handleChange}
              style={{ width: 18, height: 18, marginTop: 1, accentColor: '#aa1c41' }} />
            <span>Confirmo que soy mayor de 18 años *</span>
          </label>

          <button
            type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: loading || (TURNSTILE_ENABLED && !turnstileToken) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 8, opacity: (TURNSTILE_ENABLED && !turnstileToken) || loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Cargando...' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#6b7280' }}>
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" style={{ color: '#aa1c41', fontWeight: 600, textDecoration: 'none' }}>
            Inicia sesión
          </Link>
        </p>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
          Al registrarte, aceptas nuestros{' '}
          <Link to="/terminos-condiciones" style={{ color: '#6b7280', textDecoration: 'underline' }}>Términos de servicio</Link> y{' '}
          <Link to="/politica-datos" style={{ color: '#6b7280', textDecoration: 'underline' }}>Política de privacidad</Link>.
        </p>
      </div>
    </div>
  );
}
