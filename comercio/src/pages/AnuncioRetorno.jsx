import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { anuncios } from '../services/api';
import Loader from '../components/Loader';

export default function AnuncioRetorno() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const [estado, setEstado] = useState('verificando'); // verificando | pagado | fallido | error
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    if (!ref) { setEstado('error'); return; }
    let vivo = true;
    const verificar = async () => {
      try {
        const { data } = await anuncios.consultar(ref);
        if (!vivo) return;
        if (data.estado === 'pagado') setEstado('pagado');
        else if (data.estado === 'fallido' || data.estado === 'anulado') setEstado('fallido');
        else setIntentos(i => i + 1);
      } catch {
        if (vivo) setIntentos(i => i + 1);
      }
    };
    verificar();
    const t = setInterval(() => {
      setIntentos(i => {
        if (i >= 29) { clearInterval(t); setEstado(s => (s === 'verificando' ? 'error' : s)); }
        return i;
      });
      verificar();
    }, 4000);
    return () => { vivo = false; clearInterval(t); };
  }, [ref]);

  if (estado === 'verificando') {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Loader text="Confirmando tu pago con Wompi..." />
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>Esto puede tardar unos segundos, no cierres esta página.</p>
      </div>
    );
  }

  if (estado === 'pagado') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label="Anuncio creado" style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h3 style={{ margin: '0 0 8px', color: '#5E244E' }}>Anuncio creado exitosamente</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            Tu pago fue confirmado. Crearemos tu banner por 5 días calendario en la app.
          </p>
          <button onClick={() => navigate('/')} autoFocus
            style={{ width: '100%', background: '#5E244E', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 52 }}>
            Aceptar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{estado === 'fallido' ? '❌' : '⚠️'}</div>
      <h3 style={{ color: '#5E244E' }}>{estado === 'fallido' ? 'El pago no fue aprobado' : 'No pudimos confirmar el pago'}</h3>
      <p style={{ fontSize: 13, color: '#6b7280' }}>
        {estado === 'fallido'
          ? 'Wompi rechazó la transacción. Puedes intentarlo de nuevo.'
          : 'Tardó demasiado en confirmarse. Revisa "Mis anuncios" o intenta de nuevo.'}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={() => navigate('/anuncios')} style={{ flex: 1, background: '#aa1c41', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 52 }}>
          Intentar de nuevo
        </button>
        <button onClick={() => navigate('/')} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 52 }}>
          Al inicio
        </button>
      </div>
      {intentos > 0 && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12 }}>Referencia: {ref}</p>}
    </div>
  );
}
