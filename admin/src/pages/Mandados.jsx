import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

const ESTADOS = ['todos', 'solicitado', 'tomado', 'entregado', 'cancelado'];

export default function Mandados() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [aviso, setAviso] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mandados');
      setList(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const eliminar = async () => {
    if (!confirmId) return;
    setBorrando(true);
    try {
      await api.delete(`/mandados/${confirmId}`);
      setAviso('Diligencia eliminada');
      setConfirmId(null);
      load();
    } catch (e) {
      setAviso('');
      alert(e.response?.data?.error || 'No se pudo eliminar');
    }
    setBorrando(false);
  };

  const filtrados = filtro === 'todos' ? list : list.filter(m => m.estado === filtro);

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🚴 Mandados Express ({list.length})</h1>
      </div>

      {aviso && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {ESTADOS.map(e => (
          <button key={e} onClick={() => setFiltro(e)} className={filtro === e ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>
            {e === 'todos' ? `Todos (${list.length})` : `${e} (${list.filter(m => m.estado === e).length})`}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Cliente</th><th>Dirección</th><th>Repartidor</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>Sin diligencias</td></tr>
            ) : filtrados.map(m => (
              <tr key={m.id}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{m.fecha ? new Date(m.fecha).toLocaleString() : '—'}</td>
                <td><strong>{m.clienteNombre || '—'}</strong><br /><span style={{ fontSize: 12, color: '#6b7280' }}>{m.clienteTelefono || ''}</span></td>
                <td style={{ fontSize: 13 }}>{m.direccion || 'Ubicación compartida'}</td>
                <td style={{ fontSize: 13 }}>{m.domiciliarioNombre || '—'}</td>
                <td><span className={`badge badge-${m.estado === 'entregado' ? 'success' : m.estado === 'cancelado' ? 'danger' : m.estado === 'tomado' ? 'info' : 'warning'}`}>{m.estado}</span></td>
                <td>
                  {confirmId === m.id ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-danger btn-sm" disabled={borrando} onClick={eliminar}>{borrando ? '…' : 'Confirmar'}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setConfirmId(null)}>No</button>
                    </span>
                  ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(m.id)}>🗑 Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
        Las diligencias entregadas o canceladas con más de 30 días se eliminan automáticamente.
      </p>
    </div>
  );
}
