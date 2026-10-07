import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { servicios } from '../services/api';
import Loader from '../components/Loader';

export default function ServicioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [servicio, setServicio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    servicios.getById(id)
      .then(({ data }) => setServicio(data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const abrirWhatsApp = () => {
    const numero = (servicio?.telefono || servicio?.whatsapp || '').replace(/[^0-9]/g, '');
    if (!numero) return;
    const mensaje = encodeURIComponent(`Hola ${servicio.nombre}, vi tu servicio de ${servicio.servicio} en GoPalermo y me gustaría contactarte.`);
    window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
    navigate('/');
  };

  if (loading) return <div className="loading"><Loader /></div>;
  if (!servicio) return null;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--primary)', color: 'var(--white)', padding: 16, margin: '-16px -16px 16px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', color: 'var(--white)', fontSize: 16, marginBottom: 8 }}>
          ← Volver
        </button>
        {servicio.imagen && (
          <img src={servicio.imagen} alt={servicio.nombre} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {servicio.logo && (
            <img src={servicio.logo} alt={servicio.nombre}
              style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
          )}
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>{servicio.servicio}</h1>
            <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
              {servicio.tipoPersona === 'juridica' ? 'Empresa / Persona jurídica' : 'Persona natural'}
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Proveedor
        </p>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{servicio.nombre}</h2>
        {servicio.descripcion && (
          <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.5 }}>{servicio.descripcion}</p>
        )}
      </div>

      {(servicio.telefono || servicio.whatsapp) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 4 }}>WhatsApp</p>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{servicio.telefono || servicio.whatsapp}</p>
        </div>
      )}

      <button
        onClick={abrirWhatsApp}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12,
          background: '#25D366', color: '#fff', fontSize: 15, fontWeight: 600,
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginTop: 8,
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.83 14.12c-.25.7-1.45 1.33-2 1.38-.53.05-1.2.07-1.93-.12-.45-.12-1.03-.24-1.78-.47-3.03-1-5.01-3.55-5.16-3.72-.15-.16-1.24-1.65-1.24-3.15 0-1.5.79-2.24 1.07-2.55.28-.3.61-.38.81-.38.2 0 .41 0 .58.01.19.01.44-.07.68.52.25.6.85 2.08.92 2.23.07.15.12.33.03.53-.1.2-.15.33-.3.5-.15.18-.31.4-.44.53-.15.15-.31.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.46 1.51.3.15.48.13.66-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.23.57.35.08.12.08.71-.17 1.4z"/>
        </svg>
        Contactar por WhatsApp
      </button>

      <button
        onClick={() => navigate('/')}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12, marginTop: 8,
          background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', fontSize: 15,
          fontWeight: 600, border: 'none', cursor: 'pointer',
        }}
      >
        Volver al inicio
      </button>
    </div>
  );
}
