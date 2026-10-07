import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

const ACCIONES_MODAL = {
  aprobar: { btn: 'btn btn-success', label: '✓ Aprobar' },
  rechazar: { btn: 'btn btn-danger', label: '✗ Rechazar' },
  reactivar: { btn: 'btn btn-success', label: '↻ Reactivar' },
  ocultar: { btn: 'btn btn-warning', label: '🙈 Ocultar' },
  eliminar: { btn: 'btn btn-danger', label: '🗑 Eliminar' },
  info: { btn: 'btn btn-primary', label: 'Cerrar' },
};

function Avatar({ s, size = 40 }) {
  const base = {
    width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0,
    background: '#E7D9E2', color: 'var(--primary)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: Math.round(size * 0.45), fontWeight: 700,
  };
  if (s?.logo) return <img src={s.logo} alt={s.nombre || 'logo'} style={base} />;
  return <div style={base}>{(s?.nombre || '?')[0].toUpperCase()}</div>;
}

function Modal({ modal, onCancel, loading }) {
  if (!modal) return null;
  const cfg = ACCIONES_MODAL[modal.tipo] || { btn: 'btn btn-primary', label: 'Confirmar' };
  const s = modal.servicio;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 18, padding: 28, maxWidth: 480, width: '100%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)', maxHeight: '90vh', overflow: 'auto',
      }}>
        {s?.imagen && (
          <img src={s.imagen} alt={s.nombre} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '0 0 16px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            {s && <Avatar s={s} size={52} />}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: 18 }}>{modal.title}</h3>
              {s && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.4 }}>
                  {s.servicio} · {s.tipoPersona === 'juridica' ? 'Empresa' : 'Persona natural'}
                  {s.telefono ? ` · ${s.telefono}` : ''}
                </p>
              )}
            </div>
          </div>
          <button aria-label="Cerrar" onClick={onCancel} disabled={loading}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
        {s?.descripcion && (
          <p style={{
            margin: '0 0 16px', fontSize: 13, color: 'var(--gray-800)', lineHeight: 1.55,
            background: 'var(--gray-100)', padding: '10px 12px', borderRadius: 8,
          }}>
            {s.descripcion}
          </p>
        )}
        <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14, lineHeight: 1.5 }}>{modal.message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className={cfg.btn} onClick={modal.onAction} disabled={loading}>
            {loading ? 'Procesando...' : cfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Servicios() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showModal, setShowModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ tipoPersona: 'natural', nombre: '', servicio: '', descripcion: '', telefono: '', logo: '', imagen: '' });
  const [editingId, setEditingId] = useState(null);
  const [verOcultos, setVerOcultos] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/servicios/todos');
      setList(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImage = async (campo, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({ ...form, [campo]: data.url });
    } catch (err) {
      alert('Error al subir imagen: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const quitarImagen = (campo) => setForm({ ...form, [campo]: '' });

  const crear = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      if (editingId) {
        await api.put(`/servicios/${editingId}`, form);
      } else {
        await api.post('/servicios', form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ tipoPersona: 'natural', nombre: '', servicio: '', descripcion: '', telefono: '', logo: '', imagen: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar el servicio');
    }
    setModalLoading(false);
  };

  const abrirEditar = (s) => {
    setForm({
      tipoPersona: s.tipoPersona || 'natural',
      nombre: s.nombre || '',
      servicio: s.servicio || '',
      descripcion: s.descripcion || '',
      telefono: s.telefono || s.whatsapp || '',
      logo: s.logo || '',
      imagen: s.imagen || ''
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const cancelarForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ tipoPersona: 'natural', nombre: '', servicio: '', descripcion: '', telefono: '', logo: '', imagen: '' });
  };

  const cambiarEstado = async (id, estado) => {
    setModalLoading(true);
    try {
      await api.put(`/servicios/${id}/${estado}`);
      setShowModal(null);
      load();
    } catch (e) { console.error(e); }
    setModalLoading(false);
  };

  const reactivar = async (id) => {
    setModalLoading(true);
    try {
      await api.put(`/servicios/${id}`, { activo: 'true' });
      setShowModal(null);
      load();
    } catch (e) { console.error(e); }
    setModalLoading(false);
  };

  const eliminar = async (id) => {
    setModalLoading(true);
    try {
      await api.delete(`/servicios/${id}`);
      setShowModal(null);
      load();
    } catch (e) { console.error(e); }
    setModalLoading(false);
  };

  if (loading) return <div className="loading"><Loader /></div>;

  const pendientes = list.filter(s => s.estado === 'pendiente' && s.activo !== 'false');
  const procesados = list.filter(s => s.estado !== 'pendiente' && s.activo !== 'false');
  const ocultos = list.filter(s => s.activo === 'false');

  const estadoBadge = (s) => (
    <span>
      <span className={`badge badge-${s.estado === 'aprobado' ? 'success' : s.estado === 'rechazado' ? 'danger' : 'warning'}`}>{s.estado}</span>{' '}
      <span className={`badge badge-${s.activo === 'false' ? 'danger' : 'success'}`}>
        {s.activo === 'false' ? 'Oculto' : 'Visible'}
      </span>
    </span>
  );

  const nombreCelda = (s) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Avatar s={s} />
      <strong>{s.nombre}</strong>
    </div>
  );

  return (
    <div>
      <Modal
        modal={showModal}
        onCancel={() => setShowModal(null)}
        loading={modalLoading}
      />

      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Servicios</h1>
        <button className="btn btn-primary" onClick={() => { if (editingId) cancelarForm(); setShowForm(!showForm); }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Servicio'}
        </button>
      </div>

      {showForm && (
        <form className="form-card" style={{ marginBottom: 24 }} onSubmit={crear}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Servicio' : 'Crear Servicio'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Tipo de persona *</label>
              <select name="tipoPersona" value={form.tipoPersona} onChange={handleChange} required>
                <option value="natural">Natural</option>
                <option value="juridica">Jurídica</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nombre (persona o negocio) *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Juan Pérez / Plomería XYZ" required />
            </div>
            <div className="form-group">
              <label>Servicio que presta *</label>
              <input name="servicio" value={form.servicio} onChange={handleChange} placeholder="Ej: plomería, cerrajería, trasteos" required />
            </div>
            <div className="form-group">
              <label>WhatsApp *</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+57 300 123 4567" required />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción del servicio</label>
              <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows={3} placeholder="Describe el servicio que ofrece" />
            </div>
            <div className="form-group">
              <label>Logo del negocio</label>
              {form.logo ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <img src={form.logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => quitarImagen('logo')} disabled={uploading}>Quitar</button>
                </div>
              ) : (
                <div>
                  <input type="file" accept="image/*" onChange={e => handleImage('logo', e)} disabled={uploading} />
                  {uploading && <p style={{ fontSize: 12, color: '#6b7280' }}>Subiendo imagen...</p>}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Imagen del negocio</label>
              {form.imagen ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <img src={form.imagen} alt="Negocio" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => quitarImagen('imagen')} disabled={uploading}>Quitar</button>
                </div>
              ) : (
                <div>
                  <input type="file" accept="image/*" onChange={e => handleImage('imagen', e)} disabled={uploading} />
                  {uploading && <p style={{ fontSize: 12, color: '#6b7280' }}>Subiendo imagen...</p>}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={modalLoading}>
              {editingId ? 'Actualizar Servicio' : 'Guardar Servicio'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={cancelarForm}>Cancelar</button>
            )}
          </div>
        </form>
      )}

      {pendientes.length > 0 && (
        <>
          <h2 style={{ color: '#e68457', marginBottom: 12 }}>Pendientes de aprobación ({pendientes.length})</h2>
          <div className="table-container" style={{ marginBottom: 32 }}>
            <table>
              <thead>
                <tr><th>Tipo</th><th>Proveedor</th><th>Servicio</th><th>Teléfono</th><th>Descripción</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {pendientes.map(s => (
                  <tr key={s.id}>
                    <td>{s.tipoPersona === 'juridica' ? 'Jurídica' : 'Natural'}</td>
                    <td>{nombreCelda(s)}</td>
                    <td>{s.servicio}</td>
                    <td>{s.telefono || s.whatsapp || '—'}</td>
                    <td style={{ maxWidth: 250 }}>{s.descripcion || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.fechaRegistro ? new Date(s.fechaRegistro).toLocaleDateString() : '—'}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline btn-sm" title="Vista previa"
                        onClick={() => setShowModal({ tipo: 'info', title: s.nombre, message: 'Revisa el logo, la imagen del negocio y los datos antes de decidir.', servicio: s, onAction: () => setShowModal(null) })}>
                        👁
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => abrirEditar(s)}>✎ Editar</button>
                      <button className="btn btn-success btn-sm"
                        onClick={() => setShowModal({ tipo: 'aprobar', title: 'Aprobar Servicio', message: 'Al aprobar, este proveedor quedará visible en los listados de la app con sus imágenes y datos.', servicio: s, onAction: () => cambiarEstado(s.id, 'aprobar') })}>
                        ✓ Aprobar
                      </button>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => setShowModal({ tipo: 'rechazar', title: 'Rechazar Servicio', message: 'No aparecerá en la app. Podrás editarlo y volver a aprobarlo más adelante.', servicio: s, onAction: () => cambiarEstado(s.id, 'rechazar') })}>
                        ✗ Rechazar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginBottom: 12 }}>Servicios ({procesados.length})</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Servicio</th><th>Descripción</th><th>WhatsApp</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {procesados.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-600)', padding: 24 }}>No hay servicios registrados aún</td></tr>
            ) : procesados.map(s => (
              <tr key={s.id}>
                <td>{nombreCelda(s)}</td>
                <td>{s.servicio || '—'}</td>
                <td style={{ maxWidth: 220 }}>{s.descripcion || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{s.telefono || s.whatsapp || '—'}</td>
                <td>{estadoBadge(s)}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" title="Vista previa"
                    onClick={() => setShowModal({ tipo: 'info', title: s.nombre, message: 'Así verán los clientes el perfil de este servicio en la app.', servicio: s, onAction: () => setShowModal(null) })}>
                    👁
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => abrirEditar(s)}>✎ Editar</button>
                  {s.activo === 'false' && (
                    <button className="btn btn-success btn-sm"
                      onClick={() => setShowModal({ tipo: 'reactivar', title: 'Reactivar Servicio', message: 'El servicio volverá a mostrarse en los listados de la app.', servicio: s, onAction: () => reactivar(s.id) })}>
                      ↻ Reactivar
                    </button>
                  )}
                  <button className={`btn btn-sm ${s.activo === 'false' ? 'btn-danger' : 'btn-warning'}`}
                    onClick={() => setShowModal(s.activo === 'false'
                      ? { tipo: 'eliminar', title: 'Eliminar definitivamente', message: 'Esta acción elimina el registro de forma permanente. Esta acción no se puede deshacer.', servicio: s, onAction: () => eliminar(s.id) }
                      : { tipo: 'ocultar', title: 'Ocultar Servicio', message: 'Se conservará en el sistema y podrás reactivarlo cuando quieras.', servicio: s, onAction: () => eliminar(s.id) })}>
                    {s.activo === 'false' ? '🗑 El.' : '🙈 Ocultar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ocultos.length > 0 && (
        <>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }}
            onClick={() => setVerOcultos(v => !v)}>
            {verOcultos ? '▾ Ocultar eliminados' : `▸ Ver eliminados (${ocultos.length})`}
          </button>
          {verOcultos && (
            <div className="table-container" style={{ marginTop: 12, opacity: 0.85 }}>
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Servicio</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {ocultos.map(s => (
                    <tr key={s.id}>
                      <td>{nombreCelda(s)}</td>
                      <td>{s.servicio || '—'}</td>
                      <td>{estadoBadge(s)}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm"
                          onClick={() => setShowModal({ tipo: 'reactivar', title: 'Reactivar Servicio', message: 'El servicio volverá a mostrarse en los listados de la app.', servicio: s, onAction: () => reactivar(s.id) })}>
                          ↻ Reactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}