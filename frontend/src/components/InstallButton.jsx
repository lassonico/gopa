import { useState } from 'react';
import { useInstallPrompt, isIOS, isIOSStandalone } from '../hooks/useInstallPrompt';

function Paso({ num, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left' }}>
      <div style={{
        minWidth: 26, height: 26, borderRadius: '50%', background: '#5E244E', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
      }}>
        {num}
      </div>
      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export default function InstallButton({ fullWidth = true }) {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [showIosModal, setShowIosModal] = useState(false);

  if (isInstalled) return null;
  if (isIOS() && isIOSStandalone()) return null;

  const baseStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px', borderRadius: 12, marginTop: 24,
    background: 'linear-gradient(to left, #961e44, #6c234b)',
    color: '#fee7b3', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: 'none', width: fullWidth ? '100%' : 'auto',
  };

  return (
    <>
      <button onClick={() => (isIOS() ? setShowIosModal(true) : promptInstall())} style={baseStyle}>
        📱 Descargar la app
      </button>

      {showIosModal && (
        <div onClick={() => setShowIosModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 20, padding: 24, maxWidth: 340, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>📱</div>
              <h3 style={{ margin: '8px 0 4px', color: '#5E244E', fontSize: 18 }}>Instala GoPalermo</h3>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>
                Así tendrás la app con un ícono en tu pantalla de inicio.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <Paso num={1}>
                Toca el botón <strong>Compartir</strong>{' '}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 6, background: '#f3f4f6', verticalAlign: 'middle', fontSize: 15,
                }}>{'\u2913'}</span>{' '}
                en la barra de Safari (abajo de la pantalla).
              </Paso>
              <Paso num={2}>
                Desplázate y elige <strong>Agregar a pantalla de inicio</strong>.
              </Paso>
              <Paso num={3}>
                Confirma con <strong>Agregar</strong> y listo. La app quedará en tu home.
              </Paso>
            </div>

            <button onClick={() => setShowIosModal(false)} style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}