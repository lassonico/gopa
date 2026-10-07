export function formatTiempoEstimado(tiempo) {
  const s = String(tiempo ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    const min = parseInt(s, 10);
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return m ? `${h} h ${m} min` : `${h} h`;
    }
    return `${min} min`;
  }
  return s;
}

export function esCiudadNeiva(ciudad) {
  return String(ciudad || '').toLowerCase() === 'neiva';
}