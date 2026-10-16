import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { comercios, productos, calificaciones } from '../services/api';
import { useCart } from '../context/CartContext';
import { useData } from '../contexts/DataContext';
import AlertModal from '../components/AlertModal';
import ProductoModal from '../components/ProductoModal';
import { formatoLegibleHorarios } from '../utils/formatHorarios';
import { formatTiempoEstimado, esCiudadNeiva } from '../utils/formatTiempo';
import Loader from '../components/Loader';

export default function ComercioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { categoriasList, subcategoriasList } = useData();
  const [comercio, setComercio] = useState(null);
  const [items, setItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [selected, setSelected] = useState(null);
  const [subcatActiva, setSubcatActiva] = useState('');

  useEffect(() => {
    Promise.all([
      comercios.getById(id),
      productos.getByComercio(id),
      calificaciones.getByComercio(id)
    ]).then(([comData, prodData, revData]) => {
      setComercio(comData.data);
      setItems(prodData.data);
      setReviews(revData.data);
    }).catch(() => navigate('/comercios'))
    .finally(() => setLoading(false));
  }, [id]);

  const addToCart = (producto, cantidad = 1, nota = '') => {
    if (comercio.abierto === 'false') {
      setAlert({ title: 'Comercio cerrado', message: 'Este comercio no está recibiendo pedidos en este momento.' });
      return;
    }
    const esNeiva = esCiudadNeiva(comercio.ciudad);
    addItem({
      ...producto,
      nota,
      comercioId: comercio.id,
      comercioNombre: comercio.nombreNegocio,
      ciudad: comercio.ciudad || 'palermo',
      ...(esNeiva ? {
        costoEnvio: comercio.costoEnvio || '30000',
        tiempoEstimado: comercio.tiempoEstimado || '100'
      } : {}),
      cobraEmpaque: comercio.cobraEmpaque || 'no',
      tipoEmpaque: comercio.tipoEmpaque || 'pedido',
      valorEmpaque: comercio.valorEmpaque || '0'
    }, cantidad);
    setAlert({ title: 'Agregado', message: `${cantidad > 1 ? `${cantidad} x ` : ''}${producto.nombre} agregado al carrito` });
  };

  if (loading) return <div className="loading"><Loader /></div>;
  if (!comercio) return null;

  const catObj = categoriasList.find(c => (c.nombre || '').trim().toLowerCase() === (comercio.categoria || '').trim().toLowerCase());
  const subcats = (catObj ? subcategoriasList.filter(s => s.categoriaId === catObj.id) : []);
  const itemsVisibles = subcatActiva ? items.filter(p => p.subcategoriaId === subcatActiva) : items;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(to bottom, #6c234b 0%, #961e44 50%, #ee6a2d 100%)', color: 'var(--white)', padding: 16, margin: '-16px -16px 16px', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32)'}}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', color: 'var(--white)', fontSize: 16, marginBottom: 8 }}>
          ← Volver
        </button>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {comercio.logo && (
            <img src={comercio.logo} alt={comercio.nombreNegocio}
              style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
          )}
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>{comercio.nombreNegocio}</h1>
            <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>{comercio.categoria} · {comercio.direccion}</p>
            {comercio.calificacionPromedio > 0 && (
              <p style={{ fontSize: 14, margin: 0 }}>{'★'.repeat(Math.round(parseFloat(comercio.calificacionPromedio)))} {comercio.calificacionPromedio}</p>
            )}
          </div>
        </div>
      </div>

      {comercio.fachada && (
        <img src={comercio.fachada} alt={`Fachada de ${comercio.nombreNegocio}`}
          style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
      )}

      {comercio.descripcion && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{comercio.descripcion}</p>
        </div>
      )}

      {comercio.abierto === 'false' && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          🔴 Este comercio está cerrado ahora mismo. Vuelve dentro de su horario de atención.
          {formatoLegibleHorarios(comercio.horarios) && ` Horario: ${formatoLegibleHorarios(comercio.horarios)}`}
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12, color: 'var(--primary)' }}>Productos</h2>
      {subcats.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 8 }} className="hide-scrollbar">
          <button onClick={() => setSubcatActiva('')}
            style={{
              background: !subcatActiva ? 'var(--primary)' : '#fff',
              color: !subcatActiva ? '#fff' : 'var(--gray-700)',
              border: !subcatActiva ? 'none' : '1px solid #e5e7eb',
              padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
            }}>
            Todos
          </button>
          {subcats.map(s => (
            <button key={s.id} onClick={() => setSubcatActiva(subcatActiva === s.id ? '' : s.id)}
              style={{
                background: subcatActiva === s.id ? 'var(--primary)' : '#fff',
                color: subcatActiva === s.id ? '#fff' : 'var(--gray-700)',
                border: subcatActiva === s.id ? 'none' : '1px solid #e5e7eb',
                padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
              }}>
              {s.nombre}
            </button>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <div className="empty-state"><p>No hay productos disponibles</p></div>
      ) : itemsVisibles.length === 0 ? (
        <div className="empty-state"><p>No hay productos en esta subcategoría</p></div>
      ) : itemsVisibles.map(prod => (
        <div key={prod.id} className="producto-card" onClick={() => setSelected(prod)}>
          {prod.imagen ? <img src={prod.imagen} alt={prod.nombre} /> : (
            <div style={{ width: 90, height: 90, minHeight: 90, margin: 'auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, background: 'var(--gray-50)', borderRadius: 8, flexShrink: 0 }}>
              {prod.emoji || '🍴'}
            </div>
          )}
          <div className="info">
            <h3>{prod.nombre}</h3>
            {prod.subcategoriaNombre && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: '#FFF3E0', padding: '2px 8px', borderRadius: 12, display: 'inline-block', marginBottom: 4 }}>
                {prod.subcategoriaNombre}
              </span>
            )}
            <p>{prod.descripcion}</p>
            <span className="precio">${parseFloat(prod.precio).toLocaleString('es-CO')}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); addToCart(prod); }} disabled={comercio.abierto === 'false'}
            style={{
              background: comercio.abierto === 'false' ? 'var(--gray-300)' : 'var(--primary)',
              color: 'var(--white)', width: 36, height: 36,
              borderRadius: '50%', fontSize: 20, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, cursor: comercio.abierto === 'false' ? 'not-allowed' : 'pointer'
            }}>
            +
          </button>
        </div>
      ))}

      {reviews.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12, color: 'var(--primary)' }}>Opiniones</h2>
          {reviews.slice(0, 5).map(rev => (
            <div key={rev.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{rev.clienteNombre}</span>
                <span style={{ color: '#F59E0B' }}>{'★'.repeat(parseInt(rev.calificacionGeneral))}</span>
              </div>
              {rev.comentario && <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{rev.comentario}</p>}
            </div>
          ))}
        </section>
      )}
      <ProductoModal producto={selected} comercio={comercio} onAdd={addToCart} onClose={() => setSelected(null)} />
      <AlertModal show={!!alert} title={alert?.title} message={alert?.message} onClose={() => setAlert(null)} />
    </div>
  );
}
