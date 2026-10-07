import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { comercios } from '../services/api';
import { useData } from '../contexts/DataContext';
import Loader from '../components/Loader';
import { formatTiempoEstimado } from '../utils/formatTiempo';
import { subsConsumo, coincideSubLista, subConsumoDe } from '../utils/tiendas';

export default function ComerciosNeiva() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const catFilter = searchParams.get('categoria');
  const { categoriasList: cats } = useData();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subActiva, setSubActiva] = useState('Todas');

  const subs = subsConsumo(cats);

  useEffect(() => {
    comercios.getAll()
      .then(({ data }) => setList(data.filter(c => (c.ciudad || '').toLowerCase() === 'neiva')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!catFilter) { setSubActiva('Todas'); return; }
    const match = subs.find(s => s.nombre.toLowerCase() === String(catFilter).toLowerCase().trim() || coincideSubLista(subs, catFilter) === s.nombre);
    setSubActiva(match ? match.nombre : 'Todas');
  }, [catFilter, cats]);

  const filtered = subActiva === 'Todas'
    ? list
    : list.filter(c => (coincideSubLista(subs, c.categoria) || subConsumoDe(c.categoria)) === subActiva);

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div style={{
        background: 'linear-gradient(135deg, #5c1b3f, #aa1c41)', color: '#fff',
        padding: '16px 16px 20px', margin: '-16px -16px 20px', borderRadius: '0 0 24px 24px',
        position: 'relative', overflow: 'hidden',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', color: '#fff', fontSize: 16, marginBottom: 8 }}>
          ← Volver
        </button>
        <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 80, opacity: 0.12 }}>📍</div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffe8b4', margin: 0 }}>
          Traemos tu pedido desde Neiva
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 4px' }}>Comercios Neiva</h1>
        <p style={{ fontSize: 13, opacity: 0.95, margin: 0 }}>
          Domicilio fijo ${Number(30000).toLocaleString('es-CO')} · Entrega aprox. 1 h 40 min
        </p>
      </div>

      {filtered.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 28, gap: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
        }}>
          <span style={{ fontSize: 40 }}>🤝</span>
          <strong style={{ fontSize: 16, color: '#5e244e' }}>Aún no hay comercios en Neiva</strong>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 320 }}>
            Pronto tendremos comercios y restaurantes disponibles en Neiva.
          </p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
        {['Todas', ...subs.map(s => s.nombre)].map(nombre => {
          const activa = subActiva === nombre;
          const sub = subs.find(s => s.nombre === nombre);
          return (
            <button key={nombre} onClick={() => setSubActiva(nombre)}
              style={{
                background: activa ? '#5E244E' : '#fff', padding: '8px 16px', borderRadius: 20,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', color: activa ? '#fff' : '#374151', minHeight: 40,
              }}>
              {sub ? `${sub.icono} ` : ''}{nombre}
            </button>
          );
        })}
      </div>
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(com => (
            <Link key={com.id} to={`/comercios/${com.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff', borderRadius: 16, padding: 12, display: 'flex',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#aa1c41' }} />
                <div style={{
                  width: 96, height: 96, borderRadius: 12, background: '#ffe8b4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, color: '#5e244e', flexShrink: 0, overflow: 'hidden',
                }}>
                  {com.logo ? <img src={com.logo} alt={com.nombreNegocio} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : com.nombreNegocio?.[0] || '?'}
                </div>
                <div style={{ marginLeft: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>{com.nombreNegocio}</h4>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: com.abierto === 'true' ? '#DCFCE7' : '#FEE2E2',
                      color: com.abierto === 'true' ? '#166534' : '#991B1B',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: com.abierto === 'true' ? '#16A34A' : '#DC2626' }} />
                      {com.abierto === 'true' ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {com.categoria || 'General'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      🛵 Domicilio ${parseFloat(com.costoEnvio || 30000).toLocaleString('es-CO')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      ⏱️ {formatTiempoEstimado(com.tiempoEstimado || 100)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}