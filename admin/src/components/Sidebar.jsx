import { NavLink } from 'react-router-dom';
import { useAuth } from '../App';

export default function Sidebar({ abierto = false, onCerrar = () => {} }) {
  const { user, logout } = useAuth();

  return (
    <aside className={`sidebar${abierto ? ' abierta' : ''}`}>
      <h2>GoPalermo</h2>
      <nav onClick={onCerrar}>
        <NavLink to="/" end>📊 Dashboard</NavLink>
        <NavLink to="/comercios">🏪 Comercios</NavLink>
        <NavLink to="/productos">📦 Productos</NavLink>
        <NavLink to="/categorias">🏷️ Categorías</NavLink>
        <NavLink to="/subcategorias">🗂️ Subcategorías</NavLink>
        <NavLink to="/pedidos">📋 Pedidos</NavLink>
        <NavLink to="/usuarios">👥 Usuarios</NavLink>
        <NavLink to="/notificaciones">🔔 Notificaciones</NavLink>
        <NavLink to="/cupones">🎫 Cupones</NavLink>
        <NavLink to="/promociones">🔥 Promociones</NavLink>
        <NavLink to="/banners">🖼️ Anuncios</NavLink>
        <NavLink to="/servicios">🔧 Servicios</NavLink>
        <NavLink to="/domiciliarios">🛵 Domiciliarios</NavLink>
        <NavLink to="/mandados">🚴 Mandados</NavLink>
        <NavLink to="/trabajos">🧵 Cola</NavLink>
        <NavLink to="/solicitudes">📨 Solicitudes</NavLink>
        <NavLink to="/tarifas">💲 Tarifas</NavLink>
        <NavLink to="/reportes">📈 Reportes</NavLink>
      </nav>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12, marginTop: 8 }}>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{user?.nombre}</p>
        <button onClick={() => { onCerrar(); logout(); }} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 16px', borderRadius: 6, fontSize: 13, width: '100%', cursor: 'pointer', border: 'none' }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
