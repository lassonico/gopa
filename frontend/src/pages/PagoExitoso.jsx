import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { pagos } from '../services/api';

export default function PagoExitoso() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const txId = searchParams.get('id');
  const [pago, setPago] = useState(null);
  const [estado, setEstado] = useState('consultando');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ref) {
      setEstado('sin-referencia');
      return;
    }
    let cancelados = false;
    let intervalos = [];
    const consultar = async () => {
      try {
        const { data } = await pagos.consultarTransaccion(ref, txId);
        if (cancelados) return;
        setPago(data);
        if (data.estado === 'completado') {
          setEstado('completado');
        } else if (data.estado === 'fallido' || data.estado === 'anulado') {
          setEstado('fallido');
        } else {
          setEstado('pendiente');
        }
      } catch (err) {
        if (cancelados) return;
        setError('No se pudo verificar el pago');
        setEstado('error');
      }
    };
    consultar();
    const tick = setInterval(consultar, 4000);
    const timeout = setTimeout(() => {
      clearInterval(tick);
      if (!cancelados && estado === 'pendiente') setEstado('pendiente');
    }, 120 * 1000);
    intervalos = [tick, timeout];
    return () => {
      cancelados = true;
      intervalos.forEach(clearInterval);
      clearTimeout(timeout);
    };
  }, [ref, txId]);

  const resumen = {
    consultando: { titulo: 'Verificando pago…', icono: '⏳', desc: 'Espera mientras confirmamos tu transacción.' },
    'sin-referencia': { titulo: 'Pago pendiente', icono: '❓', desc: 'No recibimos una referencia de pago válida. Regresa a tus pedidos para intentar de nuevo.' },
    pendiente: { titulo: 'Pago en proceso', icono: '⏳', desc: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.' },
    completado: { titulo: '¡Pago exitoso!', icono: '✅', desc: 'Tu pedido ya fue confirmado. ¡Gracias por comprar con nosotros!' },
    fallido: { titulo: 'El pago no se completó', icono: '❌', desc: 'Tu pago fue rechazado. Puedes intentar pagar nuevamente desde tu pedido.' },
    error: { titulo: 'No pudimos verificar el pago', icono: '⚠️', desc: error || 'Intenta de nuevo en unos momentos.' },
  }[estado] || { titulo: 'Pago', icono: '🔔', desc: '' };

  return (
    <div className="container" style={{ paddingBottom: 80, textAlign: 'center' }}>
      <div className="card" style={{ marginTop: 48, padding: '40px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{resumen.icono}</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>{resumen.titulo}</h1>
        <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>{resumen.desc}</p>

        {pago && (
          <div style={{ marginBottom: 24, textAlign: 'left', display: 'inline-block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, fontSize: 14 }}>
              <span style={{ color: 'var(--gray-600)' }}>Referencia</span>
              <span style={{ fontWeight: 600 }}>{pago.referencia}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, fontSize: 14, marginTop: 6 }}>
              <span style={{ color: 'var(--gray-600)' }}>Valor</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                ${parseFloat(pago.valor || 0).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {estado === 'pendiente' && (
            <button className="btn btn-primary" onClick={() => setEstado('consultando')}>
              Reintentar
            </button>
          )}
          <Link to="/pedidos" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Ver mis pedidos
          </Link>
          <Link to="/" className="btn" style={{ textDecoration: 'none' }}>
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}