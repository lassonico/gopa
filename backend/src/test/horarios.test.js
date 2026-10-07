import { describe, it, expect } from 'vitest';
import { esAbiertoAhora } from '../utils/horarios.js';

describe('esAbiertoAhora - parser de horarios', () => {
  const lunes830 = { zonaLocal: true, ahora: new Date(2026, 7, 10, 8, 30) }; // lunes 8:30
  const lunes12 = { zonaLocal: true, ahora: new Date(2026, 7, 10, 12, 0) };  // lunes 12:00
  const lunes20 = { zonaLocal: true, ahora: new Date(2026, 7, 10, 20, 0) };  // lunes 20:00

  it('sin horario configurado asume abierto', () => {
    expect(esAbiertoAhora('', lunes830.ahora, lunes830)).toBe(true);
  });

  it('reconoce "Lun-Dom 0 - 24" como siempre abierto', () => {
    expect(esAbiertoAhora('Lun-Dom 0 - 24', lunes12.ahora, lunes12)).toBe(true);
  });

  it('dentro del horario devuelve abierto', () => {
    expect(esAbiertoAhora('Lun-Vie 8 - 19', lunes12.ahora, lunes12)).toBe(true);
  });

  it('fuera del horario devuelve cerrado', () => {
    expect(esAbiertoAhora('Lun-Vie 8 - 19', lunes20.ahora, lunes20)).toBe(false);
  });

  it('reconoce formato "lunes a sabado de 9 a 21"', () => {
    expect(esAbiertoAhora('lunes a sabado de 9 a 21', lunes12.ahora, lunes12)).toBe(true);
    expect(esAbiertoAhora('lunes a sabado de 9 a 21', lunes830.ahora, lunes830)).toBe(false);
  });

  it('"Dom-dom" (mismo día inicio y fin) aplica todos los días de la semana', () => {
    const domingo10 = { zonaLocal: true, ahora: new Date(2026, 7, 9, 10, 0) };
    const lunes10 = { zonaLocal: true, ahora: new Date(2026, 7, 10, 10, 0) };
    const sabado20 = { zonaLocal: true, ahora: new Date(2026, 7, 15, 20, 0) };
    expect(esAbiertoAhora('Dom-dom 5 a 11', domingo10.ahora, domingo10)).toBe(true);
    expect(esAbiertoAhora('Dom-dom 5 a 11', lunes10.ahora, lunes10)).toBe(true);
    expect(esAbiertoAhora('Dom-dom 5 - 23', sabado20.ahora, sabado20)).toBe(true);
  });

  it('reconoce "24 horas" como siempre abierto', () => {
    expect(esAbiertoAhora('24 horas', lunes20.ahora, lunes20)).toBe(true);
  });

  it('múltiples segmentos por coma', () => {
    expect(esAbiertoAhora('Lun-Vie 8 a 19, Sab 9 a 14', lunes12.ahora, lunes12)).toBe(true);
    const sabado10 = { zonaLocal: true, ahora: new Date(2026, 7, 8, 10, 0) };
    const sabado16 = { zonaLocal: true, ahora: new Date(2026, 7, 8, 16, 0) };
    expect(esAbiertoAhora('Lun-Vie 8 a 19, Sab 9 a 14', sabado10.ahora, sabado10)).toBe(true);
    expect(esAbiertoAhora('Lun-Vie 8 a 19, Sab 9 a 14', sabado16.ahora, sabado16)).toBe(false);
  });

  describe('formato JSON por día', () => {
    const lunes930 = { zonaLocal: true, ahora: new Date(2026, 7, 10, 9, 30) }; // lunes 9:30
    const lunes1630 = { zonaLocal: true, ahora: new Date(2026, 7, 10, 16, 30) }; // lunes 16:30
    const domingo10 = { zonaLocal: true, ahora: new Date(2026, 7, 9, 10, 0) };  // domingo 10:00
    const sabado22 = { zonaLocal: true, ahora: new Date(2026, 7, 8, 22, 0) };   // sábado 22:00
    const sabado130 = { zonaLocal: true, ahora: new Date(2026, 7, 9, 1, 30) };  // domingo 1:30 (madrugada del sábado)

    const plan = JSON.stringify({
      Lun: '09:00-17:00', Mie: '09:00-17:00',
      Sab: '14:00-03:00', Dom: null
    });

    it('abierto dentro del horario del día', () => {
      expect(esAbiertoAhora(plan, lunes930.ahora, lunes930)).toBe(true);
      expect(esAbiertoAhora(plan, lunes1630.ahora, lunes1630)).toBe(true);
    });

    it('cerrado fuera del rango del día', () => {
      expect(esAbiertoAhora(plan, lunes830.ahora, lunes830)).toBe(false);
    });

    it('día sin definir cierra', () => {
      const martes10 = { zonaLocal: true, ahora: new Date(2026, 7, 11, 10, 0) };
      expect(esAbiertoAhora(plan, martes10.ahora, martes10)).toBe(false);
    });

    it('día explícitamente null cierra', () => {
      expect(esAbiertoAhora(plan, domingo10.ahora, domingo10)).toBe(false);
    });

    it('rango que cruza medianoche (Sab 14-03)', () => {
      expect(esAbiertoAhora(plan, sabado22.ahora, sabado22)).toBe(true);
      expect(esAbiertoAhora(plan, sabado130.ahora, sabado130)).toBe(false);
    });

    it('24h con "00:00-24:00" siempre abierto', () => {
      const plan24 = JSON.stringify({ Lun: '00:00-24:00', Mar: '00:00-24:00' });
      expect(esAbiertoAhora(plan24, domingo10.ahora, domingo10)).toBe(false);
      expect(esAbiertoAhora(plan24, lunes12.ahora, lunes12)).toBe(true);
      expect(esAbiertoAhora(plan24, { zonaLocal: true, ahora: new Date(2026, 7, 10, 23, 59) }.ahora, { zonaLocal: true, ahora: new Date(2026, 7, 10, 23, 59) })).toBe(true);
    });

    it('JSON inválido cae al parser de texto', () => {
      expect(esAbiertoAhora('{broken', lunes12.ahora, lunes12)).toBe(true);
    });
  });
});