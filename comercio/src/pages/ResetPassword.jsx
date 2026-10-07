import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import logo from '/GoPalermoClaro.svg';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Token inválido. Solicita un nuevo cambio de contraseña.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/.test(newPassword)) {
      setError('La contraseña debe tener mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await auth.resetPassword(token, newPassword);
      setSuccess(data.message || 'Contraseña actualizada correctamente.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none',
    fontSize: 14, color: '#374151', transition: 'all 0.2s', boxSizing: 'border-box',
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: '#f8f9fa', fontFamily: "'Poppins', sans-serif", textAlign: 'center',
      }}>
        <h2 style={{ color: '#991B1B', marginBottom: 16 }}>Enlace inválido</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          Este enlace no es válido o está incompleto. Solicita un nuevo cambio de contraseña.
        </p>
        <Link to="/forgot-password" style={{ color: '#aa1c41', fontWeight: 600, textDecoration: 'none' }}>
          Solicitar nuevo enlace
        </Link>
      </div>
    );
  }

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
            Nueva Contraseña
          </h1>
          <p style={{ color: '#e68457', fontSize: 14, margin: 0 }}>
            Define tu nueva contraseña para el panel.
          </p>
        </div>

        {success && (
          <div style={{
            background: '#D1FAE5', color: '#065F46', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>
            {success} Redirigiendo al login…
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
              Nueva contraseña
            </label>
            <input
              type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, marginLeft: 4 }}>
              Confirmar contraseña
            </label>
            <input
              type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, marginLeft: 4 }}>
              Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.
            </p>
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: loading ? '#aa1c4180' : '#aa1c41', color: '#fff',
              fontSize: 15, fontWeight: 600, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 8,
            }}
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
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
