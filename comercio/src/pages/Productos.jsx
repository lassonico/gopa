import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../App';
import Loader from '../components/Loader';

const EMPTY = { nombre: '', descripcion: '', precio: '', categoria: '', subcategoriaId: '', imagen: '', emoji: '🍴', tallas: '', colores: '', derechos: false };

function parseLista(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  try { const p = JSON.parse(v); if (Array.isArray(p)) return p.map(String); } catch {}
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

const CATS_TIENDA = ['tienda', 'tiendas', 'ropa', 'calzado', 'accesorios', 'perfumes', 'otros'];
function esTienda(categoria) {
  const n = String(categoria || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return n.includes('tiend') || CATS_TIENDA.includes(n);
}

export default function Productos() {
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [miCategoria, setMiCategoria] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    try {
      const [ { data }, { data: com } ] = await Promise.all([
        api.get(`/productos/comercio/${user.comercioId}`),
        api.get(`/comercios/${user.comercioId}`).catch(() => ({ data: {} }))
      ]);
      setProductos(data);
      setMiCategoria(com.categoria || '');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get('/subcategorias').then(({ data }) => setSubcats(data || [])).catch(() => {});
  }, []);

  const handleChange = e => setForm({
    ...form,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  });

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

  const abrirNuevo = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(!showForm);
  };

  const abrirEditar = (p) => {
    setEditing(p.id);
    setForm({
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      precio: p.precio || '',
      categoria: p.categoria || '',
      subcategoriaId: p.subcategoriaId || '',
      imagen: p.imagen || '',
      emoji: p.emoji || '🍴',
      tallas: parseLista(p.tallas).join(', '),
      colores: parseLista(p.colores).join(', '),
      derechos: p.derechos === 'true' || p.derechos === true
    });
    setShowForm(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio) {
      alert('Nombre y precio son requeridos');
      return;
    }
    if (form.imagen && !form.derechos) {
      alert('Debes declarar que tienes derechos sobre la imagen');
      return;
    }
    try {
      const payload = {
        ...form,
        nombre: form.nombre.trim(),
        emoji: form.emoji || '🍴'
      };
      if (editing) {
        await api.put(`/productos/${editing}`, payload);
      } else {
        await api.post('/productos', { ...payload, comercioId: user.comercioId });
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (e) { console.error(e); }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar producto?')) return;
    try {
      await api.delete(`/productos/${id}`);
      load();
    } catch (e) { console.error(e); }
  };

  const esMenuHoy = (p) => {
    const hoy = new Date().toISOString().slice(0, 10);
    return (p.menuDia === 'true' || p.menuDia === true) && String(p.menuFecha || '').slice(0, 10) === hoy;
  };

  const toggleMenuHoy = async (p) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const activar = !esMenuHoy(p);
    try {
      await api.put(`/productos/${p.id}`, activar
        ? { menuDia: 'true', menuFecha: hoy }
        : { menuDia: 'false', menuFecha: '' });
      load();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#5E244E' }}>Mis Productos</h3>
        <button onClick={abrirNuevo} style={{ background: '#aa1c41', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? '✕' : '+ Nuevo'}
        </button>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
            maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0, color: '#5E244E' }}>
                {editing ? 'Editar Producto' : 'Nuevo Producto'}
              </h4>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre del producto" style={inputS} />
              <input name="precio" type="number" value={form.precio} onChange={handleChange} placeholder="Precio (COP)" style={inputS} />
              <input name="descripcion" value={form.descripcion} onChange={handleChange} placeholder="Descripción" style={inputS} />
              <input name="categoria" value={form.categoria} onChange={handleChange} placeholder="Categoría (p. ej. hamburguesas, pizzas)" style={inputS} />
              {esTienda(miCategoria || form.categoria) && (
                <>
                  <input name="tallas" value={form.tallas} onChange={handleChange} placeholder="Tallas disponibles (ej: S, M, L, 38, 40)" style={inputS} />
                  <input name="colores" value={form.colores} onChange={handleChange} placeholder="Colores disponibles (ej: Rojo, Azul, Negro)" style={inputS} />
                </>
              )}
              {subcats.filter(s => s.categoriaNombre === miCategoria).length > 0 && (
                <select name="subcategoriaId" value={form.subcategoriaId || ''} onChange={handleChange} style={inputS}>
                  <option value="">Sin subcategoría</option>
                  {subcats.filter(s => s.categoriaNombre === miCategoria).map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input name="emoji" value={form.emoji} onChange={handleChange} placeholder="🍴" maxLength={4} title="Emoji (si no hay imagen)"
                  style={{ ...inputS, width: 72, flexShrink: 0, textAlign: 'center', fontSize: 18 }} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, fontSize: 13, fontWeight: 600, color: '#5E244E', background: '#f9fafb', border: '1px dashed #5E244E', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}>
                  {uploading ? '⏳ Subiendo...' : form.imagen ? '🖼️ Cambiar imagen' : '📷 Subir imagen'}
                  <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} style={{ display: 'none' }} />
                </label>
                {form.imagen && (
                  <img src={form.imagen} alt="Preview" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0 }} />
                )}
              </div>
              {form.imagen && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#4b5563', cursor: 'pointer' }}>
                  <input type="checkbox" name="derechos" checked={!!form.derechos} onChange={handleChange}
                    style={{ width: 16, height: 16, marginTop: 1, accentColor: '#5E244E' }} />
                  <span>Declaro que esta imagen es de mi autoría o tengo autorización (Ley 23/1982).</span>
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowForm(false); setEditing(null); }}
                  style={{ background: '#fff', color: '#5E244E', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={guardar} disabled={uploading}
                  style={{ background: '#5E244E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {editing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {productos.length === 0 && !showForm ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No tienes productos registrados</p>
      ) : productos.map(p => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 12, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            {p.imagen ? (
              <img src={p.imagen} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f4f6', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.emoji || '🍴'}
              </div>
            )}
            <div>
              <strong style={{ fontSize: 14, color: '#5E244E' }}>{p.nombre}</strong>
              {esMenuHoy(p) && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#FDF6E3', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 10, padding: '2px 8px' }}>
                  🍽️ MENÚ DE HOY
                </span>
              )}
              <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0' }}>{p.descripcion} {p.categoria && `• ${p.categoria}`}</p>
              {(parseLista(p.tallas).length > 0 || parseLista(p.colores).length > 0) && (
                <p style={{ fontSize: 11, color: '#5E244E', margin: '2px 0 0' }}>
                  {parseLista(p.tallas).length > 0 && `Tallas: ${parseLista(p.tallas).join(', ')}`}
                  {parseLista(p.tallas).length > 0 && parseLista(p.colores).length > 0 && ' · '}
                  {parseLista(p.colores).length > 0 && `Colores: ${parseLista(p.colores).join(', ')}`}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: '#aa1c41' }}>${parseFloat(p.precio).toLocaleString()}</span>
            <button onClick={() => toggleMenuHoy(p)} title={esMenuHoy(p) ? 'Quitar del menú de hoy' : 'Marcar como menú de hoy'}
              style={{ background: esMenuHoy(p) ? '#FDF6E3' : 'none', border: esMenuHoy(p) ? '1px solid #FDE68A' : 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>🍽️</button>
            <button onClick={() => abrirEditar(p)} style={{ background: 'none', border: 'none', color: '#5E244E', cursor: 'pointer', fontSize: 16 }}>✏️</button>
            <button onClick={() => eliminar(p.id)} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 18 }}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const inputS = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};