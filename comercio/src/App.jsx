import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Productos from './pages/Productos';
import ConfiguracionMarca from './pages/ConfiguracionMarca';
import IpWhitelist from './pages/IpWhitelist';
import Horarios from './pages/Horarios';
import CrearPassword from './pages/CrearPassword';
import Anuncios from './pages/Anuncios';
import AnuncioRetorno from './pages/AnuncioRetorno';
import NoEncontrado from './pages/NoEncontrado';
import PushListener from './components/PushListener';
import FcmTokenSync from './components/FcmTokenSync';
import Loader from './components/Loader';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.rol !== 'comercio') return <Navigate to="/login" replace />;
  return children;
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: "'Poppins', sans-serif" },
  header: { background: '#5E244E', color: '#fff', padding: '16px 20px', borderRadius: '0 0 20px 20px', marginBottom: 16 },
  card: { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 12 },
  btn: { background: '#aa1c41', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  badge: (active) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: active ? '#dcfce7' : '#fef2f2', color: active ? '#166534' : '#991b1b' }),
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('comercio_user');
    const token = localStorage.getItem('comercio_token');
    if (stored && token) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('comercio_user', JSON.stringify(userData));
    localStorage.setItem('comercio_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('comercio_user');
    localStorage.removeItem('comercio_token');
    setUser(null);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader /></div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {user?.rol === 'comercio' ? (
        <div style={styles.container}>
          <div style={styles.header}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>GoPalermo Comercio</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>{user.nombre}</p>
              </div>
              <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Salir</button>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/configuracion/marca" element={<ConfiguracionMarca />} />
            <Route path="/configuracion/ip-whitelist" element={<IpWhitelist />} />
            <Route path="/configuracion/horarios" element={<Horarios />} />
            <Route path="/anuncios" element={<Anuncios />} />
            <Route path="/anuncios/retorno" element={<AnuncioRetorno />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
          <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-around', padding: '8px 0', maxWidth: 480, margin: '0 auto' }}>
            <NavItem to="/" label="Dashboard" emoji="📊" />
            <NavItem to="/pedidos" label="Pedidos" emoji="📋" />
            <NavItem to="/productos" label="Productos" emoji="📦" />
            <NavItem to="/configuracion/horarios" label="Horarios" emoji="🕗" />
            <NavItem to="/configuracion/marca" label="Marca" emoji="🎨" />
          </nav>
          <div style={{ height: 60 }} />
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/crear-password" element={<CrearPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
      <PushListener />
      <FcmTokenSync />
    </AuthContext.Provider>
  );
}

function NavItem({ to, label, emoji }) {
  const { pathname } = useLocation();
  const isActive = pathname === to || (to !== '/' && pathname.startsWith(to));
  return (
    <Link to={to} aria-current={isActive ? 'page' : undefined} style={{ textAlign: 'center', textDecoration: 'none', color: isActive ? '#aa1c41' : '#9ca3af', fontSize: 12, fontWeight: isActive ? 600 : 400, padding: '4px 8px' }}>
      <div style={{ fontSize: 20 }} aria-hidden="true">{emoji}</div>
      {label}
    </Link>
  );
}
