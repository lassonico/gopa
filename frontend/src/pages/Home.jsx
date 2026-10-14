import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { comercios, productos, mandados } from '../services/api';
import { useAuth } from '../App';
import { useData } from '../contexts/DataContext';
import Loader from '../components/Loader';
import { formatTiempoEstimado, esCiudadNeiva } from '../utils/formatTiempo';
import { esComercioTienda } from '../utils/tiendas';

const categoryIconMap = {
  'restaurante': '🍽️', 'pizza': '🍕', 'asados': '🥩', 'helados': '🍦',
  'panadería': '🥐', 'panaderia': '🥐', 'saludable': '🥗', 'café': '☕',
  'cafe': '☕', 'mexicano': '🌮', 'hamburguesas': '🍔', 'hamburguesa': '🍔',
  'comida rápida': '🍟', 'rapida': '🍟', 'sushi': '🍣', 'mariscos': '🦐',
  'postres': '🍰', 'ensaladas': '🥗', 'jugos': '🧃', 'bebidas': '🥤',
  'italiano': '🍝', 'china': '🥟', 'servicios': '🛠️',
  'tienda': '🛍️', 'tiendas': '🛍️', 'ropa': '👕', 'moda': '👗',
  'calzado': '👟', 'accesorios': '👜', 'perfumes': '🌸', 'boutique': '👛',
};

function getCategoryIcon(catName) {
  return categoryIconMap[catName?.toLowerCase().trim()] || '📦';
}

