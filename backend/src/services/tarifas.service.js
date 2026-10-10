async function leerTarifas(repository) {
  const SHEET = 'Configuraciones';
  const res = { comisionVentas: 0, valorDomicilio: 0 };
  try {
    const [c1, c2] = await Promise.all([
      repository.findOne(SHEET, 'clave', 'comisionVentas').catch(() => null),
      repository.findOne(SHEET, 'clave', 'valorDomicilio').catch(() => null),
    ]);
    if (c1?.valor !== undefined && c1?.valor !== null) {
      const n = Number(String(c1.valor).replace(',', '.'));
      if (Number.isFinite(n)) res.comisionVentas = n;
    }
    if (c2?.valor !== undefined && c2?.valor !== null) {
      const n = Number(String(c2.valor).replace(',', '.'));
      if (Number.isFinite(n)) res.valorDomicilio = n;
    }
  } catch (e) {}
  return res;
}

module.exports = { leerTarifas };
