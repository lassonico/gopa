import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import api from '../services/api';
import Loader from '../components/Loader';

const DIAS = [
  { key: 'Lun', label: 'Lunes' },
  { key: 'Mar', label: 'Martes' },
  { key: 'Mie', label: 'Miércoles' },
  { key: 'Jue', label: 'Jueves' },
  { key: 'Vie', label: 'Viernes' },
  { key: 'Sab', label: 'Sábado' },
  { key: 'Dom', label: 'Domingo' },
];

const pad = n => String(n).padStart(2, '0');
const HORAS = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) HORAS.push(`${pad(h)}:${pad(m)}`);
}
HORAS.push('24:00');

const DEFAULT_DIA = { desde: '08:00', hasta: '22:00', cerrado: false };

function planInicial(horarios) {
  const base = {};
  DIAS.forEach(d => { base[d.key] = { ...DEFAULT_DIA }; });
  const s = String(horarios || '').trim();
  if (!s.startsWith('{')) return base;
  try {
    const plan = JSON.parse(s);
    DIAS.forEach(d => {
      const rango = plan[d.key];
      if (rango === null || rango === undefined) {
        base[d.key] = { ...DEFAULT_DIA, cerrado: true };
      } else {
        const m = String(rango).match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
        if (m) {
          base[d.key] = { desde: `${m[1]}:${m[2]}`, hasta: `${m[3]}:${m[4]}`, cerrado: false };
        }
      }
    });
  } catch {}
  return base;
}

function serializar(plan) {
  const out = {};
  DIAS.forEach(d => {
    const dia = plan[d.key];
    if (dia.cerrado) { out[d.key] = null; return; }
    if (dia.desde === dia.hasta) {
      out[d.key] = dia.desde === '00:00' ? '00:00-24:00' : null;
      return;
    }
    out[d.key] = `${dia.desde}-${dia.hasta}`;
  });
  return out;
}

const selectStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '2px solid var(--gray-200)',
  borderRadius: 8,
  background: '#fff',
  fontSize: 14,
};

export default function Horarios() {
  const { user } = useAuth();
  const [plan, setPlan] = useState(() => planInicioDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [abierto, setAbierto] = useState(null);

  function planInicioDefault() {
    const base = {};
    DIAS.forEach(d => { base[d.key] = { ...DEFAULT_DIA }; });
    return base;
  }

  const load = async () => {
    try {
      const { data } = await api.get(`/comercios/${user.comercioId}`);
      setPlan(planInicial(data.horarios));
      setAbierto(data.abierto);
    } catch (e) {
      console.error('Error cargando horarios:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setDia = (key, campo, valor) => {
    setPlan(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }));
  };

  const copiarLunes = () => {
    const lunes = plan.Lun;
    setPlan(prev => {
      const next = { ...prev };
      DIAS.forEach(d => { next[d.key] = { ...lunes }; });
      return next;
    });
  };

  const guardar = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/comercios/${user.comercioId}/horarios`, { horarios: serializar(plan) });
      await load();
      setMessage({ type: 'success', text: 'Horario de atención actualizado. Los pedidos se activan y desactivan automáticamente según este horario.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Error guardando horario' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader /></div>;

  return (
    <div className="container" style={{ maxWidth: 520, padding: 16 }}>
      <h3 style={{ color: '#5E244E', marginBottom: 4 }}>Horarios de Atención</h3>
      <p style={{ color: 'var(--gray-600)', fontSize: 13, marginTop: 0 }}>
        Define el horario de cada día. Cuando estés fuera de horario, tu comercio no recibirá pedidos automáticamente.
      </p>

      {abierto !== null && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: abierto === 'true' ? '#DCFCE7' : '#FEE2E2',
          color: abierto === 'true' ? '#166534' : '#991B1B',
        }}>
          Ahora mismo: {abierto === 'true' ? '🟢 Recibiendo pedidos' : '🔴 Fuera de horario'}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={copiarLunes}
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          Copiar horario de Lunes a toda la semana
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {DIAS.map((d, i) => (
          <div key={d.key} style={{
            display: 'grid',
            gridTemplateColumns: '92px 1fr 1fr 64px',
            gap: 8,
            alignItems: 'center',
            padding: '10px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--gray-100)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{d.label}</div>
            <select
              disabled={plan[d.key].cerrado}
              value={plan[d.key].desde}
              onChange={e => setDia(d.key, 'desde', e.target.value)}
              style={{ ...selectStyle, opacity: plan[d.key].cerrado ? 0.5 : 1 }}
              aria-label={`${d.label} apertura`}
            >
              {HORAS.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select
              disabled={plan[d.key].cerrado}
              value={plan[d.key].hasta}
              onChange={e => setDia(d.key, 'hasta', e.target.value)}
              style={{ ...selectStyle, opacity: plan[d.key].cerrado ? 0.5 : 1 }}
              aria-label={`${d.label} cierre`}
            >
              {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <label style={{ fontSize: 12, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={plan[d.key].cerrado}
                onChange={e => setDia(d.key, 'cerrado', e.target.checked)}
              />
              Cerrado
            </label>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
        Si el horario cruza la medianoche (ej. 22:00 a 03:00), el cierre aplica al día siguiente.
      </div>

      {message && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 12,
          background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: message.type === 'success' ? '#166534' : '#991B1B',
        }}>
          {message.text}
        </div>
      )}

      <button
        onClick={guardar}
        disabled={saving}
        className="btn btn-primary"
        style={{ width: '100%', padding: '12px 24px', fontSize: 14 }}
      >
        {saving ? 'Guardando...' : 'Guardar Horario'}
      </button>
    </div>
  );
}