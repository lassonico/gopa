import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Anuncios() {
  const [list, setList] = useState([]);
  const [comercios, setComercios] = useState([]);
  const [form, setForm] = useState({ titulo: '', descripcion: '', imagen: '', comercioId: '', activo: 'true' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    api.get('/promociones/todos').then(({ data }) => setList(data)).finally(() => setLoading(false));
  };

  const loadComercios = () => {
    api.get('/comercios/todos').then(({ data }) => setComercios(data)).catch(() => {});
  };

  useEffect(() => {
    load();
    loadComercios();
  }, []);

  const nombreComercio = (id) => {
    if (!id) return 'Anuncio (sin comercio)';
    const c = comercios.find(c => c.id === id);
    return c ? c.nombreNegocio : id.slice(0, 8);
  };

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
        await api.put(`/promociones/${editingId}`, { ...form, tipo: 'banner' });
      } else {
        await api.post('/promociones', { ...form, tipo: 'banner' });
      }
      setForm({ titulo: '', descripcion: '', imagen: '', comercioId: '', activo: 'true' });
      setEditingId(null);
      load();
    } catch (err) {
      alert('Error al guardar banner: ' + (err.response?.data?.error || err.message));
    }
  };

  const editar = (banner) => {
    setForm({
      titulo: banner.titulo,
      descripcion: banner.descripcion || '',
      imagen: banner.imagen || '',
      comercioId: banner.comercioId || '',
      activo: banner.activo
    });
    setEditingId(banner.id);
  };

  const cancelarEdicion = () => {
    setForm({ titulo: '', descripcion: '', imagen: '', comercioId: '', activo: 'true' });
    setEditingId(null);
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Anuncios</h1></div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Título</label>
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows="2" />
          </div>
          <div className="form-group">
            <label>Imagen</label>
            <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
            {uploading && <p style={{ fontSize: 12, color: '#6b7280' }}>Subiendo imagen...</p>}
            {form.imagen && (
              <div style={{ marginTop: 8 }}>
                <img src={form.imagen} alt="Preview" style={{ width: 120, height: 60, objectFit: 'cover', borderRadius: 8 }} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Comercio (opcional: anuncio publicitario)</label>
            <select value={form.comercioId} onChange={e => setForm({ ...form, comercioId: e.target.value })}>
              <option value="">Anuncio (sin comercio)</option>
              {comercios.filter(c => c.estado === 'aprobado').map(c => (
                <option key={c.id} value={c.id}>{c.nombreNegocio}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {editingId ? 'Actualizar Anuncio' : 'Agregar Anuncio'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={cancelarEdicion}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Imagen</th><th>Título</th><th>Comercio / Anuncio</th><th>Activo</th><th>Acción</th></tr></thead>
          <tbody>
            {list.filter(p => p.tipo === 'banner').map(b => (
              <tr key={b.id}>
                <td>
                  {b.imagen
                    ? <img src={b.imagen} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    : <div style={{ width: 60, height: 40, background: '#f3f4f6', borderRadius: 6 }} />}
                </td>
                <td><strong>{b.titulo}</strong></td>
                <td style={{ fontSize: 12 }}>{nombreComercio(b.comercioId)}</td>
                <td>{b.activo === 'true' ? '✓' : '✗'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => editar(b)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('¿Eliminar?')) api.delete(`/promociones/${b.id}`).then(load); }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}