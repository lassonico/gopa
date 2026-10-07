import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App';
import api, { comercio as comercioApi } from '../services/api';
export default function ConfiguracionMarca() {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [empaque, setEmpaque] = useState({ cobraEmpaque: 'no', tipoEmpaque: 'pedido', valorEmpaque: '' });
  const [empaqueMessage, setEmpaqueMessage] = useState(null);
  const [guardandoEmpaque, setGuardandoEmpaque] = useState(false);
  const [fachadaUrl, setFachadaUrl] = useState('');
  const [fachadaMessage, setFachadaMessage] = useState(null);
  const [guardandoFachada, setGuardandoFachada] = useState(false);
  const [editor, setEditor] = useState(null); // { src, iw, ih, zoom, tx, ty, cw, ch }
  const marcoRef = useRef(null);
  const arrastreRef = useRef(null);

  useEffect(() => {
    cargarLogo();
  }, []);

  const cargarLogo = async () => {
    try {
      const { data } = await api.get(`/comercios/${user.comercioId}`);
      if (data.logo) {
        setLogoUrl(data.logo);
      }
      if (data.fachada) {
        setFachadaUrl(data.fachada);
      }
      setEmpaque({
        cobraEmpaque: data.cobraEmpaque || 'no',
        tipoEmpaque: data.tipoEmpaque || 'pedido',
        valorEmpaque: data.valorEmpaque || ''
      });
    } catch (e) {
      console.error('Error cargando logo:', e);
    }
  };

  const guardarEmpaque = async () => {
    setGuardandoEmpaque(true);
    setEmpaqueMessage(null);
    try {
      await api.put(`/comercios/${user.comercioId}`, {
        cobraEmpaque: empaque.cobraEmpaque,
        tipoEmpaque: empaque.tipoEmpaque,
        valorEmpaque: empaque.valorEmpaque
      });
      setEmpaqueMessage({ type: 'success', text: 'Configuración de empaque actualizada' });
    } catch (e) {
      setEmpaqueMessage({ type: 'error', text: e.response?.data?.error || 'Error guardando configuración de empaque' });
    } finally {
      setGuardandoEmpaque(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'El archivo debe ser una imagen' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'La imagen no debe superar 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const subirLogo = async () => {
    if (!preview) return;
    setLoading(true);
    setMessage(null);
    
    try {
      const formData = new FormData();
      // Convertir base64 a blob
      const response = await fetch(preview);
      const blob = await response.blob();
      formData.append('logo', blob, 'logo.png');
      
      await comercioApi.subirLogo(user.comercioId, formData);
      
      setMessage({ type: 'success', text: 'Logo actualizado correctamente' });
      setTimeout(cargarLogo, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Error subiendo logo' });
    } finally {
      setLoading(false);
    }
  };

  const eliminarLogo = async () => {
    if (!window.confirm('¿Eliminar logo actual?')) return;
    setLoading(true);
    try {
      await api.delete(`/comercios/${user.comercioId}/logo`);
      setLogoUrl('');
      setMessage({ type: 'success', text: 'Logo eliminado' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error eliminando logo' });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Fachada con recorte ----------
  const limitarEncuadre = (ed) => {
    const s0 = Math.max(ed.cw / ed.iw, ed.ch / ed.ih);
    const dw = ed.iw * s0 * ed.zoom;
    const dh = ed.ih * s0 * ed.zoom;
    const mx = Math.max(0, (dw - ed.cw) / 2);
    const my = Math.max(0, (dh - ed.ch) / 2);
    return { ...ed, tx: Math.min(mx, Math.max(-mx, ed.tx)), ty: Math.min(my, Math.max(-my, ed.ty)) };
  };

  const dimsMarco = useCallback(() => {
    const el = marcoRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cw: Math.round(r.width), ch: Math.round(r.width * 9 / 16) };
  }, []);

  useEffect(() => {
    if (editor && (!editor.cw || !editor.ch)) {
      const d = dimsMarco();
      if (d) setEditor(e => (e ? limitarEncuadre({ ...e, ...d }) : e));
    }
  }, [editor, dimsMarco]);

  const elegirFachada = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFachadaMessage({ type: 'error', text: 'El archivo debe ser una imagen' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFachadaMessage({ type: 'error', text: 'La imagen no debe superar 5MB' });
      return;
    }
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setEditor({ src, iw: img.naturalWidth, ih: img.naturalHeight, zoom: 1, tx: 0, ty: 0, cw: 0, ch: 0 });
      setFachadaMessage(null);
    };
    img.onerror = () => setFachadaMessage({ type: 'error', text: 'No se pudo leer la imagen' });
    img.src = src;
    e.target.value = '';
  };

  const iniciarArrastre = (e) => {
    if (!editor?.cw) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastreRef.current = { x: e.clientX, y: e.clientY, tx: editor.tx, ty: editor.ty };
  };
  const moverArrastre = (e) => {
    const a = arrastreRef.current;
    if (!a || !editor) return;
    setEditor(ed => ed ? limitarEncuadre({ ...ed, tx: a.tx + (e.clientX - a.x), ty: a.ty + (e.clientY - a.y) }) : ed);
  };
  const terminarArrastre = () => { arrastreRef.current = null; };

  const cambiarZoom = (z) => {
    setEditor(ed => ed ? limitarEncuadre({ ...ed, zoom: Math.min(3, Math.max(1, z)) }) : ed);
  };

  const guardarFachada = async () => {
    if (!editor?.cw) return;
    setGuardandoFachada(true);
    setFachadaMessage(null);
    try {
      const OW = 1280, OH = 720;
      const s0 = Math.max(editor.cw / editor.iw, editor.ch / editor.ih);
      const esc = s0 * editor.zoom;
      const ox = (editor.cw - editor.iw * esc) / 2 + editor.tx;
      const oy = (editor.ch - editor.ih * esc) / 2 + editor.ty;
      const canvas = document.createElement('canvas');
      canvas.width = OW; canvas.height = OH;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = editor.src; });
      ctx.drawImage(img, -ox / esc, -oy / esc, editor.cw / esc, editor.ch / esc, 0, 0, OW, OH);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('recorte');
      const formData = new FormData();
      formData.append('imagen', blob, 'fachada.jpg');
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await api.put(`/comercios/${user.comercioId}`, { fachada: data.url });
      setFachadaUrl(data.url);
      setEditor(null);
      setFachadaMessage({ type: 'success', text: 'Fachada actualizada correctamente' });
    } catch (e) {
      setFachadaMessage({ type: 'error', text: e.response?.data?.error || 'Error subiendo fachada' });
    } finally {
      setGuardandoFachada(false);
    }
  };

  const eliminarFachada = async () => {
    if (!window.confirm('¿Eliminar imagen de fachada?')) return;
    try {
      await api.put(`/comercios/${user.comercioId}`, { fachada: '' });
      setFachadaUrl('');
      setFachadaMessage({ type: 'success', text: 'Fachada eliminada' });
    } catch (e) {
      setFachadaMessage({ type: 'error', text: 'Error eliminando fachada' });
    }
  };

  const dimsVista = editor && editor.cw ? (() => {
    const s0 = Math.max(editor.cw / editor.iw, editor.ch / editor.ih);
    return {
      s0,
      dw: editor.iw * s0 * editor.zoom,
      dh: editor.ih * s0 * editor.zoom,
      ox: (editor.cw - editor.iw * s0 * editor.zoom) / 2 + editor.tx,
      oy: (editor.ch - editor.ih * s0 * editor.zoom) / 2 + editor.ty,
    };
  })() : null;

  return (
    <div className="container" style={{ maxWidth: 600, padding: 24 }}>
      <h1 style={{ color: '#5E244E', marginBottom: 24 }}>Configuración de Marca</h1>
      
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 16, color: '#5E244E' }}>Logo del Comercio</h2>
        
        <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Logo Actual</label>
            <div style={{ 
              width: 200, height: 80, border: '2px dashed var(--gray-300)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)'
            }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo actual" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ color: 'var(--gray-400)', fontSize: 14 }}>Sin logo</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Subir nuevo logo (PNG, JPG, WebP - máx 2MB)</label>
          <input 
            type="file" 
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            style={{ width: '100%', padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8 }}
          />
          {preview && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Vista Previa</label>
              <div style={{ 
                width: 200, height: 80, border: '2px solid var(--primary)', borderRadius: 12,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)'
              }}>
                <img src={preview} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button 
            onClick={subirLogo} 
            disabled={loading || !preview}
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: 14 }}
          >
            {loading ? 'Guardando...' : 'Guardar Logo'}
          </button>
          
          {logoUrl && (
            <button 
              onClick={eliminarLogo} 
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '12px 24px', fontSize: 14 }}
            >
              Eliminar Logo
            </button>
          )}
        </div>

        {message && (
          <div style={{ 
            marginTop: 16, padding: 12, borderRadius: 8,
            background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
            color: message.type === 'success' ? '#166534' : '#991B1B'
          }}>
            {message.text}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <h2 style={{ marginBottom: 8, color: '#5E244E' }}>🏠 Fachada del Negocio</h2>
        <p style={{ color: 'var(--gray-600)', marginBottom: 16, fontSize: 13 }}>
          Se muestra a los clientes en el detalle de tu comercio. Al subirla puedes moverla y agrandarla dentro del recuadro.
        </p>

        {fachadaUrl ? (
          <div style={{ marginBottom: 16 }}>
            <img src={fachadaUrl} alt="Fachada actual" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--gray-200)' }} />
          </div>
        ) : (
          <div style={{ marginBottom: 16, width: '100%', aspectRatio: '16/9', border: '2px dashed var(--gray-300)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', color: 'var(--gray-400)', fontSize: 14 }}>
            Sin imagen de fachada
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14, cursor: 'pointer' }}>
            {fachadaUrl ? 'Cambiar fachada' : 'Subir fachada'}
            <input type="file" accept="image/*" onChange={elegirFachada} style={{ display: 'none' }} />
          </label>
          {fachadaUrl && (
            <button onClick={eliminarFachada} className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: 14 }}>
              Eliminar
            </button>
          )}
        </div>

        {fachadaMessage && (
          <div style={{
            marginTop: 16, padding: 12, borderRadius: 8,
            background: fachadaMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
            color: fachadaMessage.type === 'success' ? '#166534' : '#991B1B'
          }}>
            {fachadaMessage.text}
          </div>
        )}
      </div>

      {editor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 4px', color: '#5E244E' }}>Ajustar fachada</h3>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>Arrastra para mover · usa el control para agrandar</p>
            <div ref={marcoRef}
              onPointerDown={iniciarArrastre} onPointerMove={moverArrastre} onPointerUp={terminarArrastre} onPointerLeave={terminarArrastre}
              style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: '#111', position: 'relative', touchAction: 'none', cursor: 'grab' }}>
              {dimsVista && (
                <img src={editor.src} alt="Ajuste" draggable={false}
                  style={{ position: 'absolute', left: dimsVista.ox, top: dimsVista.oy, width: dimsVista.dw, height: dimsVista.dh, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <button onClick={() => cambiarZoom(editor.zoom - 0.2)} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 18, cursor: 'pointer' }} aria-label="Reducir">−</button>
              <input type="range" min={1} max={3} step={0.1} value={editor.zoom} onChange={e => cambiarZoom(parseFloat(e.target.value))}
                style={{ flex: 1 }} aria-label="Zoom" />
              <button onClick={() => cambiarZoom(editor.zoom + 0.2)} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 18, cursor: 'pointer' }} aria-label="Agrandar">+</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditor(null)} disabled={guardandoFachada} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={guardarFachada} disabled={guardandoFachada} className="btn btn-primary" style={{ flex: 2, padding: '12px', fontSize: 14 }}>
                {guardandoFachada ? 'Subiendo...' : 'Guardar fachada'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <h2 style={{ marginBottom: 16, color: '#5E244E' }}>📦 Empaque</h2>
        <p style={{ color: 'var(--gray-600)', marginBottom: 16 }}>
          Configura si cobras un valor adicional por el empaque. Este valor se sumará al total cuando un cliente confirme su pedido.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>¿Cobra empaque?</label>
            <select
              value={empaque.cobraEmpaque}
              onChange={e => setEmpaque({ ...empaque, cobraEmpaque: e.target.value })}
              style={{ width: '100%', padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8, background: '#fff' }}
            >
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>

          {empaque.cobraEmpaque === 'si' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Tipo de cobro</label>
                <select
                  value={empaque.tipoEmpaque}
                  onChange={e => setEmpaque({ ...empaque, tipoEmpaque: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8, background: '#fff' }}
                >
                  <option value="pedido">Por pedido</option>
                  <option value="empaque">Por empaque (unidad)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  Valor {empaque.tipoEmpaque === 'empaque' ? 'por empaque' : 'por pedido'} (COP)
                </label>
                <input
                  type="number"
                  min="0"
                  value={empaque.valorEmpaque}
                  onChange={e => setEmpaque({ ...empaque, valorEmpaque: e.target.value })}
                  placeholder="Ej: 2000"
                  style={{ width: '100%', padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8 }}
                />
              </div>
            </>
          )}

          {empaqueMessage && (
            <div style={{
              padding: 12, borderRadius: 8,
              background: empaqueMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: empaqueMessage.type === 'success' ? '#166534' : '#991B1B'
            }}>
              {empaqueMessage.text}
            </div>
          )}

          <button
            onClick={guardarEmpaque}
            disabled={guardandoEmpaque}
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: 14 }}
          >
            {guardandoEmpaque ? 'Guardando...' : 'Guardar Configuración de Empaque'}
          </button>
        </div>
      </div>
    </div>
  );
}