import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pedidos } from '../services/api';
import { useCart } from '../context/CartContext';
import { construirItemsParaCarrito } from '../utils/reorder';
import AlertModal from '../components/AlertModal';
import Loader from '../components/Loader';

const badgeClass = {
  'pendiente': 'badge-pendiente',
  'programado': 'badge-programado',
  'confirmado': 'badge-confirmado',
  'en preparación': 'badge-preparacion',
  'recogido': 'badge-recogido',
  'en camino': 'badge-camino',
  'entregado': 'badge-entregado',
  'cancelado': 'badge-cancelado'
};

export default function Pedidos() {
  const navigate = useNavigate();
  const { replaceItems } = useCart();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reordenandoId, setReordenandoId] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    pedidos.getAll()
      .then(({ data }) => setList(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      pedidos.getAll()
        .then(({ data }) => setList(data))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const reordenar = async (pedido) => {
    setReordenandoId(pedido.id);
    try {
      const items = await construirItemsParaCarrito(pedido);
      replaceItems(items);
      navigate('/carrito');
    } catch (err) {
      setAlert({ title: 'Error al reordenar', message: 'No se pudo cargar el pedido en el carrito' });
    } finally {
      setReordenandoId(null);
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="header"><h1>Mis Pedidos</h1></div>

      {list.length === 0 ? (
        <div className="empty-state">
          <h3>No tienes pedidos</h3>
          <p>Explora los comercios y haz tu primer pedido</p>
          <Link to="/comercios" className="btn btn-primary" style={{ marginTop: 16 }}>
            Ver Comercios
          </Link>
        </div>
      ) : list.map(pedido => (
        <div key={pedido.id} className="card" style={{ marginBottom: 8 }}>
          <Link to={`/pedidos/${pedido.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 600, color: 'var(--gray-900)' }}>Pedido #{pedido.id?.slice(0, 8)}</p>
              <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                ${parseFloat(pedido.total || 0).toLocaleString('es-CO')} · {new Date(pedido.fechaCreacion).toLocaleDateString()}
              </p>
              {pedido.estado === 'programado' && pedido.fechaProgramada && (
                <p style={{ fontSize: 12, color: '#1E40AF', fontWeight: 600, margin: '2px 0 0' }}>
                  📅 {new Date(pedido.fechaProgramada).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <span className={`badge ${badgeClass[pedido.estado] || ''}`}>
              {pedido.estado}
            </span>
          </Link>
          {(pedido.estado === 'entregado' || pedido.estado === 'cancelado') && (
            <button
              onClick={() => reordenar(pedido)}
              disabled={reordenandoId !== null}
              className="btn btn-secondary"
              style={{ marginTop: 10, width: '100%' }}
            >
              {reordenandoId === pedido.id ? 'Cargando...' : '🔄 Comprar de nuevo'}
            </button>
          )}
        </div>
      ))}

      <AlertModal show={!!alert} title={alert?.title} message={alert?.message} onClose={() => setAlert(null)} />
    </div>
  );
}
