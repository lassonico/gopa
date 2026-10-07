import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Mandados from './pages/Mandados';
import NoEncontrado from './pages/NoEncontrado';
import PushListener from './components/PushListener';
import Loader from './components/Loader';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.rol !== 'domiciliario') return <Navigate to="/login" replace />;
  return children;
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: "'Poppins', sans-serif" },
  header: { background: '#5E244E', color: '#fff', padding: '16px 20px', borderRadius: '0 0 20px 20px', marginBottom: 16 },
  card: { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 12 },
  btn: { background: '#aa1c41', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('domiciliario_user');
    const token = localStorage.getItem('domiciliario_token');
    if (stored && token) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('domiciliario_user', JSON.stringify(userData));
    localStorage.setItem('domiciliario_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('domiciliario_user');
    localStorage.removeItem('domiciliario_token');
    setUser(null);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader /></div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {user?.rol === 'domiciliario' ? (
        <div style={styles.container}>
          <div style={styles.header}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>GoPalermo Domiciliario</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>{user.nombre}</p>
              </div>
              <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Salir</button>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/mandados" element={<Mandados />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
          <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-around', padding: '8px 0', maxWidth: 480, margin: '0 auto' }}>
            <NavItem to="/" label="Dashboard" emoji="📊" />
            <NavItem to="/pedidos" label="Pedidos" emoji="📋" />
            <NavItem to="/mandados" label="Mandados" emoji="🚴" />
          </nav>
          <div style={{ height: 60 }} />
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
      <PushListener />
    </AuthContext.Provider>
  );
}

function NavItem({ to, label, emoji }) {
  const { pathname } = window.location;
  const isActive = pathname === to || (to !== '/' && pathname.startsWith(to));
  return (
    <a href={to} style={{ textAlign: 'center', textDecoration: 'none', color: isActive ? '#aa1c41' : '#9ca3af', fontSize: 12, fontWeight: isActive ? 600 : 400 }}>
      <div style={{ fontSize: 20 }}>{emoji}</div>
      {label}
    </a>
  );
}
