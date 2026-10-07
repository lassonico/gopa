import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export const TURNSTILE_ENABLED = !!SITE_KEY;

const Turnstile = forwardRef(function Turnstile({ onToken, onExpire, onError, action, theme = 'light' }, ref) {
  const elRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch {}
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    let timeoutId;

    const render = () => {
      if (!window.turnstile || !elRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(elRef.current, {
        sitekey: SITE_KEY,
        theme,
        ...(action ? { action } : {}),
        callback: (token) => onTokenRef.current && onTokenRef.current(token),
        'expired-callback': () => onExpireRef.current && onExpireRef.current(),
        'error-callback': () => onErrorRef.current && onErrorRef.current(),
      });
    };

    if (window.turnstile) render();
    else timeoutId = setTimeout(render, 500);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return (
    <div ref={elRef} style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 0' }}>
      <style>{`.cf-turnstile iframe { border: none !important; }`}</style>
    </div>
  );
});

export default Turnstile;
