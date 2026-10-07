import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../App';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const ACTION_MAP = {
  'en camino': { msg: 'marcar como "en camino" y salir a entregar', color: '#5E244E', label: '🛵 Ir a entregar' },
  entregado: { msg: 'marcar como "entregado"', color: '#166534', label: '✅ Entregado' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [mandados, setMandados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [gpsActivo, setGpsActivo] = useState(true);
  const [modal, setModal] = useState(null);
  const [pos, setPos] = useState(null);
  const [posError, setPosError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/pedidos', { params: { estado: 'recogido,en camino,entregado' } });
      setPedidos(data);
      setDisponible(user.disponible !== 'false');
    } catch (e) { console.error(e); }
    try {
      const { data } = await api.get('/mandados', { params: { t: Date.now() } });
      setMandados(data.filter(m => m.estado === 'solicitado'));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!gpsActivo) {
      setPos(null);
      setPosError('');
      return;
    }
    if (!('geolocation' in navigator)) {
      setPosError('Tu dispositivo no soporta ubicación.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => setPos({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
      }),
      (err) => setPosError(`No se pudo obtener tu ubicación (${err.code === 1 ? 'permiso denegado' : err.message}).`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsActivo]);

  useEffect(() => {
    if (!gpsActivo || !pos) return;
    const misActivos = pedidos.filter(p => (!p.domiciliarioId || p.domiciliarioId === user.id) && ['recogido', 'en camino'].includes(p.estado));
    if (misActivos.length === 0) return;
    const enviar = async () => {
      for (const p of misActivos) {
        try {
          await api.put(`/pedidos/${p.id}/ubicacion`, { lat: pos.lat, lng: pos.lng });
        } catch (e) { console.error(e); }
      }
    };
    enviar();
    const interval = setInterval(enviar, 5000);
    return () => clearInterval(interval);
  }, [gpsActivo, pos, pedidos, user.id]);

  const toggleDisponible = async () => {
    try {
      await api.put(`/domiciliarios/${user.id}/toggle-disponible`);
      setDisponible(!disponible);
    } catch (e) { console.error(e); }
  };

  const cambiarEstado = async (id, estado) => {
    setModal(null);
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    try {
      await api.put(`/pedidos/${id}/estado`, { estado });
    } catch {
      load();
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader /></div>;

  const pendientes = pedidos.filter(p => p.estado === 'recogido');
  const enCamino = pedidos.filter(p => p.estado === 'en camino');
  const entregados = pedidos.filter(p => p.estado === 'entregado');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: '#5E244E' }}>Dashboard</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={toggleDisponible}
            style={{ padding: '10px 18px', borderRadius: 24, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: disponible ? '#dcfce7' : '#fef2f2', color: disponible ? '#166534' : '#991b1b', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
            {disponible ? '🟢 Disponible' : '🔴 No disponible'}
          </button>
          <button onClick={() => setGpsActivo(!gpsActivo)}
            style={{ padding: '10px 18px', borderRadius: 24, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: gpsActivo ? '#dbeafe' : '#f3f4f6', color: gpsActivo ? '#1e40af' : '#6b7280', boxShadow: '0 2px 8px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {gpsActivo ? '📍 GPS ON' : '📍 GPS OFF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <StatBox label="Para recoger" value={pendientes.length} color="#e68457" />
        <StatBox label="En camino" value={enCamino.length} color="#aa1c41" />
        <StatBox label="Entregados hoy" value={entregados.length} color="#166534" />
      </div>

      <div style={{
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 16,
        background: gpsActivo ? (pos ? '#ecfdf5' : '#fefce8') : '#f9fafb',
        border: gpsActivo ? (pos ? '2px solid #10b981' : '2px solid #f59e0b') : '2px dashed #d1d5db',
        boxShadow: '0 2px 12px rgba(0,0,0,.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>
          {gpsActivo ? (pos ? '📡' : '📍') : '🛑'}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: gpsActivo ? (pos ? '#065f46' : '#92400e') : '#6b7280' }}>
            {gpsActivo ? (pos ? 'Transmitiendo ubicación en vivo' : 'Obteniendo señal GPS...') : 'GPS desactivado — el cliente no te verá en el mapa'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: gpsActivo ? (pos ? '#047857' : '#b45309') : '#9ca3af' }}>
            {pos ? `Precisión: ${Math.round(pos.accuracy)} m · Se envía cada 5 s a ${pedidos.filter(p => (!p.domiciliarioId || p.domiciliarioId === user.id) && ['recogido', 'en camino'].includes(p.estado)).length} pedido(s) activo(s)` : (posError ? `⚠️ ${posError}` : 'Esperando primera ubicación...')}
          </div>
        </div>
        {pos && gpsActivo && (
          <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
            EN VIVO
          </span>
        )}
      </div>

      {mandados.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#aa1c41', marginBottom: 8 }}>🚴 Mandados Express ({mandados.length})</h4>
          {mandados.map(m => (
            <div key={m.id} style={{ background: '#FFF5FB', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid #F3D9E8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: '#5E244E' }}>{m.clienteNombre}</strong>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.fecha ? new Date(m.fecha).toLocaleTimeString() : ''}</span>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0' }}>
                {m.direccion || `📍 ${m.enlace || 'Ubicación enviada'}`}
              </p>
              {m.enlace && (
                <a href={m.enlace} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#e68457', fontWeight: 600 }}>
                  Ver mapa ↗
                </a>
              )}
              {m.clienteTelefono && (
                <a href={`tel:${m.clienteTelefono}`} style={{ display: 'block', fontSize: 12, color: '#aa1c41', fontWeight: 600, marginTop: 4 }}>
                  📞 {m.clienteTelefono}
                </a>
              )}
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>Tarifa por acordar con el cliente 💬</p>
            </div>
          ))}
        </div>
      )}

      {pendientes.length > 0 && (
        <div>
          <h4 style={{ color: '#e68457', marginBottom: 8 }}>Pedidos para Recoger</h4>
          {pendientes.map(p => (
            <PedidoCard key={p.id} pedido={p} onAction={() => setModal({ id: p.id, estado: 'en camino', clienteNombre: p.clienteNombre })} actionLabel="🛵 Ir a entregar" actionColor="#5E244E" />
          ))}
        </div>
      )}

      {enCamino.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#aa1c41', marginBottom: 8 }}>En Camino</h4>
          {enCamino.map(p => (
            <PedidoCard key={p.id} pedido={p} onAction={() => setModal({ id: p.id, estado: 'entregado', clienteNombre: p.clienteNombre })} actionLabel="✅ Entregado" actionColor="#166534" />
          ))}
        </div>
      )}

      {entregados.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#166534', marginBottom: 8 }}>Entregados Hoy</h4>
          {entregados.map(p => (
            <div key={p.id} style={{ background: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <strong style={{ fontSize: 14, color: '#166534' }}>{p.clienteNombre}</strong>
              <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>📍 {p.direccionEntrega}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        show={!!modal}
        title={modal ? (ACTION_MAP[modal.estado]?.label || 'Cambiar estado') : ''}
        message={modal ? `¿${ACTION_MAP[modal.estado]?.msg || 'cambiar estado'} el pedido de ${modal.clienteNombre}?` : ''}
        onConfirm={() => cambiarEstado(modal.id, modal.estado)}
        onCancel={() => setModal(null)}
        confirmLabel="Sí, continuar"
        confirmColor={modal ? (ACTION_MAP[modal.estado]?.color) : undefined}
      />
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function PedidoCard({ pedido, onAction, actionLabel, actionColor }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong style={{ fontSize: 14, color: '#5E244E' }}>{pedido.clienteNombre}</strong>
        <span style={{ fontSize: 12, color: '#6b7280' }}>${parseFloat(pedido.total).toLocaleString()}</span>
      </div>
      <p style={{ fontSize: 12, color: '#666', margin: 0 }}>📍 {pedido.direccionEntrega}</p>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>#{pedido.id.slice(0, 8)} - {new Date(pedido.fechaCreacion).toLocaleTimeString()}</p>
      <button onClick={onAction} style={{ background: actionColor, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', marginTop: 8 }}>
        {actionLabel}
      </button>
    </div>
  );
}
