import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Favoritos() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('favoritos') || '[]');
    setList(stored);
  }, []);

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="header"><h1>Favoritos</h1></div>

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
