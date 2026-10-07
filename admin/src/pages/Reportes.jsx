import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

function fmtCOP(n) {
  return `$${parseFloat(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Reportes() {
  const [desde, setDesde] = useState(firstOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [resumen, setResumen] = useState(null);
  const [comercios, setComercios] = useState(null);
  const [iva, setIva] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { desde, hasta };
      const [r, c, i] = await Promise.all([
        api.get('/contabilidad/resumen', { params }),
        api.get('/contabilidad/comercios', { params }),
        api.get('/contabilidad/iva', { params })
      ]);
      setResumen(r.data);
      setComercios(c.data);
      setIva(i.data);
    } catch (e) {
      console.error('Error cargando reportes:', e.response?.data || e.message);
      setResumen(null); setComercios(null); setIva(null);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const url = `/api/contabilidad/export/csv?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
    const token = localStorage.getItem('admin_token');
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte-contable-${desde}-${hasta}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(e => console.error('Error exportando CSV:', e));
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div>
      <div className="admin-header">
        <h1>Reportes Contables</h1>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#6b7280' }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#6b7280' }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Cargando...' : 'Filtrar'}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={exportCSV}>⬇️ Exportar CSV</button>
            <button className="btn btn-outline" onClick={exportPDF}>🖨️ Imprimir / PDF</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><Loader /></div>
      ) : !resumen ? (
        <p>Sin datos para el período seleccionado.</p>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <h3>Ingresos (pagos completados)</h3>
              <div className="value green">{fmtCOP(resumen.totalIngresos)}</div>
            </div>
            <div className="stat-card">
              <h3>Base gravable (sin IVA)</h3>
              <div className="value">{fmtCOP(resumen.baseGravable)}</div>
            </div>
            <div className="stat-card">
              <h3>IVA 19%</h3>
              <div className="value orange">{fmtCOP(resumen.iva)}</div>
            </div>
            <div className="stat-card">
              <h3>Pagos completados</h3>
              <div className="value">{resumen.totalPagos}</div>
            </div>
            <div className="stat-card">
              <h3>Ticket promedio</h3>
              <div className="value">{fmtCOP(resumen.ticketPromedio)}</div>
            </div>
            <div className="stat-card">
              <h3>Comisión plataforma</h3>
              <div className="value red">{fmtCOP(comercios?.totalComision || 0)}</div>
            </div>
            <div className="stat-card">
              <h3>Neto a comercios</h3>
              <div className="value green">{fmtCOP(comercios?.totalNeto || 0)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="table-container" style={{ padding: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Ventas por día</h3>
              {resumen.ventasPorDia?.length ? (
                <table>
                  <thead><tr><th>Fecha</th><th>Total</th></tr></thead>
                  <tbody>
                    {resumen.ventasPorDia.map((v, i) => (
                      <tr key={i}><td>{v.fecha}</td><td>{fmtCOP(v.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin datos</p>}
            </div>

            <div className="table-container" style={{ padding: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Ventas por método de pago</h3>
              {resumen.porMetodo?.length ? (
                <table>
                  <thead><tr><th>Método</th><th>Total</th></tr></thead>
                  <tbody>
                    {resumen.porMetodo.map((m, i) => (
                      <tr key={i}>
                        <td style={{ textTransform: 'capitalize' }}>{m.metodo}</td>
                        <td>{fmtCOP(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin datos</p>}
            </div>
          </div>

          <div className="table-container" style={{ padding: 16, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12 }}>Ingresos por comercio (venta bruta / comisión / neto)</h3>
            {comercios?.comercios?.length ? (
              <table>
                <thead>
                  <tr><th>Comercio</th><th>Pedidos</th><th>Ventas</th><th>Comisión %</th><th>Comisión</th><th>Neto a pagar</th></tr>
                </thead>
                <tbody>
                  {comercios.comercios.map((c, i) => (
                    <tr key={i}>
                      <td><strong>{c.nombre}</strong></td>
                      <td>{c.pedidos}</td>
                      <td>{fmtCOP(c.ventas)}</td>
                      <td>{c.comisionPct}%</td>
                      <td>{fmtCOP(c.comision)}</td>
                      <td style={{ color: '#166534', fontWeight: 600 }}>{fmtCOP(c.neto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td colSpan="2"><strong>{comercios.comercios.reduce((s, c) => s + c.pedidos, 0)}</strong></td>
                    <td colSpan="2"><strong>{fmtCOP(comercios.totalComision)}</strong></td>
                    <td><strong>{fmtCOP(comercios.totalNeto)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin datos</p>}
          </div>

          <div className="table-container" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Desglose IVA para DIAN</h3>
            <table>
              <tbody>
                <tr><td><strong>Tarifa IVA</strong></td><td>{Math.round(iva?.ivaRate * 100)}%</td></tr>
                <tr><td><strong>Monto con IVA</strong></td><td>{fmtCOP(iva?.montoConIVA)}</td></tr>
                <tr><td><strong>Base gravable</strong></td><td>{fmtCOP(iva?.baseGravable)}</td></tr>
                <tr><td><strong>IVA liquidado</strong></td><td>{fmtCOP(iva?.iva)}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}