import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="12" x2="12" y2="16" strokeLinecap="round" />
      <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" />
    </svg>
  ),
};

const STYLES = {
  success: { background: '#D1FAE5', color: '#065F46' },
  error: { background: '#FEF2F2', color: '#991B1B' },
  info: { background: '#FFF5F0', color: '#5E244E' },
};

function ToastCard({ toast, onDismiss, onHold, onRelease }) {
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={onHold}
      onMouseLeave={onRelease}
      onTouchStart={onHold}
      onTouchEnd={onRelease}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        animation: 'toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        ...STYLES[toast.type],
      }}
    >
      {ICONS[toast.type]}
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{toast.message}</span>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none', border: 'none', padding: 2, margin: '-2px',
          cursor: 'pointer', color: 'inherit', opacity: 0.6, flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
          <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback((type, message) => {
    const id = ++toastId;
    setToasts((t) => [...t.slice(-4), { id, type, message }]);
    timers.current[id] = setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  const hold = useCallback((id) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const release = useCallback((id) => {
    if (timers.current[id]) return;
    timers.current[id] = setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            maxWidth: 400, width: 'calc(100% - 32px)',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <div key={t.id} style={{ pointerEvents: 'auto' }}>
              <ToastCard
                toast={t}
                onDismiss={dismiss}
                onHold={() => hold(t.id)}
                onRelease={() => release(t.id)}
              />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
