export default function AlertModal({ show, title, message, onClose }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px', color: '#5E244E', fontSize: 18 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14 }}>{message}</p>
        <button onClick={onClose}
          style={{
            background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', border: 'none', borderRadius: 8,
            padding: '10px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}>
          OK
        </button>
      </div>
    </div>
  );
}
