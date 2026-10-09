import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Comercios from './pages/Comercios';
import Productos from './pages/Productos';
import Categorias from './pages/Categorias';
import Subcategorias from './pages/Subcategorias';
import Pedidos from './pages/Pedidos';
import Usuarios from './pages/Usuarios';
import Notificaciones from './pages/Notificaciones';
import Cupones from './pages/Cupones';
import Promociones from './pages/Promociones';
import Reportes from './pages/Reportes';
import Banners from './pages/Banners';
import Servicios from './pages/Servicios';
import Domiciliarios from './pages/Domiciliarios';
import Solicitudes from './pages/Solicitudes';
import Mandados from './pages/Mandados';
import Trabajos from './pages/Trabajos';
import Tarifas from './pages/Tarifas';
import NoEncontrado from './pages/NoEncontrado';
import Sidebar from './components/Sidebar';
import Loader from './components/Loader';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.rol !== 'admin') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    const token = localStorage.getItem('admin_token');
    if (stored && token) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('admin_user', JSON.stringify(userData));
    localStorage.setItem('admin_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
    setUser(null);
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {user?.rol === 'admin' ? (
        <div className="admin-layout">
          <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
          {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)} />}
          <div className="main-content">
            <button className="hamburger-btn" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">☰</button>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/comercios/*" element={<Comercios />} />
              <Route path="/productos/*" element={<Productos />} />
              <Route path="/categorias/*" element={<Categorias />} />
              <Route path="/subcategorias/*" element={<Subcategorias />} />
              <Route path="/pedidos/*" element={<Pedidos />} />
              <Route path="/usuarios/*" element={<Usuarios />} />
              <Route path="/notificaciones/*" element={<Notificaciones />} />
              <Route path="/cupones/*" element={<Cupones />} />
              <Route path="/promociones/*" element={<Promociones />} />
              <Route path="/reportes" element={<Reportes />} />
              <Route path="/banners/*" element={<Banners />} />
              <Route path="/servicios/*" element={<Servicios />} />
              <Route path="/domiciliarios/*" element={<Domiciliarios />} />
              <Route path="/solicitudes/*" element={<Solicitudes />} />
              <Route path="/mandados/*" element={<Mandados />} />
              <Route path="/trabajos/*" element={<Trabajos />} />
              <Route path="/tarifas" element={<Tarifas />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NoEncontrado />} />
            </Routes>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </AuthContext.Provider>
  );
}
