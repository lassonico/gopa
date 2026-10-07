import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { users, uploads } from '../services/api';
import { useAuth } from '../App';
import api from '../services/api';
import { useToast } from '../components/Toast';
import { auth } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import InstallButton from '../components/InstallButton';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box'
};

const normalizarTelefonoCo = (t) => {
  const d = String(t || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.length === 10) return `+57${d}`;
  if (d.length === 11 && d.startsWith('0')) return `+57${d.slice(1)}`;
  return d;
};

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 14, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#111827', fontSize: 14, fontWeight: 500, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</span>
    </div>
  );
}

// Correos largos: recorta con puntos suspensivos antes del @
// ej: extraordinariamentelargo@gmail.com → extraordin…@gmail.com
function acortarEmail(email, maxLocal = 12) {
  const v = String(email || '');
  const at = v.indexOf('@');
  if (at === -1) return v.length > 24 ? v.slice(0, 24) + '…' : v;
  const local = v.slice(0, at);
  const dominio = v.slice(at);
  if (local.length <= maxLocal) return v;
  return local.slice(0, maxLocal) + '…' + dominio;
}

function Modal({ show, title, message, onConfirm, onCancel, confirmText, loading, type, children }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📋'}
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#5E244E', fontSize: 20 }}>{title}</h3>
          <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>{message}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {onCancel && (
              <button onClick={onCancel} disabled={loading}
                style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {onCancel ? 'Volver' : 'Cerrar'}
              </button>
            )}
            {onConfirm && (
              <button onClick={onConfirm} disabled={loading}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Enviando...' : confirmText || 'Confirmar'}
              </button>
            )}
            {!onConfirm && (
              <button onClick={onCancel}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cerrar
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
  );
}

export default function Perfil() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const eliminarCuenta = async () => {
    setEliminando(true);
    try {
      await users.eliminarCuenta(user.id);
      try {
        Object.keys(localStorage).filter(k => k.startsWith('api_cache_') || k.startsWith('avatar_')).forEach(k => localStorage.removeItem(k));
      } catch {}
      logout();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la cuenta');
      setConfirmEliminar(false);
    } finally {
      setEliminando(false);
    }
  };
  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    telefono: user?.telefono || '',
    direccion: user?.direccion || '',
    password: '',
    confirmPassword: ''
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);

  // Cargar avatar: primero el del servidor, respaldo en localStorage
  useEffect(() => {
    if (user?.avatar) {
      setAvatarPreview(user.avatar);
    } else {
      const savedAvatar = localStorage.getItem(`avatar_${user?.id}`);
      if (savedAvatar) setAvatarPreview(savedAvatar);
    }
  }, [user?.id, user?.avatar]);
  
  // Report problem modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    problema: ''
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Phone verification modal state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneTel, setPhoneTel] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState(null);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaContainerRef = useRef(null);
  const toast = useToast();

  const telefonoVerificado = String(user?.telefonoVerificado) === '1' || String(user?.telefonoVerificado) === 'true';

  useEffect(() => {
    if (!phoneCooldown) return;
    const t = setInterval(() => setPhoneCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [phoneCooldown > 0]);

  const openPhoneModal = () => {
    setPhoneMsg(null);
    setPhoneCode('');
    setPhoneSent(false);
    setPhoneTel(user?.telefono ? normalizarTelefonoCo(user.telefono) : '');
    setConfirmationResult(null);
    setShowPhoneModal(true);
  };

  const closePhoneModal = () => {
    setShowPhoneModal(false);
    setPhoneCode('');
    setPhoneSent(false);
    setPhoneMsg(null);
    setConfirmationResult(null);
  };

  const enviarCodigo = async () => {
    if (!phoneTel.trim()) {
      setPhoneMsg({ type: 'error', text: 'Escribe tu número de teléfono para recibir el código.' });
      return;
    }
    if (!auth) {
      setPhoneMsg({ type: 'error', text: 'Firebase no está configurado.' });
      return;
    }
    setPhoneLoading(true);
    setPhoneMsg(null);
    try {
      const formattedPhone = normalizarTelefonoCo(phoneTel);
      if (!formattedPhone) {
        throw new Error('Número inválido');
      }
      if (!recaptchaContainerRef.current) {
        recaptchaContainerRef.current = document.createElement('div');
        recaptchaContainerRef.current.style.display = 'none';
        document.body.appendChild(recaptchaContainerRef.current);
      }
      const appVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
      });
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setPhoneSent(true);
      setPhoneMsg({ type: 'success', text: 'Código enviado por mensaje de texto.' });
      setPhoneCooldown(60);
    } catch (err) {
      console.error('Error enviando código:', err);
      setPhoneMsg({ type: 'error', text: err.message || 'No se pudo enviar el código. Inténtalo de nuevo.' });
    } finally {
      setPhoneLoading(false);
    }
  };

  const verificarCodigo = async (e) => {
    e.preventDefault();
    if (!confirmationResult) {
      setPhoneMsg({ type: 'error', text: 'Solicita el código primero.' });
      return;
    }
    setPhoneLoading(true);
    setPhoneMsg(null);
    try {
      const result = await confirmationResult.confirm(phoneCode);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();
      const verifiedPhone = firebaseUser.phoneNumber || normalizarTelefonoCo(phoneTel);

      const { data } = await users.verificarCodigoFirebase(user.id, { idToken, phoneNumber: verifiedPhone });
      const token = localStorage.getItem('token');
      login(data.user, token);
      toast.success('Número de teléfono verificado.');
      closePhoneModal();
    } catch (err) {
      console.error('Error verificando código:', err);
      setPhoneMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Código incorrecto.' });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5 MB.');
      return;
    }
    setSubiendoAvatar(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAvatarPreview(base64);
      const { data } = await uploads.uploadBase64({ file: base64 });
      const { data: updatedUser } = await users.update(user.id, { avatar: data.url });
      const token = localStorage.getItem('token');
      login(updatedUser, token);
      setAvatarPreview(data.url);
      try { localStorage.setItem(`avatar_${user.id}`, data.url); } catch {}
      setSuccess('Foto de perfil actualizada');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir la foto. Intenta con otra.');
    } finally {
      setSubiendoAvatar(false);
    }
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password && form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      const data = {};
      if (form.nombre !== user.nombre) data.nombre = form.nombre;
      if (form.telefono !== user.telefono) data.telefono = normalizarTelefonoCo(form.telefono);
      if (form.direccion !== user.direccion) data.direccion = form.direccion;
      if (form.email !== user.email) data.email = form.email;
      if (form.password) data.password = form.password;

      const { data: updatedUser } = await users.update(user.id, data);
      const token = localStorage.getItem('token');
      login(updatedUser, token);
      setSuccess('Perfil actualizado correctamente');
      setEditing(false);
      setForm({ ...form, password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  // Report problem handlers
  const handleReportChange = (e) => setReportForm({ ...reportForm, [e.target.name]: e.target.value });

  const openReportModal = () => {
    setReportForm({
      nombre: user?.nombre || '',
      email: user?.email || '',
      problema: ''
    });
    setShowReportModal(true);
    setReportError('');
    setReportSuccess(false);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setReportError('');
    setReportSuccess(false);
    setReportForm({ nombre: user?.nombre || '', email: user?.email || '', problema: '' });
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportError('');
    setReportSuccess(false);
    
    if (!reportForm.problema || reportForm.problema.length < 10) {
      setReportError('La descripción del problema debe tener al menos 10 caracteres');
      return;
    }

    setReportLoading(true);
    try {
      await api.post('/reportes', reportForm);
      setReportSuccess(true);
    } catch (err) {
      setReportError(err.response?.data?.error || 'Error enviando reporte. Intenta nuevamente.');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto', paddingBottom: 100 }}>

        <h1 style={{ color: '#5E244E', fontSize: 22, marginBottom: 24 }}>Mi Perfil</h1>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}
        {success && (
          <div style={{ background: '#F0FDF4', color: '#166534', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{success}</div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#ffe8b4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: '#5E244E', fontWeight: 600, margin: '0 auto 12px',
            overflow: 'hidden'
          }}>
            {avatarPreview ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.nombre?.charAt(0)?.toUpperCase()}
          </div>
          {editing && (
            <label style={{ fontSize: 13, color: '#e68457', cursor: subiendoAvatar ? 'wait' : 'pointer', textDecoration: 'underline' }}>
              {subiendoAvatar ? 'Subiendo foto...' : 'Cambiar foto'}
              <input type="file" accept="image/*" onChange={handleAvatar} disabled={subiendoAvatar} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {!editing ? (
          <div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
              <InfoRow label="Nombre" value={user?.nombre} />
              <InfoRow label="Email" value={acortarEmail(user?.email)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280', fontSize: 14 }}>Teléfono</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#111827', fontSize: 14, fontWeight: 500 }}>{user?.telefono || 'Sin registrar'}</span>
                  {user?.telefono && (
                    telefonoVerificado ? (
                      <span style={{ fontSize: 11, fontWeight: 600, background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        ✓ Verificado
                      </span>
                    ) : (
                      <button
                        onClick={openPhoneModal}
                        style={{ fontSize: 11, fontWeight: 600, background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        🔒 Verificar número
                      </button>
                    )
                  )}
                </div>
              </div>
              <InfoRow label="Dirección" value={user?.direccion || 'Sin registrar'} />
              <InfoRow label="Rol" value={user?.rol === 'admin' ? 'Administrador' : 'Cliente'} />
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setEditing(true)}>
              Editar Perfil
            </button>

            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/favoritos" className="btn btn-outline" style={{ textAlign: 'center', border: 'none', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 12, padding: '16px 20px' }}>❤️ Mis Favoritos</Link>
              <Link to="/promociones" className="btn btn-outline" style={{ textAlign: 'center', border: 'none', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 12, padding: '16px 20px' }}>🔥 Promociones</Link>
              <Link to="/politica-datos" className="btn btn-outline" style={{ textAlign: 'center', border: 'none', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 12, padding: '16px 20px' }}>📋 Política de Datos</Link>
              <Link to="/terminos-condiciones" className="btn btn-outline" style={{ textAlign: 'center', border: 'none', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 12, padding: '16px 20px' }}>📄 Términos y Condiciones</Link>
            </div>

            <InstallButton />
            <button
              onClick={openReportModal}
              style={{
                marginTop: 24, width: '100%', padding: '12px', borderRadius: 12,
                border: '1px solid #FDE68A', background: '#FFFBEB', color: '#92400E',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              ⚠️ Reportar un problema
            </button>

            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                marginTop: 8, width: '100%', padding: '12px', borderRadius: 12,
                border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              Cerrar Sesión
            </button>

            {!confirmEliminar ? (
              <button
                onClick={() => setConfirmEliminar(true)}
                style={{
                  marginTop: 8, width: '100%', padding: '12px', borderRadius: 12,
                  border: 'none', background: 'none', color: '#9ca3af',
                  fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                }}>
                Eliminar mi cuenta y mis datos
              </button>
            ) : (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                <p style={{ fontSize: 13, color: '#991B1B', margin: '0 0 10px' }}>
                  Se anonimizarán tus datos personales (Ley 1581). Tus pedidos se conservan por obligación legal. ¿Continuar?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmEliminar(false)} disabled={eliminando}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={eliminarCuenta} disabled={eliminando}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#991B1B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <button onClick={() => { setEditing(false); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, color: '#e68457', fontSize: 14 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              Volver
            </button>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nombre</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Teléfono</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+57 300 123 4567" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Dirección</label>
              <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Cra 15 #85-42, Palermo" style={inputStyle} />
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nueva Contraseña (dejar vacío para no cambiar)</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Confirmar Contraseña</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="••••••" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            </form>
          </div>
          )}

      {/* Phone Verification Modal */}
      <Modal
        show={showPhoneModal}
        title="Verificar Número de Teléfono"
        message="Ingresa tu número y recibirás un código de 6 dígitos por SMS para verificar tu cuenta."
        onCancel={closePhoneModal}
        type="warning"
      >
        <div ref={recaptchaContainerRef} style={{ display: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginTop: 18 }}>
          <input
            type="tel"
            inputMode="tel"
            value={phoneTel}
            onChange={e => setPhoneTel(e.target.value)}
            placeholder="+57 300 123 4567"
            style={{ ...inputStyle }}
          />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
            El indicativo +57 de Colombia se agrega automáticamente.
          </p>

          {phoneMsg && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 13,
              background: phoneMsg.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              color: phoneMsg.type === 'success' ? '#166534' : '#991B1B',
            }}>
              {phoneMsg.text}
            </div>
          )}

          <button
            onClick={enviarCodigo}
            disabled={phoneLoading || phoneCooldown > 0 || !phoneTel.trim()}
            style={{
              padding: '10px 14px', borderRadius: 10, border: 'none',
              background: phoneLoading || phoneCooldown > 0 || !phoneTel.trim() ? '#d1d5db' : '#5E244E',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: phoneLoading || phoneCooldown > 0 || !phoneTel.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {phoneLoading ? 'Enviando...'
              : phoneCooldown > 0 ? `Reenviar en ${phoneCooldown}s`
              : phoneSent ? 'Reenviar código' : 'Enviar código'}
          </button>

          {phoneSent && (
            <form onSubmit={verificarCodigo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={phoneCode}
                onChange={e => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                style={{ ...inputStyle, textAlign: 'center', fontSize: 18, letterSpacing: 8 }}
              />
              <button
                type="submit"
                disabled={phoneLoading || phoneCode.length !== 6}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: 'none',
                  background: phoneCode.length === 6 ? 'linear-gradient(to left, #961e44, #6c234b)' : '#d1d5db',
                  color: phoneCode.length === 6 ? '#fee7b3' : '#fff', fontSize: 14, fontWeight: 600,
                  cursor: phoneCode.length === 6 ? 'pointer' : 'not-allowed'
                }}
              >
                {phoneLoading ? 'Verificando...' : 'Verificar código'}
              </button>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                El código expira en 10 minutos. No lo compartas con nadie.
              </p>
            </form>
          )}
        </div>
      </Modal>

      {/* Report Problem Modal */}
      <Modal
        show={showReportModal}
        title={reportSuccess ? '¡Reporte Enviado!' : 'Reportar un Problema'}
        message={reportSuccess 
          ? 'Gracias por tu reporte. Nuestro equipo lo revisará y te contactaremos si necesitamos más información.'
          : 'Por favor, describe el problema que estás experimentando con el mayor detalle posible.'}
        onConfirm={reportSuccess ? () => { closeReportModal(); navigate('/perfil'); } : handleReportSubmit}
        onCancel={closeReportModal}
        confirmText={reportSuccess ? 'Ir al Perfil' : 'Enviar Reporte'}
        loading={reportLoading}
        type={reportSuccess ? 'success' : 'warning'}
      >
        {!reportSuccess && (
          <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
            {reportError && (
              <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{reportError}</div>
            )}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nombre</label>
              <input name="nombre" value={reportForm.nombre} onChange={handleReportChange} style={inputStyle} readOnly />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Email</label>
              <input name="email" type="email" value={reportForm.email} onChange={handleReportChange} style={inputStyle} readOnly />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Descripción del Problema</label>
              <textarea name="problema" value={reportForm.problema} onChange={handleReportChange} rows={5} placeholder="Describe el problema con el mayor detalle posible..." style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Mínimo 10 caracteres</p>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}