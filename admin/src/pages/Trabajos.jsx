import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Trabajos() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState('');
  const [accionando, setAccionando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, { data: st }] = await Promise.all([
        api.get('/trabajos'),
        api.get('/trabajos/stats'),
      ]);
      setList(Array.isArray(data) ? data : []);
      setStats(st);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reintentar = async (id) => {
    setAccionando(id);
    try {
      await api.post(`/trabajos/${id}/reintentar`);
      setAviso('Trabajo reencolado');
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo reintentar');
    }
    setAccionando(null);
  };

  const descartar = async (id) => {
    if (!window.confirm('¿Descartar este trabajo fallido?')) return;
    setAccionando(id);
    try {
      await api.delete(`/trabajos/${id}`);
      setAviso('Trabajo descartado');
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo descartar');
    }
    setAccionando(null);
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1> Cola de trabajos</h1>
      </div>

      {aviso && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
          {[['OK', stats.ok], ['Pendientes', stats.pendientes], ['Fallidos', stats.fallidos], ['En DLQ', stats.enDLQ]].map(([k, v]) => (
            <div key={k} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#5E244E' }}>{v ?? 0}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{k}</div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginBottom: 12 }}>Fallidos pendientes ({list.length})</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Tipo</th><th>Error</th><th>Intentos</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>Sin trabajos fallidos ✅</td></tr>
            ) : list.map(t => (
              <tr key={t.id}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{t.fecha ? new Date(t.fecha).toLocaleString() : '—'}</td>
                <td><strong style={{ fontSize: 13 }}>{t.tipo}</strong></td>
                <td style={{ fontSize: 12, color: '#991B1B', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.error}>{t.error || '—'}</td>
                <td style={{ textAlign: 'center' }}>{t.intentos}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-success btn-sm" disabled={accionando === t.id} onClick={() => reintentar(t.id)}>↻ Reintentar</button>
                  <button className="btn btn-outline btn-sm" disabled={accionando === t.id} onClick={() => descartar(t.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
        Los emails y push fallidos (3 reintentos: 5s, 30s, 2min) llegan aquí en vez de perderse.
      </p>
    </div>
  );
}
