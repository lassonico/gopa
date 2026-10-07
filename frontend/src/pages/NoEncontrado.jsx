import { Link } from 'react-router-dom';

export default function NoEncontrado() {
  let destino = '/login';
  let etiqueta = 'Ir a iniciar sesión';
  try {
    if (localStorage.getItem('user') && localStorage.getItem('token')) {
      destino = '/';
      etiqueta = 'Volver al inicio';
    }
  } catch {}

  return (
    <div style={{
      minHeight: '100vh', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
      background: 'linear-gradient(180deg, #f8f9fa 0%, #ffe8b4 100%)',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <style>{`@keyframes flotar404{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
      <img src="/GoPa.svg" alt="GoPalermo" style={{ width: 72, height: 72, marginBottom: 8 }} />
      <img src="/404.svg" alt="Página no encontrada"
        style={{ width: 'min(78vw, 300px)', height: 'auto', animation: 'flotar404 3s ease-in-out infinite' }} />
      <h1 style={{ color: '#5E244E', fontSize: 24, margin: '16px 0 4px' }}>
        ¡Uy! Te saliste del mapa
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px', maxWidth: 320 }}>
        Esta dirección no existe o el repartidor se la comió 🛵
      </p>
      <Link to={destino}
        style={{
          background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3',
          fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 12,
          padding: '14px 32px', textDecoration: 'none', display: 'inline-block',
        }}>
        {etiqueta}
      </Link>
    </div>
  );
}
