import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

function Modal({ show, title, children, onClose }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#5E244E' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ show, title, message, onConfirm, onCancel, loading }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px' }}>
          <h3 style={{ margin: 0, color: '#5E244E' }}>{title}</h3>
          <button aria-label="Cerrar" onClick={onCancel} disabled={loading}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const LABELS_CAMPOS = {
  nombreNegocio: 'Nombre del negocio',
  nombrePropietario: 'Propietario',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  horarios: 'Horarios',
  categoria: 'Categoría',
  redesSociales: 'Redes sociales',
  descripcion: 'Descripción',
  cartaImagen: 'Carta / Menú adjunto',
  cobraEmpaque: '¿Cobra empaque?',
  tipoEmpaque: 'Tipo de empaque',
  valorEmpaque: 'Valor del empaque',
  ciudad: 'Ciudad',
  costoEnvio: 'Costo de domicilio',
  tiempoEstimado: 'Tiempo estimado (min)',
  tipoDocumento: 'Tipo de documento',
  numeroDocumento: 'Número de documento',
  tipoVehiculo: 'Tipo de vehículo',
};

function CartaViewer({ data }) {
  if (!data) {
    return <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>— Sin carta adjunta</p>;
  }
  const isImage = data.startsWith('data:image/');
  const isPdf = data.startsWith('data:application/pdf');
  return (
    <div>
      {isImage && (
        <img src={data} alt="Carta del comercio"
          style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 10, border: '1px solid #e5e7eb', display: 'block' }} />
      )}
      {isPdf && (
        <iframe src={data} title="Carta PDF"
          style={{ width: '100%', height: 420, border: '1px solid #e5e7eb', borderRadius: 10 }} />
      )}
      {!isImage && !isPdf && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Formato no visualizable.</p>
      )}
      <a href={data} target="_blank" rel="noreferrer"
        style={{ fontSize: 12, color: '#5E244E', display: 'inline-block', marginTop: 6 }}>
        Abrir en pestaña nueva ↗
      </a>
    </div>
  );
}

