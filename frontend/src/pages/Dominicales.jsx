import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { comercios } from '../services/api';
import Loader from '../components/Loader';
import { esComercioTienda } from '../utils/tiendas';
import { esCiudadNeiva } from '../utils/formatTiempo';

// ¿El comercio abre los domingos según sus horarios?
// Formato JSON: {"Lun":"17:00-23:00",...,"Dom":"09:00-15:00" | null}
// Legacy texto: busca "dom..." con rango de horas.
function abreDomingo(horarios) {
  const s = String(horarios || '').trim();
  if (!s) return false;
  if (s.startsWith('{')) {
    try {
      const plan = JSON.parse(s);
      const dom = plan.Dom ?? plan.dom;
      return typeof dom === 'string' && /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(dom.trim());
    } catch { return false; }
  }
  const t = s.toLowerCase();
  return /\bdom[^\n,;]*\d{1,2}(:\d{2})?\s*(-|a|hasta)\s*\d/i.test(t);
}

export default function Dominicales() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    comercios.getAll()
      .then(({ data }) => setList(
        (Array.isArray(data) ? data : []).filter(c =>
          !esCiudadNeiva(c.ciudad) && !esComercioTienda(c) &&
          (c.dominical === 'true' || abreDomingo(c.horarios))
        )
      ))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div style={{ maxWidth: 480,  margin: '0 auto', paddingBottom: "80px", minHeight: "100vh"}}>
      <div style={{
        background: 'linear-gradient(to bottom, #6c234b 0%, #961e44 50%, #ee6a2d 100%)', color: '#fff', padding: '16px 16px 20px',
        position: 'sticky', top: 0, zIndex: 50, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32)', overflow: 'hidden',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, marginBottom: 8, cursor: 'pointer' }}>
          ← Volver
        </button>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffe8b4', margin: 0 }}>
          El plan del domingo
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 4px' }}>Dominicales</h1>
        <p style={{ fontSize: 13, opacity: 0.95, margin: 0 }}>
          {list.length > 0 ? `${list.length} lugar${list.length !== 1 ? 'es' : ''} abierto${list.length !== 1 ? 's' : ''} este domingo` : 'Comercios que abren los domingos'}
        </p>
      </div>

      {list.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 28, gap: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
        }}>
          <span style={{ fontSize: 40 }}>🍽️</span>
          <strong style={{ fontSize: 16, color: '#5e244e' }}>Sin dominicales por ahora</strong>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 320 }}>
            Aún no hay comercios con horario de domingo registrado.
          </p>
        </div>
      )}
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.map(com => (
            <Link key={com.id} to={`/comercios/${com.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff', borderRadius: 16, padding: 12, display: 'flex',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#e68457' }} />
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
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
