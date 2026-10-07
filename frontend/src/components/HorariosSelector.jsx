import { useState } from 'react';

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

export function planDesdeHorarios(horarios) {
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
        if (m) base[d.key] = { desde: `${m[1]}:${m[2]}`, hasta: `${m[3]}:${m[4]}`, cerrado: false };
      }
    });
  } catch {}
  return base;
}

export function serializarPlan(plan) {
  const out = {};
  DIAS.forEach(d => {
    const dia = plan[d.key];
    if (!dia) return;
    if (dia.cerrado) { out[d.key] = null; return; }
    if (dia.desde === dia.hasta) {
      out[d.key] = dia.desde === '00:00' ? '00:00-24:00' : null;
      return;
    }
    out[d.key] = `${dia.desde}-${dia.hasta}`;
  });
  return JSON.stringify(out);
}

export function planPorDefecto() {
  const base = {};
  DIAS.forEach(d => { base[d.key] = { ...DEFAULT_DIA }; });
  return base;
}

const selectStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontSize: 14,
  color: '#374151',
};

export default function HorariosSelector({ value, onChange }) {
  const [plan, setPlan] = useState(() => planDesdeHorarios(value));

  const setDia = (key, campo, val) => {
    const next = { ...plan, [key]: { ...plan[key], [campo]: val } };
    setPlan(next);
    onChange(serializarPlan(next));
  };

  const copiarLunes = () => {
    const next = {};
    DIAS.forEach(d => { next[d.key] = { ...plan.Lun }; });
    setPlan(next);
    onChange(serializarPlan(next));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          type="button"
          onClick={copiarLunes}
          style={{
            background: 'none', border: '1px solid var(--gray-300)', color: '#5E244E',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Copiar horario de Lunes a toda la semana
        </button>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        {DIAS.map((d, i) => (
          <div
            key={d.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 1fr 72px',
              gap: 8,
              alignItems: 'center',
              padding: '9px 12px',
              borderTop: i === 0 ? 'none' : '1px solid var(--gray-100)',
              background: i % 2 ? '#FAFAFB' : '#fff',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{d.label}</div>
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
            <label style={{ fontSize: 11, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
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
    </div>
  );
}