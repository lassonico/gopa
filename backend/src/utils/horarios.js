const DIAS = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
const OFFSET_COLOMBIA_HORAS = -5;

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u')
    .replace(/domingo/g, ' dom ')
    .replace(/lunes/g, ' lun ')
    .replace(/martes/g, ' mar ')
    .replace(/mi[eé]rcoles/g, ' mie ')
    .replace(/jueves/g, ' jue ')
    .replace(/viernes/g, ' vie ')
    .replace(/s[aá]bado/g, ' sab ')
    .replace(/\s+/g, ' ')
    .trim();
}

function horaLocal(now, zonaLocal) {
  if (zonaLocal) {
    return { dia: now.getDay(), min: now.getHours() * 60 + now.getMinutes() };
  }
  const colombia = new Date(now.getTime() + OFFSET_COLOMBIA_HORAS * 3600 * 1000);
  return { dia: colombia.getUTCDay(), min: colombia.getUTCHours() * 60 + colombia.getUTCMinutes() };
}

function hoyEnRango(a, b, hoy) {
  if (a === b) return a === hoy;
  if (a < b) return hoy >= a && hoy <= b;
  return hoy >= a || hoy <= b;
}

function extraerDias(segmento) {
  const dias = Array.from(segmento.matchAll(/\b(dom|lun|mar|mie|jue|vie|sab)\b/g)).map(m => DIAS[m[1]]);
  if (dias.length === 0) return null;
  if (dias.length === 1) return { a: dias[0], b: dias[0], total: dias.length };
  return { a: dias[0], b: dias[dias.length - 1], total: dias.length };
}

function diaAplica(dias, dia) {
  if (!dias) return true;
  if (dias.total === 2 && dias.a === dias.b) return true;
  return hoyEnRango(dias.a, dias.b, dia);
}

function extraerHoras(segmento) {
  const m = segmento.match(/(\d{1,2})(?::(\d{2}))?\s*(?:-|a las|a la|a |hasta|a:)\s*(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  const apertura = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  const cierre = parseInt(m[3], 10) * 60 + (m[4] ? parseInt(m[4], 10) : 0);
  if (Number.isNaN(apertura) || Number.isNaN(cierre)) return null;
  return { apertura, cierre };
}

function hoyEnHoras(segmento, min) {
  const h = extraerHoras(segmento);
  if (!h) return true;
  const hoyEnApertura = min >= h.apertura;
  const hoyEnCierre = min < h.cierre;
  if (h.apertura < h.cierre) return hoyEnApertura && hoyEnCierre;
  return hoyEnApertura || hoyEnCierre;
}

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function esAbiertoAhoraDirecto(horarios, now, opts) {
  const s = String(horarios || '').trim();
  if (!s.startsWith('{')) return null;

  let plan;
  try {
    plan = JSON.parse(s);
  } catch {
    return null;
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return false;

  const { dia, min } = horaLocal(now, opts.zonaLocal);
  const rango = plan[NOMBRES_DIA[dia]];
  if (rango === null || rango === undefined || rango === '') return false;

  const m = String(rango).match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return false;

  const apertura = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const cierre = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (cierre > 1440 || apertura >= 1440) return false;

  if (apertura === cierre) return false;
  if (apertura === 0 && cierre === 1440) return true;
  if (apertura < cierre) return min >= apertura && min < cierre;
  return min >= apertura || min < cierre;
}

function esAbiertoAhora(horarios, now = new Date(), opts = {}) {
  const directo = esAbiertoAhoraDirecto(horarios, now, opts);
  if (directo !== null) return directo;

  if (/24.*(horas?|h)\b|todo el di[ae]|abierto todo|24h/i.test(horarios || '')) return true;

  const texto = normalizar(horarios);
  if (!texto) return true;

  const { dia, min } = horaLocal(now, opts.zonaLocal);
  const segmentos = texto.split(',')
    .map(s => s.trim().replace(/^(y|e)\s+/, ''))
    .filter(Boolean);

  for (const segmento of segmentos) {
    if (/24.*(horas?|h)\b|todo el di[ae]/i.test(segmento)) return true;
    const dias = extraerDias(segmento);
    if (!diaAplica(dias, dia)) continue;
    if (hoyEnHoras(segmento, min)) return true;
  }

  return false;
}

module.exports = { esAbiertoAhora, DIAS_SEMANA };