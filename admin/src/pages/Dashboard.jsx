import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

const fmtCOP = (n) => `$${parseFloat(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtCOPraw = (n) => Math.round(parseFloat(n || 0) * 100) / 100;

const CHART_COLORS = ['#5E244E', '#961E44', '#e68457', '#FDB515', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#64748B'];
const ESTADO_COLORS = {
  'pendiente': '#F59E0B',
  'confirmado': '#3B82F6',
  'en preparación': '#8B5CF6',
  'recogido': '#06B6D4',
  'en camino': '#e68457',
  'entregado': '#10B981',
  'cancelado': '#EF4444',
};

const ESTADO_LABEL = {
  'pendiente': 'Pendiente',
  'confirmado': 'Confirmado',
  'en preparación': 'En preparación',
  'recogido': 'Recogido',
  'en camino': 'En camino',
  'entregado': 'Entregado',
  'cancelado': 'Cancelado',
};

function GrowthBadge({ pct }) {
  if (pct == null) return <span style={{ fontSize: 12, color: '#9ca3af' }}>s/d mes anterior</span>;
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: up ? '#166534' : '#991B1B', background: up ? '#DCFCE7' : '#FEE2E2', padding: '2px 8px', borderRadius: 20 }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function EditModal({ commerce, onClose, onSave }) {
  const [form, setForm] = useState({ ...commerce });
  const [saving, setSaving] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (form.comision != null && form.comision !== '') body.comision = Number(String(form.comision).replace(',', '.'));
      await api.put(`/comercios/${commerce.id}`, body);
      onSave();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!commerce) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 4px' }}>
          <h3 style={{ margin: 0, color: '#5E244E' }}>Editar Comercio</h3>
          <button aria-label="Cerrar" onClick={onClose} disabled={saving}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>ID: {commerce.id}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {['nombreNegocio','nombrePropietario','telefono','direccion','horarios','categoria','ciudad','costoEnvio','tiempoEstimado','rangoPrecio','redesSociales'].map(field => (
            <div className="form-group" key={field} style={{ gridColumn: ['direccion','redesSociales'].includes(field) ? '1 / -1' : undefined }}>
              <label>{field === 'ciudad' ? 'Ciudad' : field.replace(/([A-Z])/g,' $1').replace(/^./, s => s.toUpperCase())}</label>
              {field === 'ciudad' ? (
                <select name="ciudad" value={form.ciudad || 'palermo'} onChange={handleChange}>
                  <option value="palermo">Palermo</option>
                  <option value="neiva">Neiva</option>
                </select>
              ) : field === 'direccion' || field === 'redesSociales' ? (
                <textarea name={field} value={form[field] || ''} onChange={handleChange} rows={2} />
              ) : (
                <input name={field} value={form[field] || ''} onChange={handleChange} />
              )}
            </div>
          ))}
          <div className="form-group">
            <label>Comisión (%)</label>
            <input name="comision" type="number" min="0" max="100" step="0.1"
              value={form.comision ?? ''} onChange={handleChange} placeholder="10" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Descripción</label>
            <textarea name="descripcion" value={form.descripcion || ''} onChange={handleChange} rows={3} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingCommerce, setEditingCommerce] = useState(null);

  const load = () => {
    api.get('/dashboard')
      .then(({ data }) => setData(data))
      .catch(e => console.error('Dashboard error:', e.response?.data || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading"><Loader /></div>;
  if (!data) return <p>Error al cargar dashboard</p>;

  const c = data.comparativoMes || {};
  // Defensa: el backend llegó a enviar pedidosMes como array de objetos -> React error #31.
  // Normalizamos a número para que nunca se renderice un objeto como hijo.
  const pedidosMesCount = Array.isArray(c.pedidosMes) ? c.pedidosMes.length : c.pedidosMes;
  const pedidosMesAntCount = Array.isArray(c.pedidosMesAnterior) ? c.pedidosMesAnterior.length : c.pedidosMesAnterior;
  const pieData = (data.distribucionEstados || []).map(d => ({
    ...d,
    label: ESTADO_LABEL[d.estado] || d.estado,
    color: ESTADO_COLORS[d.estado] || '#64748B',
  }));
  const maxVentasComercio = Math.max(1, ...(data.topComerciosVentas || []).map(t => t.ventas));
  const ticketPromedioAnterior = c.pedidosMesAnterior ? fmtCOPraw(c.ventasMesAnterior / c.pedidosMesAnterior) : 0;

  return (
    <div>
      <EditModal
        commerce={editingCommerce}
        onClose={() => setEditingCommerce(null)}
        onSave={() => { setEditingCommerce(null); load(); }}
      />

      <div className="admin-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Ventas del día</h3>
          <div className="value green">{fmtCOP(data.ventasHoy)}</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{data.pedidosHoy} pedidos</p>
        </div>
        <div className="stat-card">
          <h3>Ventas del mes</h3>
          <div className="value">{fmtCOP(data.ventasMes)}</div>
          <div style={{ marginTop: 4 }}><GrowthBadge pct={c.crecimientoVentasPct} /></div>
        </div>
        <div className="stat-card">
          <h3>Pedidos hoy</h3>
          <div className="value orange">{data.pedidosHoy}</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>vs {pedidosMesAntCount ?? '—'} mes anterior</p>
        </div>
        <div className="stat-card">
          <h3>Pedidos activos</h3>
          <div className="value orange">{data.pedidosActivos}</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>en curso</p>
        </div>
        <div className="stat-card">
          <h3>Ticket promedio mes</h3>
          <div className="value">{fmtCOP(data.ticketPromedioMes)}</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{data.pedidosMes} pedidos en el mes</p>
        </div>
        <div className="stat-card">
          <h3>Pedidos del mes</h3>
          <div className="value">{data.pedidosMes}</div>
          <div style={{ marginTop: 4 }}><GrowthBadge pct={c.crecimientoPedidosPct} /></div>
        </div>
        <div className="stat-card">
          <h3>Comercios aprobados</h3>
          <div className="value green">{data.comerciosAprobados}</div>
        </div>
        <div className="stat-card">
          <h3>Pendientes aprobación</h3>
          <div className="value red">{data.comerciosPendientes}</div>
        </div>
        <div className="stat-card">
          <h3>Usuarios registrados</h3>
          <div className="value">{data.usuariosRegistrados}</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{data.nuevosUsuariosMes} nuevos este mes</p>
        </div>
        <div className="stat-card">
          <h3>Tiempo promedio</h3>
          <div className="value">{data.tiempoPromedioPreparacion}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="table-container" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Ventas últimos 14 días</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.ventasPorDia || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={46} />
                <Tooltip formatter={(value) => [fmtCOP(value), 'Ventas']} labelStyle={{ fontWeight: 600 }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {(data.ventasPorDia || []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="table-container" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Pedidos por estado</h3>
          <div style={{ width: '100%', height: 240 }}>
            {pieData.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="cantidad" nameKey="label"
                    innerRadius={45} outerRadius={80} paddingAngle={2}
                    label={({ cantidad }) => cantidad}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin datos</p>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="table-container" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Top comercios por ventas del mes</h3>
          {data.topComerciosVentas?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.topComerciosVentas.map((t, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{i + 1}. {t.nombre}</span>
                    <span style={{ color: '#166534', fontWeight: 700 }}>{fmtCOP(t.ventas)}</span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(to right, #5E244E, #961E44)', width: `${(t.ventas / maxVentasComercio) * 100}%`, borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{t.pedidos} pedidos</div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin ventas este mes</p>}
        </div>

        <div className="table-container" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Comparativo mes actual vs anterior</h3>
          <table>
            <thead>
              <tr><th></th><th>Mes actual</th><th>Mes anterior</th><th>Cambio</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Ventas</strong></td>
                <td>{fmtCOP(c.ventasMes)}</td>
                <td>{fmtCOP(c.ventasMesAnterior)}</td>
                <td><GrowthBadge pct={c.crecimientoVentasPct} /></td>
              </tr>
              <tr>
                <td><strong>Pedidos</strong></td>
                <td>{pedidosMesCount}</td>
                <td>{pedidosMesAntCount}</td>
                <td><GrowthBadge pct={c.crecimientoPedidosPct} /></td>
              </tr>
              <tr>
                <td><strong>Ticket promedio</strong></td>
                <td>{fmtCOP(data.ticketPromedioMes)}</td>
                <td>{fmtCOP(ticketPromedioAnterior)}</td>
                <td>—</td>
              </tr>
              <tr>
                <td><strong>Nuevos usuarios</strong></td>
                <td>{data.nuevosUsuariosMes}</td>
                <td>{c.nuevosUsuariosAnterior ?? '—'}</td>
                <td>—</td>
              </tr>
              <tr>
                <td><strong>Nuevos comercios</strong></td>
                <td>{data.nuevosComerciosMes}</td>
                <td>{c.nuevosComerciosAnterior ?? '—'}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="table-container" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Productos más vendidos</h3>
          {data.productosMasVendidos?.length > 0 ? (
            <table>
              <thead>
                <tr><th>Producto</th><th>Ventas</th></tr>
              </thead>
              <tbody>
                {data.productosMasVendidos.map((p, i) => (
                  <tr key={i}><td>{p.nombre}</td><td>{p.pedidosCount || 0}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin datos</p>}
        </div>

        <div className="table-container" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Comercios mejor calificados</h3>
          {data.comerciosMejorCalificados?.length > 0 ? (
            <table>
              <thead>
                <tr><th>ID</th><th>Comercio</th><th>Calificación</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {data.comerciosMejorCalificados.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{c.id?.slice(0, 8)}</td>
                    <td><strong>{c.nombreNegocio}</strong></td>
                    <td>{'★'.repeat(Math.round(parseFloat(c.calificacionPromedio)))} {c.calificacionPromedio}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => setEditingCommerce(c)}>✎ Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin datos</p>}
        </div>
      </div>

      <div className="table-container" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>Pedidos recientes</h3>
        {data.pedidosRecientes?.length > 0 ? (
          <table>
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Comercio</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {data.pedidosRecientes.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize: 11, fontFamily: 'monospace', color: '#999' }}>{p.id?.slice(0, 8)}</td>
                  <td>{p.clienteNombre}</td>
                  <td>{p.comercioNombre || '—'}</td>
                  <td>${parseFloat(p.total || 0).toLocaleString('es-CO')}</td>
                  <td><span className="badge">{p.estado}</span></td>
                  <td style={{ fontSize: 13 }}>{new Date(p.fechaCreacion).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" title="Eliminar pedido"
                      onClick={() => setModalEliminar({ id: p.id, cliente: p.clienteNombre })}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Sin pedidos</p>}
      </div>

      <ConfirmModal
        show={!!modalEliminar}
        title="Eliminar pedido"
        message={`¿Eliminar PERMANENTEMENTE el pedido #${modalEliminar?.id?.slice(0, 8)} de ${modalEliminar?.cliente}? Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          setModalLoading(true);
          try {
            await api.delete(`/pedidos/${modalEliminar.id}`);
            setModalEliminar(null);
            load();
          } catch (e) {
            alert(e.response?.data?.error || 'No se pudo eliminar el pedido');
            setModalEliminar(null);
          }
          setModalLoading(false);
        }}
        onCancel={() => setModalEliminar(null)}
        loading={modalLoading}
      />
    </div>
  );
}