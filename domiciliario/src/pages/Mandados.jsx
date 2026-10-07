import { useState, useEffect, useCallback } from 'react';
import { mandados } from '../services/api';
import Loader from '../components/Loader';

const ESTADO_COLOR = {
  solicitado: { bg: '#FFFBEB', fg: '#92400E', label: '🔔 Solicitado' },
  tomado: { bg: '#EFF6FF', fg: '#1E40AF', label: '🛵 En curso' },
  entregado: { bg: '#DCFCE7', fg: '#166534', label: '✅ Entregado' },
  cancelado: { bg: '#FEE2E2', fg: '#991B1B', label: '❌ Cancelado' },
};

export default function Mandados() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('activos');
  const [accionando, setAccionando] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await mandados.getAll();
      setList(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const actuar = async (id, accion) => {
    setAccionando(id);
    setMsg(null);
    try {
      await mandados[accion](id);
      setMsg({ type: 'ok', text: accion === 'tomar' ? 'Diligencia tomada 🛵' : 'Diligencia entregada ✅' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'No se pudo actualizar' });
    }
    setAccionando(null);
  };

  const activos = list.filter(m => ['solicitado', 'tomado'].includes(m.estado));
  const historial = list.filter(m => !['solicitado', 'tomado'].includes(m.estado));
  const ver = filtro === 'activos' ? activos : historial;

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader /></div>;

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', color: '#5E244E' }}>🚴 Mandados Express</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>Toma diligencias y márcalas como entregadas.</p>

      {msg && (
        <div role="status" style={{ background: msg.type === 'error' ? '#FEF2F2' : '#F0FDF4', color: msg.type === 'error' ? '#991B1B' : '#166534', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['activos', 'historial'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, background: filtro === f ? '#5E244E' : '#f3f4f6', color: filtro === f ? '#fff' : '#374151' }}>
            {f === 'activos' ? `Activos (${activos.length})` : `Historial (${historial.length})`}
          </button>
        ))}
      </div>

      {ver.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🚴</div>
          {filtro === 'activos' ? 'Sin diligencias activas' : 'Sin historial'}
        </div>
      ) : ver.map(m => (
        <div key={m.id} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 14, color: '#5E244E' }}>{m.clienteNombre || 'Cliente'}</strong>
              <p style={{ fontSize: 12, color: '#374151', margin: '2px 0 0' }}>📍 {m.direccion || 'Ubicación compartida'}</p>
              {m.domiciliarioNombre && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Repartidor: {m.domiciliarioNombre}</p>}
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{m.fecha ? new Date(m.fecha).toLocaleString() : ''}</p>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: (ESTADO_COLOR[m.estado] || {}).bg || '#F3F4F6', color: (ESTADO_COLOR[m.estado] || {}).fg || '#374151' }}>
              {(ESTADO_COLOR[m.estado] || {}).label || m.estado}
            </span>
          </div>
          {(m.enlace || (m.lat && m.lng)) && (
            <a href={m.enlace || `https://maps.google.com/?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#5E244E', fontWeight: 600 }}>
              Ver ubicación ↗
            </a>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {m.estado === 'solicitado' && (
              <button onClick={() => actuar(m.id, 'tomar')} disabled={accionando === m.id}
                style={{ flex: 1, background: '#5E244E', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48 }}>
                {accionando === m.id ? '…' : '🛵 Tomar diligencia'}
              </button>
            )}
            {m.estado === 'tomado' && (
              <button onClick={() => actuar(m.id, 'entregar')} disabled={accionando === m.id}
                style={{ flex: 1, background: '#166534', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48 }}>
                {accionando === m.id ? '…' : '✅ Marcar entregada'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
