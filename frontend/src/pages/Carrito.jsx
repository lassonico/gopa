import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pedidos, cupones } from '../services/api';
import { useAuth } from '../App';
import { useCart } from '../context/CartContext';
import AlertModal from '../components/AlertModal';
import { formatTiempoEstimado, esCiudadNeiva } from '../utils/formatTiempo';

export default function Carrito() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    items, 
    removeItem, 
    updateCantidad, 
    clearCart,
    getSubtotal,
    isSameComercio,
    getComercioId,
    getComercioItems
  } = useCart();
  const [codigoCupon, setCodigoCupon] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [tipoDireccion, setTipoDireccion] = useState('casa');
  const [direccion, setDireccion] = useState('');
  const [ubicacion, setUbicacion] = useState(null);
  const [ubicando, setUbicando] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [programar, setProgramar] = useState(false);
  const [fechaProg, setFechaProg] = useState('');
  const [horaProg, setHoraProg] = useState('12:00');
  const OPCIONES_PAGO = [
    { valor: 'efectivo', icono: '💵', label: 'Efectivo', desc: 'Paga al recibir tu pedido' },
    { valor: 'tarjeta', icono: '📱', label: 'Tarjeta (DataFono)', desc: 'Datafono al recibir · recargo 3.29% + $300' },
    { valor: 'tarjeta_online', icono: '💳', label: 'Tarjeta (Online)', desc: 'Pago con tarjeta en línea vía Wompi' },
    { valor: 'pse', icono: '🏦', label: 'PSE', desc: 'Pago en línea vía Wompi' }
  ];
  const PAGA_WOMPI = metodoPago === 'pse' || metodoPago === 'tarjeta_online';
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [alertaConRedireccion, setAlertaConRedireccion] = useState(false);

  useEffect(() => {
    if (user?.direccion && tipoDireccion === 'casa') setDireccion(user.direccion);
  }, [user, tipoDireccion]);

  const vaciarCarrito = () => {
    clearCart();
  };

  const cambiarTipoDireccion = (t) => {
    setTipoDireccion(t);
    setGeoError(null);
    if (t === 'casa') {
      setDireccion(user?.direccion || '');
    } else if (t === 'otra') {
      setDireccion('');
    } else {
      setDireccion('');
      setUbicacion(null);
    }
  };

  const obtenerUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta el envío de ubicación. Usa otra dirección o el navegador de Google.');
      return;
    }
    setUbicando(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const enlace = `https://maps.google.com/?q=${lat},${lng}`;
        let nombre = '';
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
          if (res.ok) {
            const json = await res.json();
            nombre = json.display_name || '';
          }
        } catch {}
        setUbicacion({ lat, lng, enlace });
        setDireccion(`${nombre ? nombre + '\n' : ''}📍 ${enlace}`);
      } finally {
        setUbicando(false);
      }
    }, err => {
      setUbicando(false);
      setGeoError('No se pudo obtener tu ubicación. Activa el GPS y permite el acceso a la ubicación.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const mismoComercio = items.length === 0 || items.every(i => i.comercioId === items[0].comercioId);
  const comercioNombre = items.length > 0 ? items[0].comercioNombre || items[0].comercio || '' : '';
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.precio) * (item.cantidad || 1), 0);
  const totalUnidades = items.reduce((sum, item) => sum + (item.cantidad || 1), 0);
  const primerItem = items[0] || {};
  const cobraEmpaque = primerItem.cobraEmpaque === 'si';
  const costoEmpaque = cobraEmpaque
    ? primerItem.tipoEmpaque === 'empaque'
      ? parseFloat(primerItem.valorEmpaque || 0) * totalUnidades
      : parseFloat(primerItem.valorEmpaque || 0)
    : 0;
  const baseTotal = Math.max(0, subtotal - descuento + costoEmpaque);
  const esNeiva = primerItem.ciudad ? esCiudadNeiva(primerItem.ciudad) : false;
  const costoDomicilio = esNeiva ? 30000 : 2600;
  const tiempoDomicilio = esNeiva ? formatTiempoEstimado(primerItem.tiempoEstimado || 100) : '';
  const comisionWompi = PAGA_WOMPI ? baseTotal * 0.0265 + 700 : 0;
  const ivaWompi = comisionWompi * 0.19;
  const recargoWompi = Math.round(comisionWompi + ivaWompi);
  const recargoDatafono = metodoPago === 'tarjeta' ? Math.round(baseTotal * 0.0329 + 300) : 0;
  const total = baseTotal + costoDomicilio + recargoWompi + recargoDatafono;

  const validarCupon = async () => {
    if (!codigoCupon) return;
    try {
      const { data } = await cupones.validar({ codigo: codigoCupon, totalCarrito: subtotal });
      if (data.valido) {
        setDescuento(data.descuento);
        setAlert({ title: 'Cupón aplicado', message: `Descuento de -$${data.descuento.toLocaleString('es-CO')}` });
      }
    } catch (err) {
      setAlert({ title: 'Cupón inválido', message: err.response?.data?.error || 'El cupón no es válido' });
    }
  };

  const realizarPedido = async () => {
    if (items.length === 0) return;
    const telefonoVerificado = String(user?.telefonoVerificado) === '1' || String(user?.telefonoVerificado) === 'true';
    if (!telefonoVerificado) {
      setAlertaConRedireccion(true);
      setAlert({ title: 'Verifica tu teléfono', message: 'Para hacer pedidos necesitas tener tu número de celular verificado. Te llevaremos a tu perfil.' });
      return;
    }
    if (!direccion.trim()) {
      const msg = tipoDireccion === 'casa'
        ? 'No tienes una dirección registrada. Elige "Otra dirección" o comparte tu ubicación.'
        : tipoDireccion === 'ubicacion'
          ? 'Comparte tu ubicación actual para continuar.'
          : 'Ingresa la dirección de entrega';
      setAlert({ title: 'Dirección requerida', message: msg });
      return;
    }
    const comercioId = items[0].comercioId;
    const sameComercio = items.every(i => i.comercioId === comercioId);
    if (!sameComercio) {
      setAlert({ title: 'Pedido inválido', message: 'Los productos deben ser del mismo comercio. Separa tus pedidos por restaurante.' });
      return;
    }
    setLoading(true);
    try {
      let fechaProgramada = '';
      if (programar) {
        if (!fechaProg) {
          setAlert({ title: 'Fecha requerida', message: 'Elige el día de entrega programada.' });
          setLoading(false);
          return;
        }
        fechaProgramada = `${fechaProg}T${horaProg || '12:00'}:00`;
      }
      const { data } = await pedidos.create({
        comercioId,
        productos: items.map(i => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, nota: i.nota || '' })),
        direccionEntrega: direccion,
        notas,
        total: total.toString(),
        costoEmpaque: costoEmpaque.toString(),
        tipoEmpaque: cobraEmpaque ? primerItem.tipoEmpaque : '',
        costoDomicilio: '0',
        metodoPago,
        codigoCupon: descuento > 0 ? codigoCupon : '',
        fechaProgramada,
        recargoWompi: recargoWompi.toString(),
        recargoDatafono: recargoDatafono.toString(),
        lat: tipoDireccion === 'ubicacion' && ubicacion ? String(ubicacion.lat) : '',
        lng: tipoDireccion === 'ubicacion' && ubicacion ? String(ubicacion.lng) : ''
      });
      clearCart();
      const pagaOnline = metodoPago === 'pse' || metodoPago === 'tarjeta_online';
      navigate(`/pedidos/${data.id}${pagaOnline ? '?pago=pendiente' : ''}`);
    } catch (err) {
      setAlert({ title: 'Error', message: err.response?.data?.error || 'Error al crear pedido' });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Carrito</h1>
      </div>
        <div className="empty-state">
          <h3>Carrito vacío</h3>
          <p>Agrega productos desde los comercios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 120 }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Carrito</h1>
        <button onClick={clearCart} style={{
          background: 'none', border: '1px solid var(--gray-300)', borderRadius: 8, padding: '6px 12px',
          fontSize: 12, color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Vaciar carrito
        </button>
      </div>

      {!mismoComercio && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Los productos son de diferentes comercios. Separa tus pedidos por restaurante.
        </div>
      )}
      {mismoComercio && comercioNombre && (
        <div style={{ background: '#FFE8B4', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#5E244E', fontWeight: 600 }}>
          Pedido para: {comercioNombre}
        </div>
      )}
      {items.map(item => (
        <div key={`${item.id}-${item.comercioId}`} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15, wordBreak: 'break-word' }}>{item.nombre}</h3>
            <span className="precio" style={{ fontSize: 16 }}>
              ${(parseFloat(item.precio) * (item.cantidad || 1)).toLocaleString('es-CO')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => updateCantidad(item.id, item.comercioId, (item.cantidad || 1) - 1)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-200)', fontSize: 18 }}>
              -
            </button>
            <span style={{ fontWeight: 600 }}>{item.cantidad || 1}</span>
            <button onClick={() => updateCantidad(item.id, item.comercioId, (item.cantidad || 1) + 1)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(to left, #961e44, #6c234b)', color: '#fee7b3', fontSize: 18 }}>
              +
            </button>
            <button onClick={() => removeItem(item.id, item.comercioId)} style={{
              width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16
            }}>🗑</button>
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="input-group">
          <label>Método de pago</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OPCIONES_PAGO.map(op => (
              <label key={op.valor} style={{
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, cursor: 'pointer',
                padding: '10px 12px', borderRadius: 10,
                border: metodoPago === op.valor ? '2px solid var(--primary)' : '2px solid var(--gray-200)',
                background: metodoPago === op.valor ? '#FFF5FB' : 'transparent'
              }}>
                <input type="radio" name="metodoPago" value={op.valor} checked={metodoPago === op.valor}
                  onChange={e => setMetodoPago(e.target.value)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                <span style={{ fontSize: 20 }}>{op.icono}</span>
                <span style={{ flex: 1 }}>
                  <strong>{op.label}</strong>
                  {metodoPago === op.valor && <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-600)' }}>{op.desc}</span>}
                </span>
              </label>
            ))}
          </div>
          {(metodoPago === 'pse' || metodoPago === 'tarjeta_online') && (
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 8 }}>
              Serás redirigido a la pasarela de pago de Wompi al confirmar tu pedido.
              Comisión: 2.65% + $700 + IVA.
            </p>
          )}
          {metodoPago === 'tarjeta' && (
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 8 }}>
              Se aplicará un recargo del 3.29% + $300 por pago con datáfono al recibir.
            </p>
          )}
        </div>

        <div className="input-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={programar} onChange={e => setProgramar(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
            📅 Programar entrega para otro día/hora
          </label>
          {programar && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="date" value={fechaProg} min={new Date().toISOString().slice(0, 10)}
                max={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
                onChange={e => setFechaProg(e.target.value)}
                style={{ flex: 2, padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8 }} />
              <input type="time" value={horaProg} onChange={e => setHoraProg(e.target.value)}
                style={{ flex: 1, padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8 }} />
            </div>
          )}
          {programar && (
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6, marginBottom: 0 }}>
              El comercio lo verá y entrará a cocina a su hora. Mínimo 30 min de anticipación.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, width: '100%' }}>
          <input
            placeholder="Código de cupón"
            value={codigoCupon}
            onChange={e => setCodigoCupon(e.target.value)}
            style={{ flex: 1, minWidth: 0, width: '100%', padding: 10, border: '2px solid var(--gray-200)', borderRadius: 8, boxSizing: 'border-box' }}
          />
          <button onClick={validarCupon} className="btn btn-secondary" style={{ width: 'auto', flexShrink: 0, padding: '10px 16px' }}>
            Aplicar
          </button>
        </div>

        <div className="input-group">
          <label>¿Dónde entregamos?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { valor: 'casa', icono: '🏠', titulo: 'Mi casa', desc: 'Tu dirección registrada' },
              { valor: 'otra', icono: '📝', titulo: 'Otra dirección', desc: 'Entregar en otro lugar de Palermo (amigo, oficina…)' },
              { valor: 'ubicacion', icono: '📍', titulo: 'Mi ubicación actual', desc: 'Enviar ubicación con Google Maps' },
            ].map(op => (
              <label key={op.valor} style={{
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, cursor: 'pointer',
                padding: '10px 12px', borderRadius: 10,
                border: tipoDireccion === op.valor ? '2px solid var(--primary)' : '2px solid var(--gray-200)',
                background: tipoDireccion === op.valor ? '#FFF5FB' : 'transparent'
              }}>
                <input type="radio" name="tipoDireccion" checked={tipoDireccion === op.valor}
                  onChange={() => cambiarTipoDireccion(op.valor)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                <span style={{ fontSize: 20 }}>{op.icono}</span>
                <span style={{ flex: 1 }}>
                  <strong>{op.titulo}</strong>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-600)' }}>{op.desc}</span>
                </span>
              </label>
            ))}
          </div>

          {tipoDireccion === 'casa' && (
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 8 }}>
              Se entregará en: <strong>{user?.direccion || 'Sin dirección registrada — elige otra opción'}</strong>
            </p>
          )}

          {tipoDireccion === 'otra' && (
            <div style={{ marginTop: 8 }}>
              <input
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Ej: Barrio Centro, casa 24, frente al parque"
                required
              />
              <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                Describe el lugar lo más claro posible para que el domiciliario lo encuentre.
              </p>
            </div>
          )}

          {tipoDireccion === 'ubicacion' && (
            <div style={{ marginTop: 8 }}>
              {!ubicacion ? (
                <button onClick={obtenerUbicacion} disabled={ubicando} className="btn btn-secondary" style={{ width: '100%' }}>
                  {ubicando ? '⏳ Obteniendo tu ubicación…' : '📡 Compartir mi ubicación actual'}
                </button>
              ) : (
                <>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${ubicacion.lat},${ubicacion.lng}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 8 }}>
                    🗺️ Abrir ruta en Google Maps
                  </a>
                  <iframe
                    title="Mapa de ubicación"
                    src={`https://maps.google.com/maps?q=${ubicacion.lat},${ubicacion.lng}&z=16&output=embed`}
                    style={{ width: '100%', height: 200, border: 0, borderRadius: 10 }}
                    allowFullScreen
                  />
                </>
              )}
              {geoError && (
                <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{geoError}</p>
              )}
            </div>
          )}
        </div>
        <div className="input-group">
          <label>Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
        </div>

        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Subtotal</span><span>${subtotal.toLocaleString('es-CO')}</span>
          </div>
          {descuento > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--success)' }}>
              <span>Descuento</span><span>-${descuento.toLocaleString('es-CO')}</span>
            </div>
          )}
          {costoEmpaque > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Empaque</span><span>+${costoEmpaque.toLocaleString('es-CO')}</span>
            </div>
          )}
          {costoDomicilio > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{esNeiva ? 'Domicilio (Neiva)' : 'Domicilio'}</span><span>+${costoDomicilio.toLocaleString('es-CO')}</span>
            </div>
          )}
          {esNeiva && tiempoDomicilio && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: 'var(--gray-600)' }}>
              <span>Llegada estimada</span><span>🛵 {tiempoDomicilio}</span>
            </div>
          )}
          {recargoWompi > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#B45309' }}>
              <span>Recargo {metodoPago === 'pse' ? 'PSE' : 'Tarjeta'} (Wompi)</span>
              <span>+${recargoWompi.toLocaleString('es-CO')}</span>
            </div>
          )}
          {recargoDatafono > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#B45309' }}>
              <span>Recargo Tarjeta (DataFono 3.29% + $300)</span>
              <span>+${recargoDatafono.toLocaleString('es-CO')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18 }}>
            <span>Total</span><span style={{ color: 'var(--primary)' }}>${total.toLocaleString('es-CO')}</span>
          </div>
        </div>

        <button onClick={realizarPedido} className="btn btn-primary" style={{ marginTop: 16 }} disabled={loading || !mismoComercio}>
          {loading ? 'Procesando...' : !mismoComercio ? 'Selecciona un solo comercio' : 'Realizar Pedido'}
        </button>
      </div>
      <AlertModal show={!!alert} title={alert?.title} message={alert?.message} onClose={() => {
        setAlert(null);
        if (alertaConRedireccion) {
          setAlertaConRedireccion(false);
          navigate('/perfil');
        }
      }} />
    </div>
  );
}
