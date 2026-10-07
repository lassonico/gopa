import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Productos() {
  const [list, setList] = useState([]);
  const [comercios, setComercios] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ comercioId: '', nombre: '', descripcion: '', precio: '', categoria: '', subcategoriaId: '', imagen: '', tallas: '', colores: '' });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filtroComercio, setFiltroComercio] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/productos');
      setList(data || []);
    } catch {
      try {
        const { data: comData } = await api.get('/comercios');
        const results = await Promise.all(
          (comData || []).map(c =>
            api.get(`/productos/comercio/${c.id}`).then(r => r.data).catch(() => [])
          )
        );
        setList(results.flat());
      } catch {}
    }
    setLoading(false);
  };

  useEffect(() => {
    api.get('/comercios/todos').then(({ data }) => setComercios(data)).catch(() => {});
    api.get('/subcategorias/admin/todos').then(({ data }) => setSubcats(data || [])).catch(() => {});
    load();
  }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

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
    if (editing) {
      await api.put(`/productos/${editing}`, form);
    } else {
      await api.post('/productos', form);
    }
    setShowForm(false);
    setEditing(null);
    setForm({ comercioId: '', nombre: '', descripcion: '', precio: '', categoria: '', subcategoriaId: '', imagen: '', tallas: '', colores: '' });
    load();
  };

  const parseLista = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p.map(String); } catch {}
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  };

  const abrirEditar = (p) => {
    setEditing(p.id);
    setForm({
      comercioId: p.comercioId || '',
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      precio: p.precio || '',
      categoria: p.categoria || '',
      subcategoriaId: p.subcategoriaId || '',
      imagen: p.imagen || '',
      tallas: parseLista(p.tallas).join(', '),
      colores: parseLista(p.colores).join(', ')
    });
    setShowForm(true);
  };

  const abrirNuevo = () => {
    if (showForm) { setShowForm(false); setEditing(null); return; }
    setEditing(null);
    setForm({ comercioId: '', nombre: '', descripcion: '', precio: '', categoria: '', subcategoriaId: '', imagen: '', tallas: '', colores: '' });
    setShowForm(true);
  };

  const eliminar = async (id) => {
    if (confirm('¿Eliminar producto?')) {
      await api.delete(`/productos/${id}`);
      load();
    }
  };

  const nombreComercio = (id) => {
    const c = comercios.find(c => c.id === id);
    return c ? c.nombreNegocio : (id || '').slice(0, 8);
  };

  const visibles = list.filter(p => {
    if (filtroComercio && p.comercioId !== filtroComercio) return false;
    const q = busqueda.trim().toLowerCase();
    if (q && !`${p.nombre || ''} ${p.categoria || ''} ${p.subcategoriaNombre || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const comercioSel = comercios.find(c => c.id === form.comercioId);
  const subcatOpciones = subcats.filter(s =>
    !comercioSel?.categoria || s.categoriaNombre === comercioSel.categoria
  );

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Productos</h1>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          {showForm ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
            maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#5E244E' }}>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
              </div>
              <div className="form-group">
                <label>Comercio</label>
                <select name="comercioId" value={form.comercioId} onChange={handleChange} required>
                  <option value="">Seleccionar comercio...</option>
                  {comercios.filter(c => c.estado === 'aprobado').map(c => (
                    <option key={c.id} value={c.id}>{c.nombreNegocio} ({c.id.slice(0, 8)}…)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea name="descripcion" value={form.descripcion} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Precio</label>
                <input name="precio" type="number" value={form.precio} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <input name="categoria" value={form.categoria} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Subcategoría</label>
                <select name="subcategoriaId" value={form.subcategoriaId} onChange={handleChange}>
                  <option value="">— Sin subcategoría —</option>
                  {subcatOpciones.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.categoriaNombre ? `${s.categoriaNombre} → ` : ''}{s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tallas disponibles (ropa/calzado, separadas por coma)</label>
                <input name="tallas" value={form.tallas} onChange={handleChange} placeholder="S, M, L, XL" />
              </div>
              <div className="form-group">
                <label>Colores disponibles (separados por coma)</label>
                <input name="colores" value={form.colores} onChange={handleChange} placeholder="Rojo, Azul, Negro" />
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
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>{editing ? 'Actualizar Producto' : 'Crear Producto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="filter-bar" style={{
        background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap'
      }}>
        <div className="form-group" style={{ margin: 0, minWidth: 220, flex: 1 }}>
          <label>Buscar</label>
          <input
            placeholder="Nombre o categoría del producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
          <label>Comercio</label>
          <select value={filtroComercio} onChange={e => setFiltroComercio(e.target.value)}>
            <option value="">Todos los comercios</option>
            {comercios.map(c => <option key={c.id} value={c.id}>{c.nombreNegocio}</option>)}
          </select>
        </div>
        {(filtroComercio || busqueda) && (
          <button className="btn btn-outline" onClick={() => { setFiltroComercio(''); setBusqueda(''); }}>✕ Limpiar</button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Imagen</th><th>Nombre</th><th>Comercio</th><th>Precio</th><th>Categoría</th><th>Tallas/Colores</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>No hay productos que coincidan</td></tr>
            ) : visibles.map(p => (
              <tr key={p.id}>
                <td>
                  {p.imagen
                    ? <img src={p.imagen} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    : <div style={{ width: 40, height: 40, background: '#f3f4f6', borderRadius: 6 }} />}
                </td>
                <td>{p.nombre}{p.derechos === 'true' || p.derechos === true ? ' ©' : ''}</td>
                <td>{p.nombreNegocio || nombreComercio(p.comercioId)}</td>
                <td>${parseFloat(p.precio || 0).toLocaleString('es-CO')}</td>
                <td>{p.subcategoriaNombre || p.categoria || '—'}</td>
                <td style={{ fontSize: 12, color: '#6b7280' }}>
                  {[parseLista(p.tallas).length > 0 ? `T: ${parseLista(p.tallas).join(', ')}` : '',
                    parseLista(p.colores).length > 0 ? `C: ${parseLista(p.colores).join(', ')}` : '']
                    .filter(Boolean).join(' · ') || '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminar(p.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}