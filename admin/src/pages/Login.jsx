import { useState, useRef } from 'react';
import { auth } from '../services/api';
import { useAuth } from '../App';
import { requestFcmToken } from '../services/firebase';
import Turnstile from '../components/Turnstile';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (data.user.rol !== 'admin') {
        setError('Acceso solo para administradores');
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

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#f8f9fa'
    }}>
      <div className="form-card" style={{ width: 380 }}>
      {/* <h2 style={{textAlign: 'center', color: 'var(--primary)', fontSize: 40, marginBottom: 8, fontWeight: 'bold'
        }}>GoPalermo</h2> */}
        <h2 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: 24 }}>GoPalermo Admin</h2>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: 'var(--danger)', marginBottom: 16, fontSize: 14 }}>{error}</div>}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Turnstile ref={turnstileRef} action="login" onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
