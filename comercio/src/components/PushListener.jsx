import { useEffect, useState, useCallback } from 'react';
import { onForegroundMessage } from '../services/firebase';
import { clearCache } from '../services/api';

function notifySound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.12;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 400);
  } catch {}
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
}

export default function PushListener() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((title, body) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-2), { id, title, body }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
  }, []);

  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || '';
      const body = payload?.notification?.body || payload?.data?.body || '';
      const tipo = payload?.data?.tipo || '';
      if (title || body) {
        push(title, body);
        notifySound();
        if (tipo === 'pedido' || /pedido/i.test(`${title} ${body}`)) {
          try { clearCache('/pedidos'); } catch {}
          window.dispatchEvent(new Event('gopalermo:new-order'));
        }
      }
    });
    return () => unsub?.();
  }, [push]);

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" style={{ position: 'fixed', bottom: 84, left: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, margin: '0 auto' }}>
      {toasts.map(t => (
        <div key={t.id} role="status" style={{
          background: '#fff', borderRadius: 12, padding: '12px 16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #5E244E, #aa1c41)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }} aria-hidden="true">🔔</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{t.title}</div>
            {t.body && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.body}</div>}
          </div>
          <a href="/" style={{ background: '#5E244E', color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center' }}>Ver</a>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} aria-label="Cerrar notificación" style={{ border: 'none', background: 'none', color: '#9ca3af', fontSize: 16, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>✕</button>
        </div>
      ))}
    </div>
  );
}
