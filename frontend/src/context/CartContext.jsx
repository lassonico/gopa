import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch {
        localStorage.removeItem('cart');
      }
    }
  }, []);

  // Guardar en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product, cantidad = 1) => {
    const nota = product.nota || '';
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id && i.comercioId === product.comercioId && (i.nota || '') === nota);
      if (existing) {
        return prev.map(i => i.id === product.id && i.comercioId === product.comercioId && (i.nota || '') === nota
          ? { ...i, cantidad: (i.cantidad || 1) + cantidad }
          : i);
      }
      return [...prev, { ...product, cantidad }];
    });
    setIsOpen(true); // Abrir mini-carrito al agregar
  }, []);

  const removeItem = useCallback((id, comercioId) => {
    setItems(prev => prev.filter(i => !(i.id === id && i.comercioId === comercioId)));
  }, []);

  const updateCantidad = useCallback((id, comercioId, cantidad) => {
    if (cantidad <= 0) {
      removeItem(id, comercioId);
      return;
    }
    setItems(prev => prev.map(i => 
      i.id === id && i.comercioId === comercioId ? { ...i, cantidad } : i
    ));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setIsOpen(false);
  }, []);

  const replaceItems = useCallback((newItems) => {
    setItems(newItems || []);
  }, []);

  const getComercioItems = useCallback((comercioId) => {
    return items.filter(i => i.comercioId === comercioId);
  }, [items]);

  const getTotalItems = useCallback(() => {
    return items.reduce((sum, item) => sum + (item.cantidad || 1), 0);
  }, [items]);

  const getSubtotal = useCallback(() => {
    return items.reduce((sum, item) => sum + parseFloat(item.precio) * (item.cantidad || 1), 0);
  }, [items]);

  const getComercioId = useCallback(() => {
    return items.length > 0 ? items[0].comercioId : null;
  }, [items]);

  const isSameComercio = useCallback(() => {
    if (items.length === 0) return true;
    const firstComercioId = items[0].comercioId;
    return items.every(i => i.comercioId === firstComercioId);
  }, [items]);

  return (
    <CartContext.Provider value={{
      items,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      updateCantidad,
      clearCart,
      replaceItems,
      getComercioItems,
      getTotalItems,
      getSubtotal,
      getComercioId,
      isSameComercio: isSameComercio(),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
}