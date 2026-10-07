import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import { useToast } from '../components/Toast';
import { validateResetPassword } from '../utils/validation';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error('Token inválido. Solicita un nuevo cambio de contraseña.');
      return;
    }

    const validationError = validateResetPassword(newPassword, confirmPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const { data } = await auth.resetPassword(token, newPassword);
      setSuccess(data.message);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12,
    border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
    fontSize: 14, color: '#374151', transition: 'all 0.2s',
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: '#f8f9fa',
        fontFamily: "'Poppins', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#991B1B', marginBottom: 16 }}>Enlace inválido</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>El enlace no contiene un token válido.</p>
          <Link to="/olvide-password" style={{ color: '#aa1c41', fontWeight: 600 }}>Solicitar nuevo enlace</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: '#f8f9fa',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#5e244e', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Nueva Contraseña
          </h1>
          <p style={{ color: '#e68457', fontSize: 14 }}>
            Ingresa tu nueva contraseña.
          </p>
        </div>

        {success && (
          <div style={{
            background: '#D1FAE5', color: '#065F46', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>
            {success} Redirigiendo al inicio de sesión...
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Nueva contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 12 caracteres"
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Confirmar contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => { e.target.style.borderColor = '#e68457'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          <button type="button" onClick={() => setShowPassword(!showPassword)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showPassword
                ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              }
            </svg>
            Mostrar contraseñas
          </button>

          <button
            type="submit" disabled={loading || !!success}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 8, opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Guardando...' : 'Restablecer contraseña'}
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
