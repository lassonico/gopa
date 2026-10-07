import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { pedidos, pagos } from '../services/api';
import api from '../services/api';
import { useAuth } from '../App';
import { useCart } from '../context/CartContext';
import { construirItemsParaCarrito } from '../utils/reorder';
import AlertModal from '../components/AlertModal';
import Loader from '../components/Loader';
import SeguimientoMapa from '../components/SeguimientoMapa';

const badgeClass = {
  'pendiente': 'badge-pendiente',
  'confirmado': 'badge-confirmado',
  'en preparación': 'badge-preparacion',
  'recogido': 'badge-recogido',
  'en camino': 'badge-camino',
  'entregado': 'badge-entregado',
  'cancelado': 'badge-cancelado'
};

const estados = ['pendiente', 'confirmado', 'en preparación', 'recogido', 'en camino', 'entregado'];

const METODO_PAGO_LABELS = {
  efectivo: '💵 Efectivo (al recibir)',
  tarjeta: '💳 Tarjeta (datáfono al recibir)',
  pse: '🏦 PSE (en línea)',
  enlace: '🔗 Pago en línea',
  transferencia: '🏦 Transferencia'
};

export default function PedidoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { replaceItems } = useCart();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [reordenando, setReordenando] = useState(false);
  const [reversionEnviada, setReversionEnviada] = useState(false);
  const [enviandoReversion, setEnviandoReversion] = useState(false);

  const esPagoOnline = ['pse', 'tarjeta_online', 'enlace'].includes(pedido?.metodoPago);
  const diasDesdeEntrega = pedido?.fechaEntrega
    ? Math.floor((Date.now() - new Date(pedido.fechaEntrega).getTime()) / 86400000)
    : null;
  const puedeReversion = pedido?.estado === 'entregado' && esPagoOnline &&
    diasDesdeEntrega !== null && diasDesdeEntrega <= 15 && !reversionEnviada;

  const solicitarReversion = async () => {
    setEnviandoReversion(true);
    try {
      await api.post('/reportes', {
        nombre: user?.nombre || 'Cliente',
        email: user?.email || '',
        problema: `REVERSIÓN DE PAGO (Ley 1480 art. 51) — Pedido #${String(pedido.id).slice(0, 8)}, total $${parseFloat(pedido.total || 0).toLocaleString('es-CO')}, pagado con ${pedido.metodoPago}, entregado el ${pedido.fechaEntrega || 'fecha no registrada'}. Solicito reversión del cargo.`,
      });
      setReversionEnviada(true);
      setAlert({ title: 'Solicitud enviada', message: 'Recibimos tu solicitud de reversión. Te contactaremos por correo.' });
    } catch {
      setAlert({ title: 'Error', message: 'No se pudo enviar la solicitud. Intenta más tarde.' });
    } finally {
      setEnviandoReversion(false);
    }
  };

  const cargarPedido = useCallback(async () => {
    try {
      const { data } = await pedidos.getById(id);
      setPedido(data);
    } catch {
      navigate('/pedidos');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    cargarPedido();
  }, [cargarPedido]);

  const enCamino = pedido?.estado === 'en camino';

  useEffect(() => {
    const interval = setInterval(cargarPedido, enCamino ? 5000 : 15000);
    return () => clearInterval(interval);
  }, [cargarPedido, enCamino]);

  const pagar = async () => {
    try {
      const { data } = await pagos.generarEnlace({
        pedidoId: pedido.id,
        valor: pedido.total,
        comercio: pedido.comercioId,
      });
      window.open(data.enlace, '_blank');
    } catch (err) {
      setAlert({ title: 'Error de pago', message: 'No se pudo generar el enlace de pago' });
    }
  };

  const reordenar = async () => {
    setReordenando(true);
    try {
      const items = await construirItemsParaCarrito(pedido);
      replaceItems(items);
      navigate('/carrito');
    } catch (err) {
      setAlert({ title: 'Error al reordenar', message: 'No se pudo cargar el pedido en el carrito' });
    } finally {
      setReordenando(false);
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;
  if (!pedido) return null;

  const currentIndex = estados.indexOf(pedido.estado);

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', color: 'white', fontSize: 16 }}>←</button>
        <h1>Pedido #{pedido.id?.slice(0, 8)}</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className={`badge ${badgeClass[pedido.estado] || ''}`} style={{ fontSize: 14, padding: '6px 14px' }}>
            {pedido.estado?.toUpperCase()}
          </span>
          <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--primary)' }}>
            ${parseFloat(pedido.total || 0).toLocaleString('es-CO')}
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>
          {new Date(pedido.fechaCreacion).toLocaleString()}
        </p>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>
          {METODO_PAGO_LABELS[pedido.metodoPago] || 'Método de pago: al recibir'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15 }}>Estado del pedido</h3>
          {(pedido.estado === 'pendiente' || pedido.estado === 'en camino') && (
            <span style={{ fontSize: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />
              Actualizándose en vivo
            </span>
          )}
        </div>

        {pedido.estado === 'cancelado' ? (
          <div style={{ background: 'var(--gray-100)', padding: 14, borderRadius: 8, textAlign: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>Este pedido fue cancelado</span>
          </div>
        ) : (
          <div style={{ background: 'var(--gray-100)', height: 8, borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              height: '100%',
              width: `${(currentIndex / (estados.length - 1)) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--success))',
              borderRadius: 999,
              transition: 'width 0.8s ease',
            }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {estados.map((est, i) => (
            <div key={est} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: pedido.estado === 'cancelado' && i > 0 ? 0.4 : 1
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: i <= currentIndex ? 'var(--success)' : 'var(--gray-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700,
                transition: 'background 0.4s ease'
              }}>
                {i <= currentIndex ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 14, fontWeight: i === currentIndex ? 700 : i <= currentIndex ? 600 : 400,
                color: i <= currentIndex ? 'var(--gray-900)' : 'var(--gray-600)'
              }}>
                {est.charAt(0).toUpperCase() + est.slice(1)}
                {i === currentIndex && pedido.estado !== 'cancelado' && (
                  <span style={{ color: 'var(--primary)' }}> — en curso</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Productos</h3>
        {(Array.isArray(pedido.productos) ? pedido.productos : JSON.parse(pedido.productos || '[]')).map((prod, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
            <span>{prod.nombre} x{prod.cantidad || 1}</span>
            <span>${(parseFloat(prod.precio) * (prod.cantidad || 1)).toLocaleString('es-CO')}</span>
          </div>
        ))}
        {parseFloat(pedido.costoEmpaque || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
            <span>Empaque</span><span>+${parseFloat(pedido.costoEmpaque || 0).toLocaleString('es-CO')}</span>
          </div>
        )}
        {parseFloat(pedido.costoDomicilio || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
            <span>Domicilio (Neiva)</span><span>+${parseFloat(pedido.costoDomicilio || 0).toLocaleString('es-CO')}</span>
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Total</span><span>${parseFloat(pedido.total || 0).toLocaleString('es-CO')}</span>
        </div>
      </div>

      {pedido.direccionEntrega && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Dirección de entrega</h3>
          {parseFloat(pedido.lat) && parseFloat(pedido.lng) ? (
            <div>
              <iframe
                title="Mapa de entrega"
                src={`https://maps.google.com/maps?q=${pedido.lat},${pedido.lng}&z=16&output=embed`}
                style={{ width: '100%', height: 180, border: 0, borderRadius: 10 }}
                allowFullScreen
              />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${pedido.lat},${pedido.lng}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginTop: 8 }}
              >
                🗺️ Ver ruta en Google Maps
              </a>
      {enCamino && parseFloat(pedido.domiciliarioLat) && parseFloat(pedido.domiciliarioLng) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 15 }}>Tu pedido va en camino</h3>
            <span style={{ fontSize: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />
              En vivo
            </span>
          </div>
          <SeguimientoMapa
            repartidor={{ lat: parseFloat(pedido.domiciliarioLat), lng: parseFloat(pedido.domiciliarioLng) }}
            destino={parseFloat(pedido.lat) && parseFloat(pedido.lng) ? { lat: parseFloat(pedido.lat), lng: parseFloat(pedido.lng) } : null}
          />
          <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 8 }}>
            🛵 Repartidor &nbsp;·&nbsp; 📍 Tu dirección
            {pedido.ultimaUbicacion ? ` · Actualizado ${new Date(pedido.ultimaUbicacion).toLocaleTimeString('es-CO')}` : ''}
          </p>
        </div>
      )}

      {pedido.direccionEntrega && (
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 8 }}>
                  {pedido.direccionEntrega.replace(/\n?📍 https:\/\/maps\.google\.com\/\?q=[^\n]+/g, '').trim()}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{pedido.direccionEntrega}</p>
          )}
        </div>
      )}

      {pedido.estado === 'pendiente' && (pedido.metodoPago === 'pse') && (
        <button onClick={pagar} className="btn btn-primary" style={{ marginBottom: 8 }}>
          Pagar ahora
        </button>
      )}

      {pedido.estado === 'pendiente' && pedido.metodoPago !== 'pse' && (
        <div style={{ background: '#FFE8B4', padding: 12, borderRadius: 8, marginBottom: 8, fontSize: 13, color: '#5E244E' }}>
          Este pedido se paga al recibir: {METODO_PAGO_LABELS[pedido.metodoPago] || 'al recibir'}
        </div>
      )}

      {(pedido.estado === 'entregado' || pedido.estado === 'cancelado') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={reordenar} className="btn btn-primary" disabled={reordenando} style={{ width: '100%' }}>
            {reordenando ? 'Cargando...' : '🔄 Comprar de nuevo'}
          </button>
          {pedido.estado === 'entregado' && (
            <Link to={`/pedidos/${id}/calificar`} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
              Calificar
            </Link>
          )}
          {puedeReversion && (
            <button onClick={solicitarReversion} disabled={enviandoReversion}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {enviandoReversion ? 'Enviando...' : '↩ Solicitar reversión del pago'}
            </button>
          )}
        </div>
      )}
      <AlertModal show={!!alert} title={alert?.title} message={alert?.message} onClose={() => setAlert(null)} />
    </div>
  );
}
