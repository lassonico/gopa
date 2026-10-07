import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Promociones() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: '', valor: '', imagen: '', fechaVencimiento: '', activo: 'true' });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    api.get('/promociones/todos').then(({ data }) => setList(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({ ...form, imagen: data.url });
    } catch (err) {
      alert('Error al subir imagen: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/promociones/${editingId}`, form);
      } else {
        await api.post('/promociones', form);
      }
      setForm({ titulo: '', descripcion: '', tipo: '', valor: '', imagen: '', fechaVencimiento: '', activo: 'true' });
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar la promoción');
    }
  };

  const editar = (p) => {
    setForm({
      titulo: p.titulo || '',
      descripcion: p.descripcion || '',
      tipo: p.tipo || '',
      valor: p.valor || '',
      imagen: p.imagen || '',
      fechaVencimiento: p.fechaVencimiento ? String(p.fechaVencimiento).slice(0, 10) : '',
      activo: p.activo || 'true'
    });
    setEditingId(p.id);
  };

  const cancelar = () => {
    setForm({ titulo: '', descripcion: '', tipo: '', valor: '', imagen: '', fechaVencimiento: '', activo: 'true' });
    setEditingId(null);
  };

  const eliminar = async (id) => {
    if (confirm('¿Eliminar promoción?')) {
      try {
        await api.delete(`/promociones/${id}`);
        load();
      } catch (err) {
        alert(err.response?.data?.error || 'No se pudo eliminar la promoción');
      }
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Promociones</h1></div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: 12 }}>{editingId ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
          <div className="form-group">
            <label>Título</label>
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <input value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} placeholder="oferta / evento / banner" />
          </div>
          <div className="form-group">
            <label>Valor</label>
            <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Imagen</label>
            <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
            {uploading && <p style={{ fontSize: 12, color: '#6b7280' }}>Subiendo imagen...</p>}
            {form.imagen && (
              <div style={{ marginTop: 8 }}>
                <img src={form.imagen} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Vencimiento</label>
            <input type="date" value={form.fechaVencimiento} onChange={e => setForm({ ...form, fechaVencimiento: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={uploading}>{editingId ? 'Actualizar' : 'Crear'}</button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={cancelar}>Cancelar</button>
            )}
          </div>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Imagen</th><th>Título</th><th>Tipo</th><th>Vence</th><th>Acción</th></tr></thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id}>
                <td>
                  {p.imagen
                    ? <img src={p.imagen} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    : <div style={{ width: 40, height: 40, background: '#f3f4f6', borderRadius: 6 }} />}
                </td>
                <td><strong>{p.titulo}</strong></td>
                <td>{p.tipo}</td>
                <td style={{ fontSize: 13 }}>{p.fechaVencimiento ? new Date(p.fechaVencimiento).toLocaleDateString() : '-'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => editar(p)}>✎ Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(p.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}