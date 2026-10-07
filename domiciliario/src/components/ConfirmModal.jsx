export default function ConfirmModal({ show, title, message, onConfirm, onCancel, loading, confirmLabel, confirmColor }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 12px', color: '#5E244E' }}>{title}</h3>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: confirmColor || '#991b1b', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>
            {loading ? 'Procesando...' : (confirmLabel || 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
}
