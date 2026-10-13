import { useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
import logo from '/GoPalermoOscuro.svg';

export default function CrearPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);

  const validar = () => {
    if (password.length < 12) return 'Mínimo 12 caracteres.';
    if (!/[A-Z]/.test(password)) return 'Debe tener una mayúscula.';
    if (!/[a-z]/.test(password)) return 'Debe tener una minúscula.';
    if (!/[0-9]/.test(password)) return 'Debe tener un número.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Debe tener un símbolo.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const v = validar();
    if (v) { setError(v); return; }
    if (!token) { setError('Enlace inválido.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/crear-password-comercio', { token, password, turnstileToken });
      setOk(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details || 'No se pudo crear la contraseña.');
      try { turnstileRef.current?.reset(); } catch {}
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
      background: '#f8f9fa', fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={logo} alt="GoPalermo" style={{ width: 110, height: 'auto', marginBottom: 12 }} />
          <h1 style={{ color: '#5e244e', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            Crea tu contraseña
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            Tu comercio fue aprobado. Define la clave de tu panel.
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {ok ? (
          <div style={{ background: '#F0FDF4', color: '#166534', padding: '16px', borderRadius: 12, fontSize: 14, textAlign: 'center', fontWeight: 600 }}>
            ✅ Contraseña creada. Te llevamos al inicio de sesión...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Nueva contraseña" autoComplete="new-password" required
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
            <div style={{ position: 'relative' }}>
              <input type={ver ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Confirma tu contraseña" autoComplete="new-password" required
                style={{ width: '100%', padding: '12px 48px 12px 16px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setVer(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                {ver ? '🙈' : '👁️'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.
            </p>
            <Turnstile ref={turnstileRef} action="register" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />
            <button type="submit" disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: loading || (TURNSTILE_ENABLED && !turnstileToken) ? '#aa1c4180' : '#aa1c41', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'wait' : (TURNSTILE_ENABLED && !turnstileToken) ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Creando...' : 'Crear contraseña e ir a iniciar sesión'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <Link to="/login" style={{ color: '#aa1c41', fontWeight: 600, textDecoration: 'none' }}>
            Ir a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
