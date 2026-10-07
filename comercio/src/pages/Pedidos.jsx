import { useState, useEffect } from 'react';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const ACTION_LABELS = {
  confirmado: { label: '✅ Confirmar', color: '#166534', confirmMsg: 'confirmar', confirmColor: '#166534' },
  cancelado: { label: '❌ Cancelar', color: '#991b1b', confirmMsg: 'cancelar', confirmColor: '#991b1b' },
  'en preparación': { label: '👨‍🍳 Preparar', color: '#e68457', confirmMsg: 'marcar como "en preparación"', confirmColor: '#e68457' },
  recogido: { label: '📦 Recogido', color: '#5E244E', confirmMsg: 'marcar como "recogido"', confirmColor: '#5E244E' },
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
      <h3 style={{ color: '#5E244E', marginBottom: 12 }}>Todos los Pedidos</h3>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
        {['todos', 'pendiente', 'confirmado', 'en preparación', 'recogido', 'entregado', 'cancelado'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: filtro === f ? '#5E244E' : '#f3f4f6', color: filtro === f ? '#fff' : '#374151' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No hay pedidos {filtro !== 'todos' && `en estado "${filtro}"`}</p>
      ) : filtrados.map(p => (
        <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <strong style={{ fontSize: 14, color: '#5E244E' }}>{p.clienteNombre}</strong>
            <span style={{ fontSize: 12, color: '#6b7280' }}>${parseFloat(p.total).toLocaleString()}</span>
          </div>
          <p style={{ fontSize: 12, color: '#666', margin: 0 }}>#{p.id.slice(0, 8)} - {new Date(p.fechaCreacion).toLocaleString()}</p>
          <p style={{ fontSize: 12, margin: '4px 0 0', fontWeight: 600, color: p.metodoPago === 'pse' ? '#166534' : '#e68457' }}>
            {p.metodoPago === 'pse' ? '🏦 Pago en línea (Wompi)' : p.metodoPago === 'efectivo' ? '💵 Efectivo al recibir' : p.metodoPago === 'tarjeta' ? '💳 Tarjeta (datáfono) al recibir' : '💵 Efectivo al recibir'}
          </p>
          {parseFloat(p.costoEmpaque || 0) > 0 && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0' }}>📦 Empaque: +${parseFloat(p.costoEmpaque).toLocaleString()}</p>
          )}
          {p.direccionEntrega && <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0' }}>📍 {p.direccionEntrega}</p>}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {p.estado === 'pendiente' && <>
              <ActionBtn label="✅ Confirmar" color="#166534" onClick={() => setModal({ id: p.id, estado: 'confirmado' })} />
              <ActionBtn label="❌ Cancelar" color="#991b1b" onClick={() => setModal({ id: p.id, estado: 'cancelado' })} />
            </>}
            {p.estado === 'confirmado' && <ActionBtn label="👨‍🍳 Preparar" color="#e68457" onClick={() => setModal({ id: p.id, estado: 'en preparación' })} />}
            {p.estado === 'en preparación' && <ActionBtn label="📦 Recogido" color="#5E244E" onClick={() => setModal({ id: p.id, estado: 'recogido' })} />}
          </div>
        </div>
      ))}

      <ConfirmModal
        show={!!modal}
        title={ACTION_LABELS[modal?.estado]?.label || 'Cambiar estado'}
        message={`¿${ACTION_LABELS[modal?.estado]?.confirmMsg || 'cambiar estado'} del pedido?`}
        onConfirm={() => cambiarEstado(modal.id, modal.estado)}
        onCancel={() => setModal(null)}
        confirmLabel="Sí, continuar"
        confirmColor={ACTION_LABELS[modal?.estado]?.confirmColor}
      />
    </div>
  );
}

function ActionBtn({ label, color, onClick }) {
  return <button onClick={onClick} style={{ background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{label}</button>;
}
