import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CLAVE = 'gopalermo_cookies';
export const VERSION_POLITICA = '2026-09';

export function aceptoCookies() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return v && v.version === VERSION_POLITICA && (v.estado === 'aceptadas' || v.estado === 'rechazadas');
  } catch { return false; }
}

export default function BannerCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!aceptoCookies()) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const guardar = (estado) => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ estado, version: VERSION_POLITICA, fecha: new Date().toISOString() }));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Aviso de cookies" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2000,
      background: '#1f2937', color: '#fff', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
    }}>
      <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        🍪 Usamos cookies y almacenamiento local para tu sesión, carrito y seguridad (Ley 1581 de 2012).
        Ver <Link to="/politica-datos" style={{ color: '#ffe8b4', fontWeight: 600 }}>Política de datos</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => guardar('rechazadas')}
          style={{ flex: 1, background: 'transparent', color: '#fff', border: '1px solid #6b7280', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>
          Rechazar
        </button>
        <button onClick={() => guardar('aceptadas')} autoFocus
          style={{ flex: 2, background: '#5E244E', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
          Aceptar
        </button>
      </div>
    </div>
  );
}