function ProductosDetalle({ productos }) {
  if (!Array.isArray(productos) || productos.length === 0) {
    return <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>— Sin productos registrados</p>;
  }
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            <th style={{ padding: '6px 10px', color: '#6b7280', fontWeight: 600 }}>Imagen</th>
            <th style={{ padding: '6px 10px', color: '#6b7280', fontWeight: 600 }}>Producto</th>
            <th style={{ padding: '6px 10px', color: '#6b7280', fontWeight: 600 }}>Precio</th>
            <th style={{ padding: '6px 10px', color: '#6b7280', fontWeight: 600 }}>Categoría</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 10px' }}>
                {p.imagen ? (
                  <img src={p.imagen} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                ) : (
                  <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
                )}
              </td>
              <td style={{ padding: '6px 10px', color: '#111827' }}>
                {p.nombre || '—'}
                {p.descripcion ? (
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.descripcion}</div>
                ) : null}
              </td>
              <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>
                ${Number(p.precio || 0).toLocaleString('es-CO')}
              </td>
              <td style={{ padding: '6px 10px', color: '#6b7280', textTransform: 'capitalize' }}>
                {p.categoria || 'otras'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Solicitudes() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [credDomi, setCredDomi] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  const load = async () => {
    setLoading(true);
    try {
      const params = filtro !== 'todos' ? `?tipo=${filtro}` : '';
      const { data } = await api.get(`/solicitudes${params}`);
      setList(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filtro]);

  const verDetalle = (s) => {
    const datos = (() => { try { return JSON.parse(s.datos); } catch { return {}; } })();
    setDetalle({ ...s, datos });
    setShowModal(s.id);
  };

  const aprobar = async (id, credenciales = null) => {
    setModalLoading(true);
    try {
      await api.put(`/solicitudes/${id}/aprobar`, credenciales || {});
      setConfirmModal(null);
      setShowModal(null);
      setDetalle(null);
      setCredDomi(null);
      load();
    } catch (e) {
      const msg = e.response?.data?.error || 'Error al aprobar la solicitud';
      setConfirmModal({ title: 'Error al aprobar', message: msg, onConfirm: () => setConfirmModal(null) });
      console.error(e);
    }
    setModalLoading(false);
  };

  const abrirAprobar = (s) => {
    if (s.tipo === 'registro_domiciliario') {
      setCredDomi({ id: s.id, nombre: (() => { try { return JSON.parse(s.datos).nombre; } catch { return s.usuarioNombre; } })(), usuario: '', password: '' });
    } else {
      setConfirmModal({ title: 'Aprobar solicitud', message: '¿Estás seguro de aprobar esta solicitud?', onAction: () => aprobar(s.id) });
    }
  };

  const rechazar = async (id) => {
    setModalLoading(true);
    try {
      await api.put(`/solicitudes/${id}/rechazar`);
      setConfirmModal(null);
      setShowModal(null);
      setDetalle(null);
      load();
    } catch (e) { console.error(e); }
    setModalLoading(false);
  };

  if (loading) return <div className="loading"><Loader /></div>;

  const pendientes = list.filter(s => s.estado === 'pendiente');

  return (
    <div>
      <Modal show={!!detalle} title={detalle?.tipo === 'registro_comercio' ? 'Solicitud de Comercio' : 'Solicitud de Domiciliario'} onClose={() => { setShowModal(null); setDetalle(null); }}>
        {detalle && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Solicitante</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>{detalle.usuarioNombre}</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Fecha</p>
              <p style={{ fontSize: 14, color: '#374151', margin: 0 }}>{new Date(detalle.fecha).toLocaleString()}</p>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
            <h4 style={{ color: '#5E244E', fontSize: 14, marginBottom: 12 }}>Datos de la solicitud</h4>
            {detalle.datos.cartaImagen !== undefined && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{LABELS_CAMPOS.cartaImagen}</p>
                <CartaViewer data={detalle.datos.cartaImagen} />
              </div>
            )}
            {detalle.datos.productos !== undefined && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                  {LABELS_CAMPOS.productos || 'Productos'} ({Array.isArray(detalle.datos.productos) ? detalle.datos.productos.length : 0})
                </p>
                <ProductosDetalle productos={detalle.datos.productos} />
              </div>
            )}
            {Object.entries(detalle.datos).map(([key, value]) => {
              if (key === 'cartaImagen' || key === 'productos') return null;
              const texto = typeof value === 'string' ? value : JSON.stringify(value);
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>
                    {LABELS_CAMPOS[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p style={{ fontSize: 14, color: '#374151', margin: 0, wordBreak: 'break-word' }} title={texto.length > 120 ? texto : undefined}>
                    {(texto || '').length > 120 ? `${texto.slice(0, 120)}…` : (texto || '—')}
                  </p>
                </div>
              );
            })}
            {detalle.estado === 'pendiente' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button className="btn btn-success" style={{ flex: 1 }}
                  onClick={() => abrirAprobar(detalle)}>
                  ✓ Aprobar
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }}
                  onClick={() => setConfirmModal({ title: 'Rechazar solicitud', message: '¿Estás seguro de rechazar esta solicitud?', onAction: () => rechazar(detalle.id) })}>
                  ✗ Rechazar
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal show={!!credDomi} title="Asignar credenciales al domiciliario" onClose={() => setCredDomi(null)}>
        {credDomi && (
          <div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0 }}>
              Apruebas la solicitud de <strong>{credDomi.nombre}</strong>. Asigna el usuario y contraseña con los que ingresará a su app.
            </p>
            <div className="form-group">
              <label>Usuario</label>
              <input value={credDomi.usuario}
                onChange={e => setCredDomi({ ...credDomi, usuario: e.target.value.toLowerCase() })}
                placeholder="ej: juan.perez" maxLength={30} />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input value={credDomi.password} onChange={e => setCredDomi({ ...credDomi, password: e.target.value })}
                placeholder="Mínimo 8 caracteres con letras y números" />
            </div>
            <button className="btn btn-outline btn-sm" type="button"
              onClick={() => {
                const base = (credDomi.nombre || 'rider').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 20) || 'rider';
                const pass = 'DP' + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 90);
                setCredDomi({ ...credDomi, usuario: base, password: pass });
              }}>
              ✨ Sugerir credenciales
            </button>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
              Comunícale estas credenciales al domiciliario. Podrá cambiar su contraseña desde "¿Olvidaste tu contraseña?" en el login de la app.
              Al aprobar se le enviará un correo de bienvenida a su email registrado.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setCredDomi(null)} disabled={modalLoading}>Cancelar</button>
              <button className="btn btn-success" disabled={modalLoading || !credDomi.usuario || !credDomi.password}
                onClick={() => aprobar(credDomi.id, { usuario: credDomi.usuario, password: credDomi.password })}>
                {modalLoading ? 'Aprobando…' : '✓ Aprobar y crear cuenta'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        show={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onAction}
        onCancel={() => setConfirmModal(null)}
        loading={modalLoading}
      />

      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Solicitudes</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['todos', 'registro_comercio', 'registro_domiciliario'].map(f => (
            <button key={f}
              className={`btn btn-sm ${filtro === f ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltro(f)}>
              {f === 'todos' ? 'Todas' : f === 'registro_comercio' ? 'Comercios' : 'Domiciliarios'}
            </button>
          ))}
        </div>
      </div>

      {pendientes.length > 0 && (
        <>
          <h2 style={{ color: '#e68457', marginBottom: 12 }}>Pendientes ({pendientes.length})</h2>
          <div className="table-container" style={{ marginBottom: 32 }}>
            <table>
              <thead>
                <tr><th>Tipo</th><th>Usuario</th><th>Detalle</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {pendientes.map(s => {
                  const datos = (() => { try { return JSON.parse(s.datos); } catch { return {}; } })();
                  return (
                    <tr key={s.id}>
                      <td><span className={`badge ${s.tipo === 'registro_comercio' ? 'badge-warning' : 'badge-info'}`}>{s.tipo === 'registro_comercio' ? 'Comercio' : 'Domiciliario'}</span></td>
                      <td>{s.usuarioNombre}</td>
                      <td style={{ maxWidth: 300, fontSize: 13 }}>
                        {s.tipo === 'registro_comercio' ? datos.nombreNegocio : datos.nombre}
                        <br /><small>{datos.telefono}</small>
                      </td>
                      <td>{new Date(s.fecha).toLocaleDateString()}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => verDetalle(s)}>👁 Ver</button>
                        <button className="btn btn-success btn-sm" onClick={() => abrirAprobar(s)}>✓ Aprobar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmModal({ title: 'Rechazar Solicitud', message: '¿Rechazar esta solicitud?', onAction: () => rechazar(s.id) })}>✗ Rechazar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginBottom: 12 }}>Historial ({list.filter(s => s.estado !== 'pendiente').length})</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Tipo</th><th>Usuario</th><th>Detalle</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {list.filter(s => s.estado !== 'pendiente').length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>No hay solicitudes procesadas</td></tr>
            ) : list.filter(s => s.estado !== 'pendiente').map(s => {
              const datos = (() => { try { return JSON.parse(s.datos); } catch { return {}; } })();
              return (
                <tr key={s.id}>
                  <td><span className={`badge ${s.tipo === 'registro_comercio' ? 'badge-warning' : 'badge-info'}`}>{s.tipo === 'registro_comercio' ? 'Comercio' : 'Domiciliario'}</span></td>
                  <td>{s.usuarioNombre}</td>
                  <td style={{ fontSize: 13 }}>{s.tipo === 'registro_comercio' ? datos.nombreNegocio : datos.nombre}</td>
                  <td><span className={`badge badge-${s.estado === 'aprobado' ? 'success' : 'danger'}`}>{s.estado}</span></td>
                  <td>{new Date(s.fecha).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => verDetalle(s)}>👁 Ver</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
