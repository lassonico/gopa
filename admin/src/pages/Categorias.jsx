import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

const GRUPOS = [
  { id: 'consumo', nombre: '🍔 Consumo' },
  { id: 'tiendas', nombre: '🛍️ Tiendas' },
  { id: 'otros', nombre: 'Otras' },
];

export default function Categorias() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '', icono: '', grupo: 'consumo' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState('');

  const load = () => {
    api.get('/categorias').then(({ data }) => setList(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/categorias/${editingId}`, form);
        setAviso('Categoría actualizada');
      } else {
        await api.post('/categorias', form);
        setAviso('Categoría creada');
      }
      setForm({ nombre: '', descripcion: '', icono: '', grupo: 'consumo' });
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar la categoría');
    }
  };

  const editar = (c) => {
    setForm({ nombre: c.nombre || '', descripcion: c.descripcion || '', icono: c.icono || '', grupo: c.grupo || 'otros' });
    setEditingId(c.id);
  };

  const cancelar = () => {
    setForm({ nombre: '', descripcion: '', icono: '', grupo: 'consumo' });
    setEditingId(null);
  };

  const eliminar = async (id) => {
    if (confirm('¿Eliminar?')) {
      try {
        await api.delete(`/categorias/${id}`);
        load();
      } catch (err) {
        alert(err.response?.data?.error || 'No se pudo eliminar la categoría');
      }
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Categorías</h1></div>

      {aviso && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input name="nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input name="descripcion" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Grupo *</label>
            <select name="grupo" value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })}>
              {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Icono (emoji)</label>
            <input name="icono" value={form.icono} onChange={e => setForm({ ...form, icono: e.target.value })} placeholder="🍔" />
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
        {GRUPOS.map(grupo => {
          const items = list.filter(c => (c.grupo || 'otros') === grupo.id);
          if (items.length === 0) return null;
          return (
            <div key={grupo.id} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, color: '#5E244E', margin: '0 0 8px' }}>{grupo.nombre} ({items.length})</h3>
              <table>
                <thead><tr><th>Nombre</th><th>Descripción</th><th>Icono</th><th>Acción</th></tr></thead>
                <tbody>
                  {items.map(c => (
                    <tr key={c.id}>
                      <td>{c.icono ? `${c.icono} ` : ''}{c.nombre}</td>
                      <td>{c.descripcion || '—'}</td>
                      <td>{c.icono || '—'}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => editar(c)}>✎ Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => eliminar(c.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