const normalizar = (str = '') =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { promos, loaded } = useData();
  const [comerciosList, setComerciosList] = useState([]);
  const [productosList, setProductosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [tabResultados, setTabResultados] = useState('consumo');

  // Mandado express
  const [mandadoModal, setMandadoModal] = useState(false);
  const [mandadoDireccion, setMandadoDireccion] = useState('');
  const [mandadoUbicacion, setMandadoUbicacion] = useState(null);
  const [mandadoEnviando, setMandadoEnviando] = useState(false);
  const [mandadoGeo, setMandadoGeo] = useState({ obteniendo: false, error: null });
  const [mandadoExito, setMandadoExito] = useState('');
  
  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [carouselPausado, setCarouselPausado] = useState(false);
  const carouselRef = useRef(null);

  const banners = promos.filter(p => p.tipo === 'banner' && p.activo === 'true');

  // Process banner images
  useEffect(() => {
    banners.forEach(promo => {
      if (promo?.imagen) {
        const match = promo.imagen.match(/\/d\/([^\/]+)/);
        if (match) {
          promo.imagen = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
      }
    });
  }, [banners]);

  // Auto-play carousel (pausa con hover/foco y respeta reduced-motion)
  useEffect(() => {
    if (banners.length <= 1 || carouselPausado) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length, carouselPausado]);

  const goToSlide = useCallback((index) => {
    setCurrentSlide(index);
  }, []);

  const touchStartX = useRef(null);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || banners.length <= 1) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 40) {
      setCurrentSlide(prev => (prev + (diff < 0 ? 1 : -1) + banners.length) % banners.length);
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    Promise.all([comercios.getAll(), productos.getAll()])
      .then(([comData, prodData]) => {
        setComerciosList(comData.data);
        setProductosList(prodData.data || []);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Índice de búsqueda precomputado (texto normalizado sin tildes/mayúsculas)
  const index = useMemo(() => {
    const comNameById = {};
    comerciosList.forEach(c => { comNameById[c.id] = c.nombreNegocio; });
    const productosN = (productosList || [])
      .filter(p => p.activo !== 'false')
      .map(p => ({
        ...p,
        _nom: normalizar(p.nombre),
        _extra: normalizar(`${p.descripcion || ''} ${p.categoria || ''}`),
      }));
    return { comNameById, productos: productosN };
  }, [productosList, comerciosList]);

  // Filtrado y ranking memoizado: solo recalcula cuando cambia el término o el índice
  const resultados = useMemo(() => {
    const q = normalizar(searchTerm);
    if (!q) return { comercios: comerciosList.filter(c => !esCiudadNeiva(c.ciudad)), consumo: [], tiendas: [], productos: [] };

    const score = (nom, extra) => {
      if (nom.startsWith(q)) return 8;
      if (nom.includes(q)) return 6;
      if (extra.includes(q)) return 3;
      return 0;
    };
    const sort = list => list.sort((a, b) =>
      b.score - a.score ||
      (a.abierto === b.abierto ? 0 : a.abierto === 'true' ? -1 : 1) ||
      a._orden - b._orden
    );

    const comScores = comerciosList.map((c, i) => {
      const s = score(normalizar(c.nombreNegocio), normalizar(`${c.categoria || ''} ${c.descripcion || ''}`));
      return { ...c, score: s, _orden: i };
    }).filter(c => c.score > 0 && !esCiudadNeiva(c.ciudad));

    const prodScores = index.productos.map((p, i) => {
      const s = score(p._nom, p._extra);
      return { ...p, score: s, _orden: i };
    }).filter(p => p.score > 0);

    return {
      comercios: [],
      consumo: sort(comScores.filter(c => !esComercioTienda(c))),
      tiendas: sort(comScores.filter(c => esComercioTienda(c))),
      productos: sort(prodScores),
    };
  }, [searchTerm, index, comerciosList]);

  // Si un grupo viene vacío, llevar el tab al grupo con resultados
  useEffect(() => {
    if (!searchTerm) return;
    const orden = ['consumo', 'tiendas', 'productos'];
    const primero = orden.find(t => (resultados[t] || []).length > 0);
    if (primero && (resultados[tabResultados] || []).length === 0) setTabResultados(primero);
  }, [searchTerm, resultados]);

  const cerrarMandado = () => {
    setMandadoModal(false);
    setMandadoDireccion('');
    setMandadoUbicacion(null);
    setMandadoExito('');
    setMandadoGeo({ obteniendo: false, error: null });
  };

  // Cerrar modal de mandado con Escape
  useEffect(() => {
    if (!mandadoModal) return;
    const onKey = (e) => { if (e.key === 'Escape') cerrarMandado(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mandadoModal]);

  const enviarPosicionMandado = () => {
    if (!navigator.geolocation) {
      setMandadoGeo({ obteniendo: false, error: 'Tu navegador no soporta el envío de ubicación.' });
      return;
    }
    setMandadoGeo({ obteniendo: true, error: null });
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setMandadoUbicacion({ lat, lng, enlace: `https://maps.google.com/?q=${lat},${lng}` });
      setMandadoGeo({ obteniendo: false, error: null });
    }, () => {
      setMandadoGeo({ obteniendo: false, error: 'No se pudo obtener tu ubicación. Activa el GPS y permite el acceso a la ubicación.' });
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const solicitarMandado = async () => {
    const tieneDireccion = mandadoDireccion.trim().length > 0;
    const tieneUbicacion = !!mandadoUbicacion;
    if (!tieneDireccion && !tieneUbicacion) {
      setMandadoExito('');
      setMandadoGeo({ obteniendo: false, error: 'Indica una dirección o comparte tu ubicación actual.' });
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    const telefonoVerificado = String(user?.telefonoVerificado) === '1' || String(user?.telefonoVerificado) === 'true';
    if (!telefonoVerificado) {
      setMandadoExito('');
      setMandadoGeo({ obteniendo: false, error: 'Debes verificar tu número de celular para solicitar un mensajero. Ve a tu perfil.' });
      return;
    }
    setMandadoEnviando(true);
    try {
      await mandados.create({
        direccion: mandadoDireccion.trim(),
        lat: mandadoUbicacion ? String(mandadoUbicacion.lat) : '',
        lng: mandadoUbicacion ? String(mandadoUbicacion.lng) : '',
        enlace: mandadoUbicacion ? mandadoUbicacion.enlace : '',
      });
      setMandadoGeo({ obteniendo: false, error: null });
      setMandadoExito('¡Listo! Tu solicitud llegó a los mensajeros. 💨');
      setTimeout(cerrarMandado, 2200);
    } catch (err) {
      setMandadoExito('');
      setMandadoGeo({ obteniendo: false, error: err.response?.data?.error || 'No se pudo enviar la solicitud. Intenta de nuevo.' });
    } finally {
      setMandadoEnviando(false);
    }
  };

  if (loading || !loaded) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa' }}><Loader /></div>;

  const avatarUrl = user?.avatar || (user?.id ? localStorage.getItem(`avatar_${user.id}`) : null);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: '#f8f9fa', minHeight: '100vh', paddingBottom: 96 }}>
      <header style={{
        background: 'linear-gradient(to bottom, #6c234b 30%, #961e44 100%)', color: '#fff', padding: '16px 16px 20px',
        position: 'sticky', top: 0, zIndex: 50, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32)',
      }}> 
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#aa1c41', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
              <svg aria-hidden="true" style={{ color: '#ffe8b4', display: 'block' }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#ffe8b4' }}>Entregar en</p>
              <p style={{ fontSize: 13, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.direccion ? user.direccion : 'Completa tu perfil'}
              </p>
            </div>
            <svg aria-hidden="true" style={{ color: '#e68457', fontSize: 10 }} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <Link to="/perfil" aria-label="Mi perfil" style={{ position: 'relative', textDecoration: 'none' }}>
            <img
              src={avatarUrl || `https://ui-avatars.com/api/?name=${user?.nombre || 'Usuario'}&background=ffe8b4&color=5e244e`}
              alt="Mi perfil" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e68457', cursor: 'pointer' }}
            />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, background: '#10B981', borderRadius: '50%', border: '2px solid #5e244e' }} />
          </Link>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            type="text" placeholder="¿Qué quieres pedir hoy?" aria-label="Buscar productos y comercios"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
            style={{
              width: '100%', padding: '12px 16px 12px 48px', borderRadius: 9999,
              border: 'none', background: '#fff', color: '#374151', fontSize: 14,
              outline: searchFocus ? '2px solid #e68457' : 'none', outlineOffset: 2,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
            }}
          />
          <svg aria-hidden="true" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#aa1c41' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#ffe8b4', padding: 8, borderRadius: '50%', cursor: 'pointer' }}>
            <svg style={{ color: '#5e244e', display: 'block' }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          </div>
        </div>
      </header>

      <main style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {banners.length > 0 && (
          <section aria-roledescription="carrusel" aria-label="Promociones destacadas" style={{ position: 'relative' }}
            onMouseEnter={() => setCarouselPausado(true)}
            onMouseLeave={() => setCarouselPausado(false)}
            onFocus={() => setCarouselPausado(true)}
            onBlur={() => setCarouselPausado(false)}
          >
            <div ref={carouselRef} style={{ overflow: 'hidden', borderRadius: 16 }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                style={{
                  display: 'flex',
                  transition: 'transform 0.5s ease-out',
                  transform: `translateX(-${currentSlide * 100}%)`,
                }}
              >
                {banners.map((promo, bi) => (
                  <div key={promo.id} style={{ flex: '0 0 100%', minWidth: '100%' }} aria-hidden={bi !== currentSlide}>
                    <div
                      role={(promo.comercioId || promo.link) ? 'link' : undefined}
                      tabIndex={bi === currentSlide && (promo.comercioId || promo.link) ? 0 : -1}
                      aria-label={promo.titulo}
                      onClick={() => {
                        if (promo.comercioId) navigate(`/comercios/${promo.comercioId}`);
                        else if (promo.link) {
                          const url = promo.link.startsWith('http') ? promo.link : 'https://' + promo.link;
                          if (url && !url.includes('/api')) window.location.href = url;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        if (promo.comercioId) navigate(`/comercios/${promo.comercioId}`);
                        else if (promo.link) {
                          const url = promo.link.startsWith('http') ? promo.link : 'https://' + promo.link;
                          if (url && !url.includes('/api')) window.location.href = url;
                        }
                      }}
                      style={{
                        borderRadius: 16, overflow: 'hidden', minHeight: 200, position: 'relative', display: 'flex',
                        background: promo.imagen
                          ? `url(${promo.imagen}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #aa1c41, #e68457)',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        cursor: promo.comercioId || promo.link ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ padding: 20, color: '#fff', background: 'rgba(0,0,0,0.2)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{
                          background: '#ffe8b4', color: '#5e244e', fontSize: 10, fontWeight: 700,
                          padding: '4px 8px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-start',
                        }}>
                          {promo.tipo === 'banner' ? 'Anuncio' : 'Oferta Especial'}
                        </span>
                        <p style={{ fontSize: 24, fontWeight: 700, marginTop: 8, marginBottom: 0, lineHeight: 1.2 }}>{promo.titulo}</p>
                        <p style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{promo.descripcion}</p>
                        <span style={{
                          marginTop: 16, background: '#5e244e', color: '#fff', fontSize: 13,
                          fontWeight: 600, padding: '8px 16px', borderRadius: 9999, alignSelf: 'flex-start',
                        }}>
                          {promo.comercioId || promo.link ? 'Pedir Ahora' : 'Ver más'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dots indicator */}
            {banners.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, paddingBottom: 8 }}>
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    style={{
                      minWidth: 24, minHeight: 24, padding: 8, borderRadius: 8,
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label={`Ir al banner ${i + 1}`}
                  >
                    <span style={{
                      display: 'block', width: i === currentSlide ? 24 : 8, height: 8, borderRadius: 4,
                      background: i === currentSlide ? '#5e244e' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.3s ease',
                    }} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#5e244e' }}>Categorías</h3>
            <Link to="/comercios" style={{ fontSize: 13, fontWeight: 500, color: '#e68457', textDecoration: 'none' }}>Ver todas</Link>
          </div>
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }} className="hide-scrollbar">
              <Link to="/comercios" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'pointer', textDecoration: 'none' }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 16, background: '#e58357',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 8, overflow: 'hidden',
                }}>
                  <img src="/icons/consumo.gif" alt="Consumo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  Consumo
                </span>
              </Link>
              <Link to="/tiendas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'pointer', textDecoration: 'none' }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 16, background: '#5e244e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 8, overflow: 'hidden',
                  border: '1px solid transparent', transition: 'all 0.2s',
                }}>
                  <img src="/icons/tiendas.gif" alt="Tiendas" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#5e244e' }}>
                  Tiendas
                </span>
              </Link>
              <Link to="/comercios-neiva" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'pointer', textDecoration: 'none' }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 16, background: '#ffe8b4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 8, overflow: 'hidden',
                  border: '1px solid transparent', transition: 'all 0.2s',
                }}>
                  <img src="/icons/neiva.gif" alt="Neiva" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  Neiva
                </span>
              </Link>
              <Link to="/dominicales" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'pointer', textDecoration: 'none' }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 16, background: '#961e44',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 8, overflow: 'hidden',
                }}>
                  <img src="/icons/dominicales.gif" alt="Dominicales" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  Dominicales
                </span>
              </Link>
              <Link to="/servicios" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'pointer', textDecoration: 'none' }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 16, background: '#e68457',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 8, overflow: 'hidden',
                  border: '1px solid transparent', transition: 'all 0.2s',
                }}>
                  <img src="/icons/servicios.gif" alt="Servicios" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  Servicios
                </span>
              </Link>
              <button
                onClick={() => setMandadoModal(true)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 16, background: '#6c234b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 8, overflow: 'hidden',
                  border: '1px solid transparent', transition: 'all 0.2s',
                }}>
                  <img src="/icons/solicitar.gif" alt="Mandados express" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  Mandados express
                </span>
              </button>
            </div>
          </section>

        <section>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#5e244e', marginBottom: 16 }}>
            {searchTerm ? `Resultados para "${searchTerm}"` : 'Populares cerca de ti'}
          </h3>
          {!searchTerm && (() => {
            const hoy = new Date().toISOString().slice(0, 10);
            const menus = (productosList || []).filter(p =>
              (p.menuDia === 'true' || p.menuDia === true) &&
              String(p.menuFecha || '').slice(0, 10) === hoy && p.activo !== 'false'
            );
            if (!menus.length) return null;
            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>🍽️</span>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#5e244e', margin: 0 }}>Menú de hoy</h4>
                </div>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }} className="hide-scrollbar">
                  {menus.map(m => (
                    <div key={m.id} role="link" tabIndex={0} aria-label={`Ver ${m.nombre} en ${index.comNameById[m.comercioId] || ''}`}
                      onClick={() => navigate(`/comercios/${m.comercioId}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/comercios/${m.comercioId}`); } }}
                      style={{ minWidth: 150, maxWidth: 150, background: '#fff', borderRadius: 16, padding: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #FDE68A', cursor: 'pointer' }}>
                      <div style={{ width: '100%', height: 90, borderRadius: 10, background: '#ffe8b4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden', marginBottom: 8 }}>
                        {m.imagen ? <img src={m.imagen} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (m.emoji || '🍴')}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</p>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#aa1c41', margin: '0 0 2px' }}>${parseFloat(m.precio || 0).toLocaleString('es-CO')}</p>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index.comNameById[m.comercioId] || ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {searchTerm && (resultados.productos.length > 0 || resultados.consumo.length > 0 || resultados.tiendas.length > 0) && (
              <div role="tablist" aria-label="Tipo de resultados" style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'consumo', label: `🍔 Consumo (${resultados.consumo.length})` },
                  { id: 'tiendas', label: `🛍️ Tiendas (${resultados.tiendas.length})` },
                  { id: 'productos', label: `Productos (${resultados.productos.length})` },
                ].map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tabResultados === t.id}
                    onClick={() => setTabResultados(t.id)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 9999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      border: '1px solid #f3f4f6',
                      background: tabResultados === t.id ? '#5e244e' : '#fff',
                      color: tabResultados === t.id ? '#fff' : '#5e244e',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {searchTerm && tabResultados === 'productos' && resultados.productos.length > 0 && (
              <>
                {resultados.productos.slice(0, 8).map(p => (
                  <Link key={`prod-${p.id}`} to={`/comercios/${p.comercioId}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: '#fff', borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', gap: 12,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
                    }}>
                      {p.imagen ? (
                        <img src={p.imagen} alt={p.nombre} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: '#ffe8b4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                          {p.emoji || '🍴'}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: 14, color: '#1f2937' }}>{p.nombre}</strong>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#aa1c41', whiteSpace: 'nowrap' }}>
                            ${parseFloat(p.precio || 0).toLocaleString('es-CO')}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {index.comNameById[p.comercioId] || 'Tienda'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            )}

            {(!searchTerm || tabResultados === 'consumo' || tabResultados === 'tiendas') && (!searchTerm ? resultados.comercios.slice(0, 10) : (tabResultados === 'tiendas' ? resultados.tiendas : resultados.consumo).slice(0, 10)).map((com, i) => (
              <Link key={com.id} to={`/comercios/${com.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: 12, display: 'flex',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
                  position: 'relative', overflow: 'hidden', cursor: 'pointer',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
                    background: i % 2 === 0 ? '#aa1c41' : '#e68457',
                  }} />
                  <div style={{
                    width: 96, height: 96, borderRadius: 12, background: '#ffe8b4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 700, color: '#5e244e', flexShrink: 0, overflow: 'hidden',
                  }}>
                    {com.logo ? (
                      <img src={com.logo} alt={com.nombreNegocio} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      com.nombreNegocio?.[0] || '?'
                    )}
                  </div>
                  <div style={{ marginLeft: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{com.nombreNegocio}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: com.abierto === 'true' ? '#DCFCE7' : '#FEE2E2',
                          color: com.abierto === 'true' ? '#166534' : '#991B1B',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: com.abierto === 'true' ? '#16A34A' : '#DC2626' }} />
                          {com.abierto === 'true' ? 'Abierto' : 'Cerrado'}
                        </span>
                        <div style={{ background: '#ffe8b4', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#5e244e', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg style={{ color: '#e68457' }} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          {parseFloat(com.calificacionPromedio || 0).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{com.categoria || 'General'} {com.rangoPrecio ? `• ${com.rangoPrecio}` : ''}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
                        <svg style={{ color: '#e68457' }} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {formatTiempoEstimado(com.tiempoEstimado) || '25-35'} min
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
                        <svg style={{ color: '#aa1c41' }} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17h14M5 12h14M5 7h14"/></svg>
                        {com.costoEnvio ? `$${parseInt(com.costoEnvio).toLocaleString()}` : 'Gratis'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {!searchTerm && resultados.comercios.length > 10 && (
              <Link to="/comercios" style={{ alignSelf: 'center', fontSize: 13, fontWeight: 700, color: '#5e244e', background: '#fff', border: '1px solid #f3f4f6', borderRadius: 9999, padding: '10px 20px', textDecoration: 'none' }}>
                Ver todos los comercios →
              </Link>
            )}
            {resultados.comercios.length === 0 && !searchTerm && (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: 32, fontSize: 14 }}>
                No hay comercios disponibles
              </p>
            )}
            {searchTerm && resultados.consumo.length === 0 && resultados.tiendas.length === 0 && resultados.productos.length === 0 && (
              <p role="status" style={{ textAlign: 'center', color: '#6b7280', padding: 32, fontSize: 14 }}>
                No se encontraron resultados para "{searchTerm}"
              </p>
            )}
          </div>
        </section>

        <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
          <img src="/GoPalermoOscuro.svg" alt="GoPalermo" style={{ maxWidth: '80%', height: 'auto' }} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
            Hecha con ayuda de IA 🤖
          </p>
        </div>
      </main>

      {mandadoModal && (
        <div
          onClick={cerrarMandado}
          style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div role="dialog" aria-modal="true" aria-label="Solicitar mensajero"
            onClick={(e) => e.stopPropagation()}
            style={{
            background: '#fff', borderRadius: 18, padding: 24, maxWidth: 420, width: '100%',
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#5e244e' }}>🚴 Solicitar mensajero</h3>
              <button onClick={cerrarMandado} disabled={mandadoEnviando} aria-label="Cerrar"
                style={{ border: 'none', background: 'none', fontSize: 18, color: '#6b7280', cursor: 'pointer', minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>
              Solicita un mensajero para que haga diligencias por ti en Palermo. Acuerda la tarifa con él.
            </p>

            <label htmlFor="mandado-direccion" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Dirección opcional
            </label>
            <input
              id="mandado-direccion"
              value={mandadoDireccion}
              onChange={e => { setMandadoDireccion(e.target.value); setMandadoGeo(g => ({ ...g, error: null })); }}
              placeholder="¿A dónde te llegamos? (barrio, puntos de referencia)"
              style={{ width: '100%', padding: 12, border: '2px solid #e5e7eb', borderRadius: 10, boxSizing: 'border-box', fontSize: 14 }}
            />

            {!mandadoUbicacion ? (
              <button onClick={enviarPosicionMandado} disabled={mandadoGeo.obteniendo} className="btn btn-secondary"
                style={{ width: '100%', marginTop: 8 }}>
                {mandadoGeo.obteniendo ? '⏳ Obteniendo tu ubicación…' : '📍 Enviar posición actual'}
              </button>
            ) : (
              <div style={{
                marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#FFF5FB', border: '2px solid #5e244e', borderRadius: 10, padding: '8px 12px',
              }}>
                <span style={{ fontSize: 13, color: '#5e244e', fontWeight: 600 }}>📍 Posición enviada</span>
                <a href={mandadoUbicacion.enlace} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#e68457', fontWeight: 600 }}>
                  Ver mapa ↗
                </a>
              </div>
            )}
            {mandadoGeo.error && (
              <p role="alert" style={{ fontSize: 12, color: '#B91C1C', margin: '8px 0 0' }}>{mandadoGeo.error}</p>
            )}

            {mandadoExito && (
              <div role="status" style={{ marginTop: 12, background: '#DCFCE7', color: '#166534', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                {mandadoExito}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={cerrarMandado} disabled={mandadoEnviando} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={solicitarMandado} disabled={mandadoEnviando}
                style={{ background: '#5e244e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {mandadoEnviando ? 'Enviando…' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
