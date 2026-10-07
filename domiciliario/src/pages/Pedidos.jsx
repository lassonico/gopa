import { useState, useEffect } from 'react';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const ACTION_MAP = {
  'en camino': { msg: 'marcar como "en camino"', color: '#5E244E', label: '🛵 En camino' },
  entregado: { msg: 'marcar como "entregado"', color: '#166534', label: '✅ Entregado' },
};

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [modal, setModal] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get('/pedidos');
      data.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
      setPedidos(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const cambiarEstado = async (id, estado) => {
    setModal(null);
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    try {
      await api.put(`/pedidos/${id}/estado`, { estado });
    } catch {
      load();
    }
  };

  const filtrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader /></div>;

  return (
    <div>
      <h3 style={{ color: '#5E244E', marginBottom: 12 }}>Historial de Pedidos</h3>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
        {['todos', 'recogido', 'en camino', 'entregado'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: filtro === f ? '#5E244E' : '#f3f4f6', color: filtro === f ? '#fff' : '#374151' }}>
            {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No hay pedidos disponibles</p>
      ) : filtrados.map(p => (
        <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <strong style={{ fontSize: 14, color: '#5E244E' }}>{p.clienteNombre}</strong>
            <span style={{ fontSize: 12, color: '#6b7280' }}>${parseFloat(p.total).toLocaleString()}</span>
          </div>
          <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>📍 {p.direccionEntrega}</p>
          {p.lat && p.lng && (
            <div style={{ marginTop: 8 }}>
              <iframe
                title={`Mapa pedido #${p.id.slice(0, 8)}`}
                src={`https://maps.google.com/maps?q=${p.lat},${p.lng}&z=16&output=embed`}
                style={{ width: '100%', height: 150, border: 0, borderRadius: 10 }}
                allowFullScreen
              />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#5E244E', color: '#fff', textDecoration: 'none',
                  borderRadius: 8, padding: '8px 0', marginTop: 6, fontSize: 13, fontWeight: 600
                }}
              >
                🗺️ Navegar a la entrega
              </a>
            </div>
          )}
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>#{p.id.slice(0, 8)} - {new Date(p.fechaCreacion).toLocaleString()}</p>
          <p style={{ fontSize: 12, margin: '4px 0 0', fontWeight: 600, color: p.metodoPago === 'pse' ? '#166534' : '#e68457' }}>
            {p.metodoPago === 'pse' ? '🏦 Pago en línea (Wompi)' : p.metodoPago === 'efectivo' ? '💵 Cobrar en efectivo al entregar' : p.metodoPago === 'tarjeta' ? '💳 Cobrar con datáfono al entregar' : '💵 Cobrar al entregar'}
          </p>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {p.estado === 'recogido' && <ActionBtn label="🛵 En camino" color="#5E244E" onClick={() => setModal({ id: p.id, estado: 'en camino' })} />}
            {p.estado === 'en camino' && <ActionBtn label="✅ Entregado" color="#166534" onClick={() => setModal({ id: p.id, estado: 'entregado' })} />}
          </div>
        </div>
      ))}

      <ConfirmModal
        show={!!modal}
        title={modal ? (ACTION_MAP[modal.estado]?.label || 'Cambiar estado') : ''}
        message={modal ? `¿${ACTION_MAP[modal.estado]?.msg || 'cambiar estado'} este pedido?` : ''}
        onConfirm={() => cambiarEstado(modal.id, modal.estado)}
        onCancel={() => setModal(null)}
        confirmLabel="Sí, continuar"
        confirmColor={modal ? (ACTION_MAP[modal.estado]?.color) : undefined}
      />
    </div>
  );
}

function ActionBtn({ label, color, onClick }) {
  return <button onClick={onClick} style={{ background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{label}</button>;
}
