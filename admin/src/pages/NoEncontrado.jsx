import { Link } from 'react-router-dom';

export default function NoEncontrado() {
  let destino = '/login';
  let etiqueta = 'Ir a iniciar sesión';
  try {
    if (localStorage.getItem('admin_user') && localStorage.getItem('admin_token')) {
      destino = '/';
      etiqueta = 'Volver al panel';
    }
  } catch {}

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
      background: '#f8f9fa', fontFamily: "'Poppins', sans-serif",
    }}>
      <style>{`@keyframes flotar404{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
      <img src="/GoPa.svg" alt="GoPalermo" style={{ width: 72, height: 72, marginBottom: 8 }} />
      <img src="/404.svg" alt="Página no encontrada"
        style={{ width: 'min(78vw, 300px)', height: 'auto', animation: 'flotar404 3s ease-in-out infinite' }} />
      <h1 style={{ color: '#5E244E', fontSize: 24, margin: '16px 0 4px' }}>
        Página no encontrada
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px', maxWidth: 320 }}>
        La ruta que buscas no existe en el panel de administración.
      </p>
      <Link to={destino} className="btn btn-primary" style={{ textDecoration: 'none', padding: '12px 32px' }}>
        {etiqueta}
      </Link>
    </div>
  );
}
