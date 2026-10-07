const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const NOMBRES = { Lun: 'Lunes', Mar: 'Martes', Mie: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', Sab: 'Sábado', Dom: 'Domingo' };

export function formatoLegibleHorarios(horarios) {
  const s = String(horarios || '').trim();
  if (!s.startsWith('{')) return s || '';

  try {
    const plan = JSON.parse(s);
    const partes = [];
    for (const dia of DIAS) {
      const rango = plan[dia];
      if (rango === null || rango === undefined) continue;
      const m = String(rango).match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (!m) continue;
      const desde = `${m[1]}:${m[2]}`;
      const hasta = `${m[3]}:${m[4]}`;
      partes.push({ dia, texto: desde === '00:00' && hasta === '24:00' ? `${NOMBRES[dia]} 24 horas` : `${NOMBRES[dia]} ${desde} a ${hasta}` });
    }
    const cerrados = DIAS.filter(d => plan[d] === null || plan[d] === undefined);
    const resumen = partes.map(p => p.texto).join(', ');
    const cerradoTexto = cerrados.length === 7 ? 'Cerrado todos los días' : cerrados.length > 0 ? `, ${cerrados.map(d => NOMBRES[d]).join(', ')} cerrado` : '';
    return resumen + cerradoTexto;
  } catch {
    return s;
  }
}