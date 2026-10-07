import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { anuncios, uploads } from '../services/api';
import Loader from '../components/Loader';

const VALOR = 20000;
const DIAS = 5;

function contarPalabras(t) {
  return String(t || '').trim().split(/\s+/).filter(Boolean).length;
}

export default function Anuncios() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [imagen, setImagen] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [avisoImg, setAvisoImg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    anuncios.mios().then(({ data }) => setHistorial(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const palabras = contarPalabras(titulo);
  const tituloInvalido = palabras > 3;

  const handleImagen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvisoImg('');
    if (!file.type.startsWith('image/')) {
      setAvisoImg('Solo se permiten imágenes (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvisoImg('La imagen no puede superar 5 MB.');
      return;
    }
    // Verificar proporción rectangular 2:1 (≈800x400)
    const dims = await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { const r = { w: img.naturalWidth, h: img.naturalHeight }; URL.revokeObjectURL(url); resolve(r); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    if (dims) {
      const ratio = dims.w / dims.h;
      if (Math.abs(ratio - 2) > 0.15) {
        setAvisoImg(`La imagen es de ${dims.w}x${dims.h}px. Se recomienda rectangular 800x400 (2:1); la ajustaremos sin cambiar su contenido.`);
      } else if (dims.w < 800) {
        setAvisoImg(`La imagen es de ${dims.w}x${dims.h}px. Se recomienda mínimo 800x400 para buena calidad; la mejoraremos.`);
      }
    }
    setSubiendo(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await uploads.uploadBase64({ file: base64 });
      setImagen(data.url);
    } catch {
      setAvisoImg('No se pudo subir la imagen. Intenta con otra.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!titulo.trim()) { setError('Escribe el título del anuncio.'); return; }
    if (tituloInvalido) { setError('El título debe tener máximo 3 palabras.'); return; }
    if (!imagen || subiendo) { setError('Sube la imagen del anuncio.'); return; }
    setEnviando(true);
    try {
      const { data } = await anuncios.crear({ titulo: titulo.trim(), imagen });
      // Ir al checkout de Wompi (modo prueba)
      window.location.href = data.enlace;
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el anuncio. Intenta de nuevo.');
      setEnviando(false);
    }
  };

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#5E244E', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
        ← Volver
      </button>
      <h3 style={{ margin: '0 0 4px', color: '#5E244E' }}>📢 Crear anuncio</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        Aparecerá en la sección de anuncios banner, en la parte superior del inicio de la app.
      </p>

      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
        💰 <strong>${VALOR.toLocaleString('es-CO')}</strong> por <strong>{DIAS} días calendario</strong> · Pago en línea (Wompi, modo prueba)
      </div>

      {error && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
            Título del anuncio (máximo 3 palabras) *
          </label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={60}
            placeholder="Pide tu combo"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: tituloInvalido ? '1px solid #f87171' : '1px solid #e5e7eb', background: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
          <p style={{ fontSize: 12, margin: '4px 0 0', color: tituloInvalido ? '#dc2626' : '#9ca3af' }}>
            {palabras}/3 palabras{tituloInvalido ? ' — acorta el título' : ''}
          </p>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
            Imagen del anuncio (rectangular 800x400 px o equivalente) *
          </label>
          {imagen ? (
            <div>
              <img src={imagen} alt="Anuncio" style={{ width: '100%', aspectRatio: '2/1', objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }} />
              <label style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#5E244E', fontWeight: 600, cursor: 'pointer' }}>
                Cambiar imagen
                <input type="file" accept="image/*" onChange={handleImagen} style={{ display: 'none' }} />
              </label>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#5E244E', background: '#fff', border: '1px dashed #5E244E', borderRadius: 12, padding: '20px 12px', cursor: 'pointer', minHeight: 56 }}>
              {subiendo ? '⏳ Subiendo...' : '📷 Subir imagen (800x400)'}
              <input type="file" accept="image/*" onChange={handleImagen} style={{ display: 'none' }} />
            </label>
          )}
          {avisoImg && <p style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', borderRadius: 6, padding: '6px 8px', margin: '6px 0 0' }}>{avisoImg}</p>}
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
            Ajustamos y mejoramos la calidad de la imagen; no cambiamos su contenido.
          </p>
        </div>

        <button type="submit" disabled={enviando || subiendo}
          style={{ padding: '14px 16px', borderRadius: 12, background: (enviando || subiendo) ? '#d1d5db' : '#aa1c41', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: (enviando || subiendo) ? 'wait' : 'pointer', minHeight: 52 }}>
          {enviando ? 'Creando anuncio...' : `Pagar $${VALOR.toLocaleString('es-CO')} e ir a Wompi`}
        </button>
      </form>

      {historial.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: '#5E244E', marginBottom: 8, fontSize: 14 }}>Mis anuncios</h4>
          {historial.map(a => (
            <div key={a.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span><strong>{a.titulo}</strong> · ${Number(a.valor || 0).toLocaleString('es-CO')}</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: a.estado === 'pagado' ? '#DCFCE7' : a.estado === 'pendiente' ? '#FFFBEB' : '#FEE2E2', color: a.estado === 'pagado' ? '#166534' : a.estado === 'pendiente' ? '#92400E' : '#991B1B' }}>
                {a.estado === 'pagado' ? '✅ Pagado' : a.estado === 'pendiente' ? '⏳ Pendiente' : a.estado}
              </span>
            </div>
          ))}
          <Link to="/" style={{ fontSize: 12, color: '#6b7280' }}>Volver al dashboard</Link>
        </div>
      )}
    </div>
  );
}
