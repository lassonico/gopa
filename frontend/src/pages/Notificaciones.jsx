import { useState, useEffect } from 'react';
import { notificaciones } from '../services/api';
import Loader from '../components/Loader';

export default function Notificaciones() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificaciones.getByUser()
      .then(({ data }) => setList(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const marcarLeida = async (id) => {
    try {
      await notificaciones.marcarLeida(id);
      setList(list.map(n => n.id === id ? { ...n, leida: 'true' } : n));
    } catch {}
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="header"><h1>Notificaciones</h1></div>

      {list.length === 0 ? (
        <div className="empty-state">
          <h3>No hay notificaciones</h3>
          <p>Te notificaremos cuando haya novedades</p>
        </div>
      ) : list.map(notif => (
        <div key={notif.id}
          className="card"
          style={{
            marginBottom: 8,
            opacity: notif.leida === 'true' ? 0.6 : 1,
            cursor: 'pointer'
          }}
          onClick={() => marcarLeida(notif.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: notif.leida === 'true' ? 400 : 600 }}>
              {notif.titulo}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
              {new Date(notif.fecha).toLocaleDateString()}
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{notif.mensaje}</p>
          {notif.leida !== 'true' && (
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 4 }} />
          )}
        </div>
      ))}
    </div>
  );
}
