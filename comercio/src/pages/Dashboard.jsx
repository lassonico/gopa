import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearCache } from '../services/api';
import { useAuth } from '../App';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const PAGO_LABEL = {
  pse: '🏦 En línea (Wompi)',
  efectivo: '💵 Efectivo al recibir',
  tarjeta: '💳 Tarjeta al recibir',
};

function parseProductos(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  try {
    const v = JSON.parse(p);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function minutosDesde(fecha) {
  const d = new Date(fecha);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
}

let sharedCtx = null;
function getCtx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctx();
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  } catch { return null; }
}

export function unlockAudio() {
  getCtx();
}

// Sirena fuerte: 3 tonos ascendentes, ganancia alta
function sirenaFuerte() {
  try {
    const ctx = getCtx();
    if (!ctx) return false;
    const t0 = ctx.currentTime;
    [660, 880, 1180].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      const t = t0 + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.22);
    });
    return true;
  } catch { return false; }
}

function vibrarFuerte() {
  try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch {}
}

function esHoy(fecha) {
  const d = new Date(fecha);
  if (isNaN(d)) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const byFechaAsc = (a, b) => new Date(a.fechaCreacion || 0) - new Date(b.fechaCreacion || 0);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAnuncioInfo, setShowAnuncioInfo] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [activo, setActivo] = useState(true);
  const [horarioAbierto, setHorarioAbierto] = useState(true);
  const [modal, setModal] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [accionando, setAccionando] = useState({});
  const [, setTick] = useState(0);
  const [alarma, setAlarma] = useState(null); // { nuevos }
  const prevPendientes = useRef(0);
  const baseAlarma = useRef(0);
  const alarmaTimer = useRef(null);
  const firstLoad = useRef(true);

  const detenerAlarma = useCallback((marcarVistos = true) => {
    if (alarmaTimer.current) { clearInterval(alarmaTimer.current); alarmaTimer.current = null; }
    try { navigator.vibrate?.(0); } catch {}
    document.title = 'GoPalermo Comercio';
    if (marcarVistos) baseAlarma.current = prevPendientes.current;
    setAlarma(null);
  }, []);

  const sonarCiclo = useCallback(() => {
    sirenaFuerte();
    vibrarFuerte();
  }, []);

  const activarAlarma = useCallback((nuevos) => {
    setAlarma({ nuevos });
    sonarCiclo();
    if (!alarmaTimer.current) {
      alarmaTimer.current = setInterval(sonarCiclo, 2500);
    }
  }, [sonarCiclo]);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async (isManual = false) => {
    if (!user?.comercioId) { setLoading(false); setRefreshing(false); return; }
    if (isManual) setRefreshing(true);
    setError('');
    try {
      const [{ data: pedidosData }, { data: comercio }] = await Promise.all([
        api.get('/pedidos', { noCache: true }),
        api.get(`/comercios/${user.comercioId}`, { noCache: true })
      ]);
      const lista = Array.isArray(pedidosData) ? pedidosData : [];
      const nPend = lista.filter(p => p.estado === 'pendiente').length;
      if (!firstLoad.current && nPend > prevPendientes.current) {
        const nuevos = nPend - prevPendientes.current;
        if (baseAlarma.current < prevPendientes.current) baseAlarma.current = prevPendientes.current;
        activarAlarma(nuevos);
      } else if (nPend <= baseAlarma.current && alarmaTimer.current) {
        // Ya atendió los pendientes (confirmó / puso en cocina): silenciar solo
        detenerAlarma(false);
      }
      prevPendientes.current = nPend;
      firstLoad.current = false;
      setPedidos(lista);
      setActivo(comercio.activo !== 'false' && comercio.activo !== false);
      // horarioAbierto viene separado del backend; fallback a abierto para compatibilidad
      if (comercio.horarioAbierto !== undefined) {
        setHorarioAbierto(comercio.horarioAbierto !== 'false' && comercio.horarioAbierto !== false);
      } else {
        setHorarioAbierto(comercio.abierto !== 'false' && comercio.abierto !== false);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError('No se pudo actualizar. Revisa tu conexión e intenta de nuevo.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.comercioId, activarAlarma, detenerAlarma]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => load(), 15000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Refrescar cuando llega push foreground
  useEffect(() => {
    const h = () => { clearCache('/pedidos'); load(); };
    window.addEventListener('gopalermo:new-order', h);
    return () => window.removeEventListener('gopalermo:new-order', h);
  }, [load]);

  // Desbloquear audio con el primer gesto (política autoplay del navegador)
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Parpadear título mientras hay alarma + limpiar al salir
  useEffect(() => {
    if (!alarma) return;
    let visible = true;
    const t = setInterval(() => {
      document.title = visible ? `🔔 (${alarma.nuevos}) ¡Pedido nuevo!` : 'GoPalermo Comercio';
      visible = !visible;
    }, 1000);
    return () => { clearInterval(t); document.title = 'GoPalermo Comercio'; };
  }, [alarma]);

  useEffect(() => () => {
    if (alarmaTimer.current) clearInterval(alarmaTimer.current);
    document.title = 'GoPalermo Comercio';
  }, []);

  const toggleActivo = async () => {
    const next = !activo;
    setActivo(next);
    try {
      const { data } = await api.put(`/comercios/${user.comercioId}/toggle-activo`);
      clearCache();
      // Sincronizar con lo que confirma el backend
      if (data?.activo !== undefined) {
        setActivo(data.activo !== 'false' && data.activo !== false);
      }
      showToast(next ? '🟢 Recibiendo pedidos' : '🔴 Pausaste los pedidos');
    } catch (e) {
      console.error(e);
      setActivo(!next);
      const msg = e.response?.data?.error || 'No se pudo cambiar. Intenta de nuevo.';
      showToast(msg, 'error');
    }
  };

  const cambiarEstado = async (id, estado, opts = {}) => {
    if (opts.requireConfirm) {
      setModal({ id, estado });
      return;
    }
    setModal(null);
    setAccionando(prev => ({ ...prev, [id]: estado }));
    const prev = pedidos;
    setPedidos(p => p.map(x => x.id === id ? { ...x, estado } : x));
    try {
      await api.put(`/pedidos/${id}/estado`, { estado });
      clearCache('/pedidos');
      showToast(estado === 'cancelado' ? 'Pedido cancelado' : 'Estado actualizado ✅');
      load();
    } catch (e) {
      console.error(e);
      setPedidos(prev);
      showToast('Falló el cambio. Se revirtió, intenta de nuevo.', 'error');
    }
    setAccionando(prevA => ({ ...prevA, [id]: undefined }));
  };

  const pendientes = pedidos.filter(p => p.estado === 'pendiente').sort(byFechaAsc);
  const programados = pedidos.filter(p => p.estado === 'programado')
    .sort((a, b) => new Date(a.fechaProgramada || 0) - new Date(b.fechaProgramada || 0));
  const enPreparacion = pedidos.filter(p => p.estado === 'en preparación' || p.estado === 'confirmado').sort(byFechaAsc);
  const listos = pedidos.filter(p => p.estado === 'recogido').sort(byFechaAsc);
  const entregadosHoy = pedidos.filter(p => p.estado === 'entregado' && esHoy(p.fechaCreacion)).sort(byFechaAsc).slice(-5).reverse();
  const totalHoy = pedidos.filter(p => esHoy(p.fechaCreacion));
  const ventasHoy = entregadosHoy.reduce((s, p) => s + parseFloat(p.total || 0), 0);

  const recibiendo = activo && horarioAbierto;
  const fueraHorario = !horarioAbierto;

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader text="Cargando pedidos..." /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, color: '#5E244E' }}>Dashboard</h3>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }} aria-live="polite">
            {refreshing ? 'Actualizando…' : lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => load(true)} disabled={refreshing} aria-label="Actualizar pedidos"
            style={{ padding: '10px 14px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, color: '#5E244E', cursor: refreshing ? 'wait' : 'pointer', minHeight: 44 }}>
            {refreshing ? '⟳…' : '⟳ Actualizar'}
          </button>
          <button onClick={toggleActivo} aria-pressed={recibiendo}
            title="Pausar o reanudar pedidos manualmente"
            style={{ padding: '10px 16px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: recibiendo ? '#dcfce7' : '#fef2f2', color: recibiendo ? '#166534' : '#991b1b', minHeight: 44 }}>
            {recibiendo ? '🟢 Recibiendo' : !activo ? '🔴 Pausado' : '🔴 Fuera de horario'}
          </button>
        </div>
      </div>

      {alarma && (
        <div role="alert" style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#991b1b', color: '#fff', padding: '12px 14px', borderRadius: 12,
          marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 14px rgba(153,27,27,0.4)'
        }}>
          <span style={{ fontSize: 26 }} aria-hidden="true">🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>¡{alarma.nuevos} pedido(s) nuevo(s) sin atender!</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Suena hasta que confirmes o pongas en cocina</div>
          </div>
          <button onClick={() => { document.getElementById('sec-pendientes')?.scrollIntoView({ behavior: 'smooth' }); }}
            style={{ background: '#fff', color: '#991b1b', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', minHeight: 48 }}>
            Ver
          </button>
          <button onClick={() => detenerAlarma()} aria-label="Silenciar alarma"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 48 }}>
            Silenciar
          </button>
        </div>
      )}

      {toast && (
        <div role="status" style={{ background: toast.type === 'error' ? '#FEF2F2' : toast.type === 'info' ? '#EFF6FF' : '#F0FDF4', color: toast.type === 'error' ? '#991B1B' : toast.type === 'info' ? '#1E40AF' : '#166534', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 500 }}>
          {toast.msg}
        </div>
      )}

      {error && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error} <button onClick={() => load(true)} style={{ marginLeft: 8, background: '#991B1B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', minHeight: 36 }}>Reintentar</button>
        </div>
      )}

      {fueraHorario && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          Fuera de tu horario de atención: no recibes pedidos. Se reactivará solo al entrar en horario.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <StatBox label="Hoy" value={totalHoy.length} color="#5E244E" />
        <StatBox label="Pendientes" value={pendientes.length} color="#e68457" alert={pendientes.length > 0} />
        <StatBox label="En cocina" value={enPreparacion.length} color="#aa1c41" />
        <StatBox label={`Ventas hoy $${ventasHoy.toLocaleString()}`} value={entregadosHoy.length} color="#166534" sub="entregados" />
      </div>

      <Seccion titulo={`Pendientes (${pendientes.length})`} color="#e68457" vacio="Sin pendientes. Todo al día ✅" hay={pendientes.length > 0} id="sec-pendientes">
        {pendientes.map(p => <PedidoCard key={p.id} pedido={p} accionando={accionando[p.id]} onAction={cambiarEstado} />)}
      </Seccion>

      {programados.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#1E40AF', marginBottom: 8 }}>📅 Programados ({programados.length}) — entran solos a su hora</h4>
          {programados.map(p => (
            <div key={p.id} style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#1E40AF' }}>
              <span>📅 {p.clienteNombre} · {p.fechaProgramada ? new Date(p.fechaProgramada).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              <span>${parseFloat(p.total).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <Seccion titulo={`En cocina (${enPreparacion.length})`} color="#aa1c41" vacio="" hay={enPreparacion.length > 0}>
        {enPreparacion.map(p => <PedidoCard key={p.id} pedido={p} accionando={accionando[p.id]} onAction={cambiarEstado} />)}
      </Seccion>

      <Seccion titulo={`Listos (${listos.length})`} color="#166534" vacio="" hay={listos.length > 0}>
        {listos.map(p => <PedidoCard key={p.id} pedido={p} accionando={accionando[p.id]} onAction={cambiarEstado} />)}
      </Seccion>

      {entregadosHoy.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#6b7280', marginBottom: 8, fontSize: 13 }}>Entregados hoy (recientes)</h4>
          {entregadosHoy.map(p => (
            <div key={p.id} style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
              <span>✅ {p.clienteNombre} · #{String(p.id).slice(0, 8)}</span>
              <span>${parseFloat(p.total).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowAnuncioInfo(true)} aria-label="Crear anuncio"
        style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 900,
          background: 'linear-gradient(135deg, #5E244E, #aa1c41)', color: '#fff',
          border: 'none', borderRadius: 999, padding: '14px 20px',
          fontSize: 14, fontWeight: 800, cursor: 'pointer', minHeight: 52,
          boxShadow: '0 8px 24px rgba(94,36,78,0.4)', display: 'flex', alignItems: 'center', gap: 8
        }}>
        📢 Anuncio
      </button>

      {showAnuncioInfo && (
        <div role="dialog" aria-modal="true" aria-label="Información del anuncio"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAnuncioInfo(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 40, textAlign: 'center' }}>📢</div>
            <h3 style={{ margin: '8px 0 12px', color: '#5E244E', textAlign: 'center' }}>Anúnciate en GoPalermo</h3>
            <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px' }}>💰 <strong>Costo: $20.000</strong> por <strong>5 días calendario</strong>.</p>
              <p style={{ margin: '0 0 8px' }}>🖼️ Tu anuncio se mostrará en la <strong>sección de anuncios banner</strong>, en la parte superior del inicio de la app.</p>
              <p style={{ margin: 0 }}>💳 Pago en línea con Wompi.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowAnuncioInfo(false)}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 52 }}>
                Cancelar
              </button>
              <button onClick={() => { setShowAnuncioInfo(false); navigate('/anuncios'); }}
                style={{ flex: 1, background: '#5E244E', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 52 }}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!modal}
        title="Cancelar pedido"
        message={modal ? `¿Cancelar el pedido de ${pedidos.find(p => p.id === modal.id)?.clienteNombre || 'este cliente'} por $${parseFloat(pedidos.find(p => p.id === modal.id)?.total || 0).toLocaleString()}? Esta acción avisa al cliente y no se puede deshacer.` : ''}
        onConfirm={() => cambiarEstado(modal.id, modal.estado)}
        onCancel={() => setModal(null)}
        confirmLabel="Sí, cancelar pedido"
        confirmColor="#991b1b"
      />
    </div>
  );
}

function Seccion({ titulo, color, children, vacio, hay, id }) {
  if (!hay) {
    if (!vacio) return null;
    return (
      <div id={id} style={{ background: '#fff', borderRadius: 12, padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }} aria-hidden="true">✅</div>
        {vacio}
      </div>
    );
  }
  return (
    <div id={id} style={{ marginTop: 8, scrollMarginTop: 8 }}>
      <h4 style={{ color, marginBottom: 8 }}>{titulo}</h4>
      {children}
    </div>
  );
}

function StatBox({ label, value, color, alert, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: alert ? '0 0 0 2px #e68457' : '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}{sub ? ` ${sub}` : ''}</div>
    </div>
  );
}

function PedidoCard({ pedido, onAction, accionando }) {
  const min = minutosDesde(pedido.fechaCreacion);
  const urgente = pedido.estado === 'pendiente' && min >= 10;
  const items = parseProductos(pedido.productos);
  const totalItems = items.reduce((s, it) => s + parseInt(it.cantidad || it.qty || 1), 0);
  const busy = !!accionando;

  const tiempoColor = min >= 15 ? '#991b1b' : min >= 8 ? '#e68457' : '#6b7280';
  const tiempoBg = min >= 15 ? '#FEE2E2' : min >= 8 ? '#FFF7ED' : '#F3F4F6';

  return (
    <article aria-label={`Pedido de ${pedido.clienteNombre}`} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8, borderLeft: urgente ? '4px solid #991b1b' : pedido.estado === 'pendiente' ? '4px solid #e68457' : '4px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 15, color: '#5E244E' }}>{pedido.clienteNombre}</strong>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>#{String(pedido.id).slice(0, 8)} · {new Date(pedido.fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{totalItems ? ` · ${totalItems} ítem(s)` : ''}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>${parseFloat(pedido.total).toLocaleString()}</div>
          <span style={{ display: 'inline-block', marginTop: 4, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: tiempoBg, color: tiempoColor }}>
            ⏱ {min} min
          </span>
        </div>
      </div>

      {items.length > 0 && (
        <p style={{ fontSize: 13, color: '#374151', margin: '6px 0', lineHeight: 1.4 }}>
          {items.slice(0, 3).map(it => `${it.cantidad || it.qty || 1}× ${it.nombre || it.name || 'Producto'}`).join(' · ')}
          {items.length > 3 ? ` +${items.length - 3} más` : ''}
        </p>
      )}
      <p style={{ fontSize: 12, margin: '4px 0 0', fontWeight: 600, color: '#374151' }}>
        {PAGO_LABEL[pedido.metodoPago] || `💵 ${pedido.metodoPago || 'Efectivo'}`}
      </p>
      {pedido.direccionEntrega && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>📍 {pedido.direccionEntrega}</p>}
      {pedido.notas && <p style={{ fontSize: 12, color: '#92400e', background: '#FFFBEB', borderRadius: 6, padding: '6px 8px', margin: '6px 0 0' }}>📝 {pedido.notas}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {pedido.estado === 'pendiente' && (
          <>
            <ActionBtn primary label={busy ? '…' : '✅ Confirmar'} color="#166534" disabled={busy} onClick={() => onAction(pedido.id, 'confirmado')} />
            <ActionBtn label="Cancelar" color="#fff" textColor="#991b1b" border onClick={() => onAction(pedido.id, 'cancelado', { requireConfirm: true })} />
          </>
        )}
        {pedido.estado === 'confirmado' && (
          <ActionBtn primary label={busy ? '…' : '👨‍🍳 A cocina'} color="#e68457" disabled={busy} onClick={() => onAction(pedido.id, 'en preparación')} />
        )}
        {pedido.estado === 'en preparación' && (
          <ActionBtn primary label={busy ? '…' : '📦 Listo / Recogido'} color="#5E244E" disabled={busy} onClick={() => onAction(pedido.id, 'recogido')} />
        )}
        {pedido.estado === 'recogido' && (
          <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Esperando domiciliario 🛵</span>
        )}
      </div>
    </article>
  );
}

function ActionBtn({ label, color, onClick, disabled, primary, textColor, border }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        flex: primary ? 2 : 1, background: color, color: textColor || '#fff',
        border: border ? '1px solid #fecaca' : 'none', borderRadius: 10,
        padding: '12px 16px', fontSize: 14, fontWeight: 600,
        cursor: disabled ? 'wait' : 'pointer', minHeight: 48, opacity: disabled ? 0.7 : 1
      }}>
      {label}
    </button>
  );
}
