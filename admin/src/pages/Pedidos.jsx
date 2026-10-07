import { useState, useEffect } from 'react';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const ESTADOS = ['pendiente', 'confirmado', 'en preparación', 'recogido', 'en camino', 'entregado', 'cancelado'];

export default function Pedidos() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = () => {
    api.get('/pedidos')
      .then(({ data }) => setList(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const cambiarEstado = async (id, estado) => {
    setModal(null);
    setList(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    try {
      await api.put(`/pedidos/${id}/estado`, { estado });
    } catch {
      load();
    }
  };

  const eliminar = async (id) => {
    setModal(null);
    try {
      await api.delete(`/pedidos/${id}`);
      setList(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo eliminar el pedido');
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Pedidos</h1></div>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>ID</th><th>Cliente</th><th>Total</th><th>Método de pago</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace' }}>{p.id?.slice(0, 8)}</td>
                <td>{p.clienteNombre}</td>
                <td>${parseFloat(p.total || 0).toLocaleString('es-CO')}</td>
                <td>
                  {p.metodoPago === 'pse' ? '🏦 PSE' : p.metodoPago === 'efectivo' ? '💵 Efectivo' : p.metodoPago === 'tarjeta' ? '💳 Tarjeta (datáfono)' : '—'}
                </td>
                <td><span className={`badge`}>{p.estado}</span></td>
                <td style={{ fontSize: 13 }}>{new Date(p.fechaCreacion).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={p.estado}
                      onChange={e => {
                        const nuevoEstado = e.target.value;
                        if (nuevoEstado === p.estado) return;
                        setModal({ id: p.id, estado: nuevoEstado, pedido: p });
                      }}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--gray-200)' }}>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <button className="btn btn-danger btn-sm" title="Eliminar pedido"
                      onClick={() => setModal({ tipo: 'eliminar', id: p.id, pedido: p })}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        show={!!modal}
        title={modal?.tipo === 'eliminar' ? 'Eliminar pedido' : 'Cambiar estado'}
        message={modal?.tipo === 'eliminar'
          ? `¿Eliminar PERMANENTEMENTE el pedido #${modal?.pedido?.id?.slice(0, 8)} de ${modal?.pedido?.clienteNombre}? Esta acción no se puede deshacer.`
          : `¿Cambiar pedido #${modal?.pedido?.id?.slice(0, 8)} de "${modal?.pedido?.estado}" a "${modal?.estado}"?`}
        onConfirm={() => modal?.tipo === 'eliminar' ? eliminar(modal.id) : cambiarEstado(modal.id, modal.estado)}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
