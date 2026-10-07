import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

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

export default function Domiciliarios() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showModal, setShowModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', telefono: '', direccion: '' });
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/domiciliarios');
      setList(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const crear = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const body = { ...form };
      if (editingId) {
        if (!body.password) delete body.password;
        await api.put(`/domiciliarios/${editingId}`, body);
        setAviso('Domiciliario actualizado');
      } else {
        await api.post('/domiciliarios', body);
        setAviso('Domiciliario creado');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ nombre: '', email: '', password: '', telefono: '', direccion: '' });
      load();
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo guardar el domiciliario';
      setAviso('');
      setShowModal({ title: 'Error', message: msg, onAction: () => setShowModal(null) });
    }
    setModalLoading(false);
  };

  const abrirEditar = (d) => {
    setForm({
      nombre: d.nombre || '',
      email: d.email || '',
      password: '',
      telefono: d.telefono || '',
      direccion: d.direccion || ''
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const cancelarForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ nombre: '', email: '', password: '', telefono: '', direccion: '' });
  };

  const toggleDisponible = async (id) => {
    setModalLoading(true);
    try {
      await api.put(`/domiciliarios/${id}/toggle-disponible`);
      setShowModal(null);
      load();
    } catch (e) {
      setShowModal({ title: 'Error', message: e.response?.data?.error || 'No se pudo cambiar disponibilidad', onAction: () => setShowModal(null) });
    }
    setModalLoading(false);
  };

  const eliminar = async (id) => {
    setModalLoading(true);
    try {
      await api.delete(`/domiciliarios/${id}`);
      setShowModal(null);
      load();
    } catch (e) {
      setShowModal({ title: 'Error', message: e.response?.data?.error || 'No se pudo eliminar', onAction: () => setShowModal(null) });
    }
    setModalLoading(false);
  };

  const resetPassword = async (d) => {
    setModalLoading(true);
    try {
      const { data } = await api.post(`/domiciliarios/${d.id}/reset-password`);
      setAviso(`🔑 ${data.message}`);
      setShowModal(null);
    } catch (e) {
      setShowModal({ title: 'Error', message: e.response?.data?.error || 'No se pudo enviar el correo.', onAction: () => setShowModal(null) });
    }
    setModalLoading(false);
  };

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

      {aviso && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Domiciliarios</h1>
        <button className="btn btn-primary" onClick={() => { if (editingId) cancelarForm(); setShowForm(!showForm); }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo Domiciliario'}
        </button>
      </div>

      {showForm && (
        <form className="form-card" style={{ marginBottom: 24 }} onSubmit={crear}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Domiciliario' : 'Crear Domiciliario'}</h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            {editingId
              ? 'Actualiza los datos del domiciliario. Deja la contraseña vacía para no cambiarla.'
              : 'Se crearán las credenciales de acceso para el dashboard de domiciliario.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Nombre Completo *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Contraseña{editingId ? '' : ' *'}</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} required={!editingId} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Dirección</label>
              <input name="direccion" value={form.direccion} onChange={handleChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={modalLoading}>
              {editingId ? 'Actualizar Domiciliario' : 'Guardar Domiciliario'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={cancelarForm}>Cancelar</button>
            )}
          </div>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Disponible</th><th>Calificación</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>No hay domiciliarios registrados</td></tr>
            ) : list.map(d => (
              <tr key={d.id}>
                <td><strong>{d.nombre}</strong></td>
                <td>{d.email}</td>
                <td>{d.telefono}</td>
                <td><span className={`badge badge-${d.disponible !== 'false' ? 'success' : 'danger'}`}>{d.disponible !== 'false' ? 'Disponible' : 'No disponible'}</span></td>
                <td>{d.calificacionPromedio ? `★ ${d.calificacionPromedio} (${d.totalCalificaciones || 0})` : 'Sin calificar'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => abrirEditar(d)}>✎ Editar</button>
                  <button className="btn btn-outline btn-sm" title={`Enviar correo de restablecimiento a ${d.email}`}
                    onClick={() => setShowModal({ title: 'Restablecer Contraseña', message: `¿Enviar correo para restablecer la contraseña de ${d.nombre} a ${d.email}?`, onAction: () => resetPassword(d) })}>
                    🔑
                  </button>
                  <button className={`btn btn-sm ${d.disponible !== 'false' ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => setShowModal({ title: `${d.disponible !== 'false' ? 'Marcar no disponible' : 'Marcar disponible'}`, message: `¿${d.disponible !== 'false' ? 'Marcar como no disponible' : 'Marcar como disponible'} a ${d.nombre}? (solo disponibilidad, la cuenta sigue activa)`, onAction: () => toggleDisponible(d.id) })}>
                    {d.disponible !== 'false' ? '⏸ Pausar' : '▶ Reanudar'}
                  </button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => setShowModal({ title: 'Eliminar Domiciliario', message: `¿Eliminar a ${d.nombre} del listado?`, onAction: () => eliminar(d.id) })}>
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
