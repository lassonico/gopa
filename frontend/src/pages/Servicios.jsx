import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import Loader from '../components/Loader';

export default function Servicios() {
  const navigate = useNavigate();
  const { serviciosList, loaded } = useData();

  if (!loaded) return <div className="loading"><Loader /></div>;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div style={{
        background: 'linear-gradient(135deg, #5c1b3f, #aa1c41)', color: '#fff',
        padding: '16px 16px 20px', margin: '-16px -16px 20px', borderRadius: '0 0 24px 24px',
        position: 'relative', overflow: 'hidden',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, marginBottom: 8, cursor: 'pointer' }}>
          ← Volver
        </button>
        <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 80, opacity: 0.12 }}>🛠️</div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffe8b4', margin: 0 }}>
          Plomería · Trasteos · Reparaciones
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 4px' }}>Servicios</h1>
        <p style={{ fontSize: 13, opacity: 0.95, margin: 0 }}>
          {serviciosList.length > 0 ? `${serviciosList.length} servicio${serviciosList.length !== 1 ? 's' : ''} disponible${serviciosList.length !== 1 ? 's' : ''}` : 'Servicios para tu hogar y negocio'}
        </p>
      </div>

      {serviciosList.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px dashed #d1d5db',
        }}>
          <p style={{ fontSize: 32, margin: 0 }}>🛠️</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '8px 0 4px' }}>
            No hay servicios registrados aún
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Pronto tendremos plomería, trasteos, reparaciones y más disponibles para ti.
          </p>
        </div>
      )}
      {serviciosList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {serviciosList.map(s => (
            <div key={s.id} role="link" tabIndex={0} aria-label={`Ver servicio ${s.nombre}`}
              onClick={() => navigate(`/servicios/${s.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/servicios/${s.id}`); } }}
              style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {s.logo ? (
                  <img src={s.logo} alt={s.nombre} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: '#5e244e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                    {(s.nombre || '?')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 15, color: '#5e244e' }}>{s.nombre}</strong>
                    <span style={{ fontSize: 11, color: '#e68457', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {s.servicio}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {s.tipoPersona === 'juridica' ? 'Empresa' : 'Persona natural'}
                  </span>
                </div>
              </div>
              {s.descripcion && (
                <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0 0' }}>{s.descripcion}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
