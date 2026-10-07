import { Outlet, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import InstallBanner from './InstallBanner';

function NavItem({ to, end, icon, label }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => navItemStyle(isActive)}>
      {({ isActive }) => (
        <>
          <div style={navIconBoxStyle(isActive)}>{icon}</div>
          <span style={navLabelStyle(isActive)}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { items } = useCart();
  const totalItems = items.reduce((sum, item) => sum + (item.cantidad || 1), 0);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }}>
      <Outlet />
      <InstallBanner />

      <nav style={{
        position: 'fixed', bottom: 0, width: '100%', background: '#fff',
        borderTop: '1px solid #e5e7eb', boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)',
        padding: '12px 24px', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 50,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <NavItem to="/" end icon={<svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>} label="Inicio" />
          <NavItem to="/favoritos" icon={<svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>} label="Favoritos" />

          <NavLink to="/carrito" style={{ textDecoration: 'none', position: 'relative', top: -10 }}>
            <div style={{
              width: 56, height: 56, background: 'linear-gradient(to left, #961e44, #6c234b)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(170,28,65,0.4)', border: '4px solid #fff',
              transition: 'filter 0.2s',
            }}>
              <svg fill="#fff" viewBox="0 0 24 24" width="22" height="22"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
              {totalItems > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
                  background: '#5e244e', color: '#fff', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 2px #fff',
                }}>
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </div>
          </NavLink>

          <NavItem to="/pedidos" icon={<svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>} label="Pedidos" />
          <NavItem to="/perfil" icon={<svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>} label="Perfil" />
        </div>
      </nav>
    </div>
  );
}

function navItemStyle(isActive) {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: 2,
  };
}

function navIconBoxStyle(isActive) {
  return {
    padding: 8, borderRadius: '50%',
    color: isActive ? '#5e244e' : '#6b7280',
    transition: 'all 0.2s',
  };
}

function navLabelStyle(isActive) {
  return {
    fontSize: 10, fontWeight: isActive ? 700 : 500,
    color: isActive ? '#5e244e' : '#6b7280',
    marginTop: 1,
  };
}