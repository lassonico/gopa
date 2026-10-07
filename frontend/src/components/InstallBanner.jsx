import { useState } from 'react';
import { useInstallPrompt, isIOS, isIOSStandalone } from '../hooks/useInstallPrompt';

export default function InstallBanner() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled) return null;
  if (isIOS()) {
    if (isIOSStandalone()) return null;
    if (dismissed) return null;
    return (
      <div style={{
        position: 'fixed', bottom: 92, left: 12, right: 12, zIndex: 90,
        background: '#5E244E', color: '#fff', borderRadius: 16,
        padding: '14px 16px', boxShadow: '0 8px 24px rgba(94,36,78,0.35)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>📱 Descarga la app</strong>
          <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: '#f3e9ef' }}>
          En iPhone/Safari: toca <strong>Compartir</strong> <span aria-hidden>⎋</span> y luego{' '}
          <strong>“Agregar a pantalla de inicio”</strong> para instalar la app.
        </p>
      </div>
    );
  }

  if (!canInstall || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 92, left: 12, right: 12, zIndex: 90,
      background: 'linear-gradient(135deg, #5E244E, #aa1c41)',
      color: '#fff', borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 8px 24px rgba(94,36,78,0.35)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>📱 Instala GoPalermo</strong>
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: '#f3e9ef' }}>
        Accede más rápido, con ícono en tu pantalla, descarga la app.
      </p>
      <button
        onClick={async () => { await promptInstall(); }}
        style={{
          alignSelf: 'flex-start', background: '#fff', color: '#5E244E',
          border: 'none', borderRadius: 10, padding: '9px 18px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Descargar la app
      </button>
    </div>
  );
}
