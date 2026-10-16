import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Favoritos() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('favoritos') || '[]');
    setList(stored);
  }, []);

  return (
    <div style={{ maxWidth: 480,  margin: '0 auto', padding: "0 16px 80px 16px", minHeight: "100vh"}}>
      <div style={{
        background: 'linear-gradient(to bottom, #6c234b 0%, #961e44 50%, #ee6a2d 100%)', color: '#fff', padding: '16px 16px 20px',
        position: 'sticky', top: 0, zIndex: 50, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32)'}} ><h1 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 4px' }}>Favoritos</h1></div>

      {list.length === 0 ? (
        <div className="empty-state">
          <h3>Sin favoritos</h3>
          <p>Guarda tus comercios favoritos aquí</p>
          <Link to="/comercios" className="btn btn-primary" style={{ marginTop: 16 }}>
            Explorar comercios
          </Link>
        </div>
      ) : list.map(item => (
        <Link key={item.id} to={`/comercios/${item.id}`} style={{ textDecoration: 'none' }}>
          <div className="card" style={{ marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: 'var(--gray-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
            }}>
              {item.nombre?.[0]}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, color: 'var(--gray-900)' }}>{item.nombre}</h3>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
