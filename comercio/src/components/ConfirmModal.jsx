import { useEffect, useRef } from 'react';

export default function ConfirmModal({ show, title, message, onConfirm, onCancel, loading, confirmLabel, confirmColor }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onCancel]);

  if (!show) return null;
  return (
    <div
      role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
      }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 12px', color: '#5E244E', fontSize: 17 }}>{title}</h3>
        <p style={{ margin: '0 0 24px', color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button ref={cancelRef} onClick={onCancel} disabled={loading}
            style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 48 }}>
            Volver
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: confirmColor || '#991b1b', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48
            }}>
            {loading ? 'Procesando...' : (confirmLabel || 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
}
