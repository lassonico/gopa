import { useState, useEffect } from 'react';

export default function ProductoModal({ producto, comercio, onAdd, onClose }) {
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState('');
  const [abierto, setAbierto] = useState(false);

  const parseLista = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p.map(String); } catch {}
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  };

  // Pedir a Cloudinary la imagen en JPG al tamaño del modal (más nítida y liviana)
  const aJpg = (url) => {
    if (!url || typeof url !== 'string') return url;
    const marca = '/image/upload/';
    const i = url.indexOf(marca);
    if (i === -1 || url.includes('f_jpg')) return url;
    return url.slice(0, i + marca.length) + 'w_800,q_auto,f_jpg/' + url.slice(i + marca.length);
  };

  useEffect(() => {
    if (!producto) {
      setAbierto(false);
      return;
    }
    setCantidad(1);
    setNota('');
    setTalla('');
    setColor('');
    const timer = setTimeout(() => setAbierto(true), 30);
    return () => clearTimeout(timer);
  }, [producto]);

  useEffect(() => {
    if (!producto) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [producto, onClose]);

  if (!producto) return null;

  const cerrado = comercio?.abierto === 'false';
  const tallas = parseLista(producto.tallas);
  const colores = parseLista(producto.colores);

  const agregar = () => {
    const extras = [
      talla ? `Talla: ${talla}` : '',
      color ? `Color: ${color}` : '',
      nota.trim(),
    ].filter(Boolean).join(' · ');
    onAdd(producto, cantidad, extras);
    onClose();
  };

  return (
    <div
      className={`producto-modal-overlay ${abierto ? 'abierto' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={producto.nombre}
    >
      <div className="producto-modal" onClick={(e) => e.stopPropagation()}>
        <button className="producto-modal-cerrar" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="producto-modal-imagen">
          {producto.imagen ? <img src={aJpg(producto.imagen)} alt={producto.nombre} /> : (
            <div className="producto-modal-emoji">{producto.emoji || '🍴'}</div>
          )}
        </div>
        <div className="producto-modal-body">
          <h3>{producto.nombre}</h3>
          <span className="producto-modal-precio">${parseFloat(producto.precio).toLocaleString('es-CO')}</span>
          <p className="producto-modal-descripcion">{producto.descripcion}</p>
          {(tallas.length > 0 || colores.length > 0) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {tallas.length > 0 && (
                <select value={talla} onChange={e => setTalla(e.target.value)}
                  aria-label="Talla"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff' }}>
                  <option value="">Talla: elegir</option>
                  {tallas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {colores.length > 0 && (
                <select value={color} onChange={e => setColor(e.target.value)}
                  aria-label="Color"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff' }}>
                  <option value="">Color: elegir</option>
                  {colores.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}
          <textarea
            className="producto-modal-nota"
            placeholder="Ej: sin cebolla, poco picante, extra queso..."
            maxLength={200}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
          />
        </div>
        <div className="producto-modal-footer">
          <div className="producto-cantidad">
            <button onClick={() => setCantidad(c => Math.max(1, c - 1))} aria-label="Disminuir cantidad">−</button>
            <span>{cantidad}</span>
            <button onClick={() => setCantidad(c => c + 1)} aria-label="Aumentar cantidad">+</button>
          </div>
          <button
            className="producto-modal-agregar"
            disabled={cerrado}
            onClick={agregar}
          >
            {cerrado ? 'Comercio cerrado' : 'Agregar al pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}