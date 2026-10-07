import { useEffect, useState } from 'react';
import { onForegroundMessage } from '../services/firebase';

export default function PushListener() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || '';
      const body = payload?.notification?.body || payload?.data?.body || '';
      if (title || body) {
        setToast({ title, body });
        setTimeout(() => setToast(null), 5000);
      }
    });
    return () => unsub?.();
  }, []);

  if (!toast) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 84, left: 16, right: 16, zIndex: 9999,
      background: '#fff', borderRadius: 12, padding: '12px 16px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #f3f4f6',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #5E244E, #aa1c41)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
      }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{toast.title}</div>
        {toast.body && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{toast.body}</div>}
      </div>
      <button onClick={() => setToast(null)} style={{ border: 'none', background: 'none', color: '#9ca3af', fontSize: 16, cursor: 'pointer' }}>✕</button>
    </div>
  );
}
