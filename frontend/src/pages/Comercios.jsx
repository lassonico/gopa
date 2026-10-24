import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { comercios } from '../services/api';
import { useData } from '../contexts/DataContext';
import Loader from '../components/Loader';
import { esCiudadNeiva } from '../utils/formatTiempo';
import { esComercioTienda, subsConsumo, coincideSubLista } from '../utils/tiendas';

export default function Comercios() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const catFilter = searchParams.get('categoria');
  const { categoriasList: cats, loaded } = useData();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subActiva, setSubActiva] = useState(null);

  const subs = subsConsumo(cats);

  useEffect(() => {
    Promise.all([comercios.getAll()])
      .then(([comData]) => {
        setList(comData.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!catFilter) { setSubActiva('Todas'); return; }
    const match = subs.find(s => s.nombre.toLowerCase() === String(catFilter).toLowerCase().trim() || coincideSubLista(subs, catFilter) === s.nombre);
    setSubActiva(match ? match.nombre : catFilter);
  }, [catFilter, cats]);

  const base = list.filter(c => !esCiudadNeiva(c.ciudad) && !esComercioTienda(c, cats));
  const esSubFija = subs.some(s => s.nombre === subActiva);
  const filtered = !subActiva || subActiva === 'Todas'
    ? (catFilter && !esSubFija
      ? list.filter(c => c.categoria === catFilter)
      : base)
    : base.filter(c => coincideSubLista(subs, c.categoria) === subActiva);

  if (loading || !loaded) return <div className="loading"><Loader /></div>;

  return (
    <div style={{ maxWidth: 480,  margin: '0 auto', paddingBottom: "80px", minHeight: "100vh"}} >
      <div style={{
          background: 'linear-gradient(to bottom, #6c234b 0%, #961e44 50%, #ee6a2d 100%)',
          color: '#fff', padding: '16px 16px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottomLeftRadius:24,
          borderBottomRightRadius: 24,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32)'}}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, marginBottom: 8, cursor: 'pointer' }}>
          ← Volver
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 4px' }}>Consumo</h1>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '12px 0', paddingBottom: 8 }}>
          {['Todas', ...subs.map(s => s.nombre)].map(nombre => {
            const activa = subActiva === nombre;
            const sub = subs.find(s => s.nombre === nombre);
            return (
              <button key={nombre} onClick={() => setSubActiva(nombre)}
                style={{
                  background: activa ? '#5E244E' : 'var(--white)', padding: '8px 16px', borderRadius: 20,
                  boxShadow: 'var(--shadow)', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  color: activa ? '#fff' : 'var(--gray-800)'
                }}>
                {sub ? `${sub.icono} ` : ''}{nombre}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No hay comercios</h3>
            <p>Pronto tendremos nuevos comercios disponibles</p>
          </div>
        ) : filtered.map(com => (
          <Link key={com.id} to={`/comercios/${com.id}`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', padding: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: 'var(--gray-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                overflow: 'hidden', flexShrink: 0
              }}>
                {com.logo ? (
                  <img src={com.logo} alt={com.nombreNegocio} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  com.nombreNegocio?.[0]
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, color: 'var(--gray-900)' }}>{com.nombreNegocio}</h3>
                <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>{com.categoria} · {com.direccion}</p>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                  fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: com.abierto === 'true' ? '#DCFCE7' : '#FEE2E2',
                  color: com.abierto === 'true' ? '#166534' : '#991B1B'
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: com.abierto === 'true' ? '#16A34A' : '#DC2626' }} />
                  {com.abierto === 'true' ? 'Abierto' : 'Cerrado'}
                </span>
                {com.calificacionPromedio > 0 && (
                  <span style={{ fontSize: 12, color: '#F59E0B' }}>
                    {'★'.repeat(Math.round(parseFloat(com.calificacionPromedio)))}
                    {' '}({com.totalCalificaciones})
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
        <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
          <img src="/GoPalermoOscuro.svg" alt="GoPalermo" style={{ maxWidth: '80%', height: 'auto' }} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
            Hecha con ayuda de IA 🤖
          </p>
        </div>

      </div>

    </div>
  );
}
