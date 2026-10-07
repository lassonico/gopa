import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Subcategorias() {
  const [list, setList] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState({ nombre: '', categoriaId: '', descripcion: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState('');

  const load = () => {
    Promise.all([
      api.get('/subcategorias/admin/todos'),
      api.get('/categorias')
    ]).then(([r1, r2]) => {
      setList(r1.data);
      setCategorias(r2.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categoriaId) {
      alert('Selecciona la categoría padre');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/subcategorias/${editingId}`, form);
        setAviso('Subcategoría actualizada');
      } else {
        await api.post('/subcategorias', form);
        setAviso('Subcategoría creada');
      }
      setForm({ nombre: '', categoriaId: '', descripcion: '' });
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar la subcategoría');
    }
  };

  const editar = (s) => {
    setForm({ nombre: s.nombre || '', categoriaId: s.categoriaId || '', descripcion: s.descripcion || '' });
    setEditingId(s.id);
  };

  const cancelar = () => {
    setForm({ nombre: '', categoriaId: '', descripcion: '' });
    setEditingId(null);
  };

  const eliminar = async (id) => {
    if (confirm('¿Eliminar?')) {
      try {
        await api.delete(`/subcategorias/${id}`);
        load();
      } catch (err) {
        alert(err.response?.data?.error || 'No se pudo eliminar la subcategoría');
      }
    }
  };

  const catNombre = (id) => categorias.find(c => c.id === id)?.nombre || '—';

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Subcategorías</h1></div>

      {aviso && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Categoría padre *</label>
            <select value={form.categoriaId} onChange={e => setForm({ ...form, categoriaId: e.target.value })} required>
              <option value="">— Seleccionar —</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Nombre</label>
            <input name="nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input name="descripcion" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary">{editingId ? 'Actualizar' : 'Agregar'}</button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={cancelar}>Cancelar</button>
            )}
          </div>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Categoría</th><th>Nombre</th><th>Descripción</th><th>Acción</th></tr></thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id}>
                <td>{catNombre(s.categoriaId)}</td>
                <td>{s.nombre}</td>
                <td>{s.descripcion || '—'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => editar(s)}>✎ Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(s.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}