import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { DataProvider } from './contexts/DataContext';
import { CartProvider } from './context/CartContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Comercios from './pages/Comercios';
import ComerciosNeiva from './pages/ComerciosNeiva';
import Tiendas from './pages/Tiendas';
import Dominicales from './pages/Dominicales';
import Servicios from './pages/Servicios';
import ComercioDetail from './pages/ComercioDetail';
import Carrito from './pages/Carrito';
import Pedidos from './pages/Pedidos';
import PedidoDetail from './pages/PedidoDetail';
import Perfil from './pages/Perfil';
import Notificaciones from './pages/Notificaciones';
import Favoritos from './pages/Favoritos';
import Promociones from './pages/Promociones';
import SolicitarRegistro from './pages/SolicitarRegistro';
import RegistroServicio from './pages/RegistroServicio';
import RegistroDomiciliario from './pages/RegistroDomiciliario';
import ServicioDetail from './pages/ServicioDetail';
import Calificar from './pages/Calificar';
import PoliticaDatos from './pages/PoliticaDatos';
import TerminosCondiciones from './pages/TerminosCondiciones';
import PagoExitoso from './pages/PagoExitoso';
import NoEncontrado from './pages/NoEncontrado';
import Layout from './components/Layout';
import PushListener from './components/PushListener';
import BannerCookies from './components/BannerCookies';
import Loader from './components/Loader';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  // Protección de contenido: sin menú contextual ni arrastre de imágenes
  useEffect(() => {
    const sinMenu = (e) => e.preventDefault();
    const sinArrastre = (e) => {
      if (e.target?.tagName === 'IMG') e.preventDefault();
    };
    const sinTeclas = (e) => {
      const k = (e.key || '').toLowerCase();
      // Bloquear: Ctrl/Cmd+P (imprimir), Ctrl/Cmd+S (guardar), PrintScreen
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(k)) e.preventDefault();
      if (e.key === 'PrintScreen') e.preventDefault();
    };
    document.addEventListener('contextmenu', sinMenu);
    document.addEventListener('dragstart', sinArrastre);
    document.addEventListener('keydown', sinTeclas);
    return () => {
      document.removeEventListener('contextmenu', sinMenu);
      document.removeEventListener('dragstart', sinArrastre);
      document.removeEventListener('keydown', sinTeclas);
    };
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return <div className="loading" style={{ minHeight: '100vh' }}><Loader /></div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <DataProvider>
      <CartProvider>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/olvide-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
        <Route path="/reset-password" element={user ? <Navigate to="/" replace /> : <ResetPassword />} />
        <Route path="/solicitar-registro" element={<SolicitarRegistro />} />
        <Route path="/registrar-servicio" element={<RegistroServicio />} />
        <Route path="/registrar-domiciliario" element={<RegistroDomiciliario />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Home />} />
          <Route path="comercios" element={<Comercios />} />
          <Route path="comercios-neiva" element={<ComerciosNeiva />} />
          <Route path="tiendas" element={<Tiendas />} />
          <Route path="dominicales" element={<Dominicales />} />
          <Route path="servicios" element={<Servicios />} />
          <Route path="comercios/:id" element={<ComercioDetail />} />
          <Route path="carrito" element={<Carrito />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="pedidos/:id" element={<PedidoDetail />} />
          <Route path="pedidos/:id/calificar" element={<Calificar />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="notificaciones" element={<Notificaciones />} />
          <Route path="favoritos" element={<Favoritos />} />
          <Route path="promociones" element={<Promociones />} />
          <Route path="politica-datos" element={<PoliticaDatos />} />
          <Route path="terminos-condiciones" element={<TerminosCondiciones />} />
          <Route path="servicios/:id" element={<ServicioDetail />} />
          <Route path="pago-exitoso" element={<PagoExitoso />} />
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
      <PushListener />
      <BannerCookies />
      </CartProvider>
      </DataProvider>
    </AuthContext.Provider>
  );
}
