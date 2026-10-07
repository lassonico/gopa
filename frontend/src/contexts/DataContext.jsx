import { createContext, useContext, useState, useEffect } from 'react';
import { categorias, promociones, servicios, subcategorias } from '../services/api';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [categoriasList, setCategoriasList] = useState([]);
  const [subcategoriasList, setSubcategoriasList] = useState([]);
  const [promos, setPromos] = useState([]);
  const [serviciosList, setServiciosList] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadAll = () => {
    Promise.all([categorias.getAll(), promociones.getAll(), servicios.getAll(), subcategorias.getAll()])
      .then(([catRes, promRes, servRes, subRes]) => {
        setCategoriasList(catRes.data);
        setSubcategoriasList(subRes.data);
        setPromos(promRes.data);
        setServiciosList(servRes.data.filter(s => s.activo !== 'false'));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadAll();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  return (
    <DataContext.Provider value={{ categoriasList, subcategoriasList, promos, serviciosList, loaded }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
