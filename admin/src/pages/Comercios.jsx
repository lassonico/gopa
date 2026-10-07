import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';
import HorariosSelector, { serializarPlan, planPorDefecto } from '../components/HorariosSelector';

function Modal({ show, title, message, onConfirm, onCancel, loading }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
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

export default function Comercios() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showModal, setShowModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState({
    nombreNegocio: '', nombrePropietario: '', telefono: '', direccion: '',
    horarios: serializarPlan(planPorDefecto()), categoria: '', redesSociales: '', descripcion: '',
    email: '', password: '', comision: '', ciudad: 'palermo'
  });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [aviso, setAviso] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/comercios/todos');
      setList(data);
      const { data: cats } = await api.get('/categorias');
      setCategorias(cats);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleEditChange = e => setEditForm({ ...editForm, [e.target.name]: e.target.value });

  const crearComercio = async () => {
    setModalLoading(true);
    try {
      const body = { ...form };
      if (body.comision != null && body.comision !== '') body.comision = Number(String(body.comision).replace(',', '.'));
      await api.post('/comercios/admin', body);
      setShowForm(false);
      setForm({ nombreNegocio: '', nombrePropietario: '', telefono: '', direccion: '', horarios: serializarPlan(planPorDefecto()), categoria: '', redesSociales: '', descripcion: '', email: '', password: '', ciudad: 'palermo' });
      setAviso('Comercio creado');
      load();
    } catch (e) {
      setShowModal({ title: 'Error', message: e.response?.data?.error || e.response?.data?.details || 'No se pudo crear el comercio', onAction: () => setShowModal(null) });
    }
    setModalLoading(false);
  };

  const abrirEditar = (c) => {
    setEditId(c.id);
    setEditForm({
      nombreNegocio: c.nombreNegocio || '',
      nombrePropietario: c.nombrePropietario || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      horarios: c.horarios || '',
      categoria: c.categoria || '',
      redesSociales: c.redesSociales || '',
      descripcion: c.descripcion || '',
      ciudad: c.ciudad || 'palermo',
      dominical: c.dominical === 'true' ? 'true' : 'false',
      costoEnvio: c.costoEnvio || '',
      tiempoEstimado: c.tiempoEstimado || '',
      rangoPrecio: c.rangoPrecio || '',
      comision: c.comision ?? '',
      email: c.email || '',
      password: ''
    });
  };

  const guardarEditar = async () => {
    setModalLoading(true);
    try {
      const body = { ...editForm };
      if (!body.password) delete body.password;
      for (const numKey of ['comision', 'costoEnvio']) {
        const v = body[numKey];
        if (v === '' || v == null) delete body[numKey];
        else body[numKey] = Number(String(v).replace(',', '.'));
      }
      await api.put(`/comercios/${editId}`, body);
      setEditId(null);
      setEditForm(null);
      setAviso('Comercio actualizado');
      load();
    } catch (e) {
      setShowModal({ title: 'Error', message: e.response?.data?.error || e.response?.data?.details || 'No se pudo guardar el comercio', onAction: () => setShowModal(null) });
    }
    setModalLoading(false);
  };

  const aprobar = async (id) => {
    setModalLoading(true);
    await api.put(`/comercios/${id}/aprobar`);
    setShowModal(null);
    load();
    setModalLoading(false);
  };

  const rechazar = async (id) => {
    setModalLoading(true);
    await api.put(`/comercios/${id}/rechazar`);
    setShowModal(null);
    load();
    setModalLoading(false);
  };

  const toggleActivo = async (id) => {
    setModalLoading(true);
    await api.put(`/comercios/${id}/toggle-activo`);
    setShowModal(null);
    load();
    setModalLoading(false);
  };

  const eliminar = async (id) => {
    setModalLoading(true);
    await api.delete(`/comercios/${id}`);
    setShowModal(null);
    load();
    setModalLoading(false);
  };

  const resetPassword = async (c) => {
    setModalLoading(true);
    try {
      const { data } = await api.post(`/comercios/${c.id}/reset-password`);
      setAviso(`🔑 ${data.message}`);
    } catch (e) {
      setAviso('');
      setShowModal({ title: 'Error', message: e.response?.data?.error || 'No se pudo enviar el correo.', onAction: () => setShowModal(null) });
      setModalLoading(false);
      return;
    }
    setShowModal(null);
    setModalLoading(false);
  };

  const coincide = (c) => {
    const q = busqueda.trim().toLowerCase();
    if (q && ![c.nombreNegocio, c.nombrePropietario, c.email, c.telefono].some(v => (v || '').toLowerCase().includes(q))) return false;
    if (filtroCategoria && c.categoria !== filtroCategoria) return false;
    return true;
  };

  const pendientes = list.filter(c => c.estado === 'pendiente').filter(coincide);
  const activos = list.filter(c => c.estado === 'aprobado').filter(coincide);

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <Modal
        show={showModal}
        title={showModal?.title}
        message={showModal?.message}
        onConfirm={showModal?.onAction}
        onCancel={() => setShowModal(null)}
        loading={modalLoading}
      />

      {editForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 520, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#5E244E' }}>Editar Comercio</h3>
              <button aria-label="Cerrar" type="button" onClick={() => setEditForm(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Nombre del Negocio</label>
                <input name="nombreNegocio" value={editForm.nombreNegocio} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Nombre del Propietario</label>
                <input name="nombrePropietario" value={editForm.nombrePropietario} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input name="telefono" value={editForm.telefono} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input name="direccion" value={editForm.direccion} onChange={handleEditChange} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Horarios</label>
                <HorariosSelector value={editForm.horarios} onChange={horarios => setEditForm({ ...editForm, horarios })} />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select name="categoria" value={editForm.categoria} onChange={handleEditChange}>
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ciudad</label>
                <select name="ciudad" value={editForm.ciudad || 'palermo'} onChange={handleEditChange}>
                  <option value="palermo">Palermo</option>
                  <option value="neiva">Neiva</option>
                </select>
              </div>
              <div className="form-group">
                <label>Especial dominical 🍽️</label>
                <select name="dominical" value={editForm.dominical || 'false'} onChange={handleEditChange}>
                  <option value="false">No</option>
                  <option value="true">Sí (aparece en Dominicales)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Redes Sociales</label>
                <input name="redesSociales" value={editForm.redesSociales} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input name="descripcion" value={editForm.descripcion} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Costo Envío</label>
                <input name="costoEnvio" value={editForm.costoEnvio} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Comisión (%)</label>
                <input name="comision" type="number" min="0" max="100" step="0.1" value={editForm.comision} onChange={handleEditChange} placeholder="10" />
              </div>
              <div className="form-group">
                <label>Tiempo Estimado</label>
                <input name="tiempoEstimado" value={editForm.tiempoEstimado} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Rango Precio</label>
                <input name="rangoPrecio" value={editForm.rangoPrecio} onChange={handleEditChange} placeholder="$25.000 - $60.000" />
              </div>
              <div className="form-group">
                <label>Email (credenciales)</label>
                <input name="email" type="email" value={editForm.email} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Nueva Contraseña (dejar vacío para no cambiar)</label>
                <input name="password" type="password" value={editForm.password} onChange={handleEditChange} placeholder="••••••" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => { setEditId(null); setEditForm(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEditar} disabled={modalLoading}>
                {modalLoading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Comercios</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Comercio'}
        </button>
      </div>

      {aviso && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {showForm && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Crear Comercio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Nombre del Negocio *</label>
              <input name="nombreNegocio" value={form.nombreNegocio} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Nombre del Propietario *</label>
              <input name="nombrePropietario" value={form.nombrePropietario} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Teléfono *</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input name="direccion" value={form.direccion} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Horarios</label>
              <HorariosSelector value={form.horarios} onChange={horarios => setForm({ ...form, horarios })} />
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select name="categoria" value={form.categoria} onChange={handleChange}>
                <option value="">Seleccionar...</option>
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Ciudad</label>
              <select name="ciudad" value={form.ciudad} onChange={handleChange}>
                <option value="palermo">Palermo</option>
                <option value="neiva">Neiva</option>
              </select>
            </div>
            <div className="form-group">
              <label>Redes Sociales</label>
              <input name="redesSociales" value={form.redesSociales} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input name="descripcion" value={form.descripcion} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Email (credenciales acceso)</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="comercio@email.com" />
            </div>
            <div className="form-group">
              <label>Contraseña (credenciales acceso)</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={crearComercio}>
            Guardar Comercio
          </button>
        </div>
      )}

      <div className="filter-bar" style={{
        background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap'
      }}>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <label>Buscar</label>
          <input
            placeholder="Negocio, propietario, email o teléfono..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 170 }}>
          <label>Categoría</label>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        {(busqueda || filtroCategoria) && (
          <button className="btn btn-outline" onClick={() => { setBusqueda(''); setFiltroCategoria(''); }}>✕ Limpiar</button>
        )}
      </div>

      {pendientes.length > 0 && (
        <>
          <h2 style={{ color: '#e68457', marginBottom: 12 }}>Pendientes de Aprobación ({pendientes.length})</h2>
          <div className="table-container" style={{ marginBottom: 32 }}>
            <table>
              <thead>
                <tr><th>ID</th><th>Negocio</th><th>Propietario</th><th>Teléfono</th><th>Categoría</th><th>Email</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {pendientes.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{c.id.slice(0, 8)}…</td>
                <td><strong>{c.nombreNegocio}</strong>{c.dominical === 'true' ? ' 🍽️' : ''}</td>
                    <td>{c.nombrePropietario}</td>
                    <td>{c.telefono}</td>
                    <td>{c.categoria}</td>
                    <td>{c.email || '—'}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-success btn-sm" onClick={() => setShowModal({ title: 'Aprobar Comercio', message: `¿Aprobar ${c.nombreNegocio}?`, onAction: () => aprobar(c.id) })}>✓ Aprobar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setShowModal({ title: 'Rechazar Comercio', message: `¿Rechazar ${c.nombreNegocio}?`, onAction: () => rechazar(c.id) })}>✗ Rechazar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginBottom: 12 }}>Comercios Registrados ({activos.length})</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>ID</th><th>Negocio</th><th>Propietario</th><th>Teléfono</th><th>Categoría</th><th>Comisión</th><th>Email</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {activos.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>No hay comercios registrados</td></tr>
            ) : activos.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{c.id.slice(0, 8)}…</td>
                <td><strong>{c.nombreNegocio}</strong></td>
                <td>{c.nombrePropietario}</td>
                <td>{c.telefono}</td>
                <td>{c.categoria}</td>
                <td>
                  {c.comision != null && c.comision !== '' ? (
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#FDF6E3', color: '#92400E', border: '1px solid #FDE68A' }}>{c.comision}%</span>
                  ) : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td>{c.email || '—'}</td>
                <td><span className={`badge badge-${c.activo === 'true' ? 'success' : 'danger'}`}>{c.activo === 'true' ? 'Activo' : 'Inactivo'}</span></td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => abrirEditar(c)}>✎ Editar</button>
                  <button className="btn btn-outline btn-sm" title={c.email ? `Enviar correo de restablecimiento a ${c.email}` : 'Sin cuenta vinculada'}
                    onClick={() => c.email
                      ? setShowModal({ title: 'Restablecer Contraseña', message: `¿Enviar correo para restablecer la contraseña de ${c.nombreNegocio} a ${c.email}?`, onAction: () => resetPassword(c) })
                      : setShowModal({ title: 'Sin cuenta vinculada', message: 'Este comercio no tiene una cuenta con email. Edítalo o crea la cuenta primero.', onAction: () => setShowModal(null) })}>
                    🔑
                  </button>
                  <button className={`btn btn-sm ${c.activo === 'true' ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => setShowModal({ title: `${c.activo === 'true' ? 'Desactivar' : 'Activar'} Comercio`, message: `¿${c.activo === 'true' ? 'Desactivar' : 'Activar'} ${c.nombreNegocio}?`, onAction: () => toggleActivo(c.id) })}>
                    {c.activo === 'true' ? '⏸ Desactivar' : '▶ Activar'}
                  </button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => setShowModal({ title: 'Eliminar Comercio', message: `¿Eliminar permanentemente ${c.nombreNegocio}?`, onAction: () => eliminar(c.id) })}>
                    🗑 Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
