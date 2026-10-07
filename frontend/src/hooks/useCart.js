import { useState, useEffect, useCallback } from 'react';

const CART_KEY = 'cart';

export function useCart() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    setItems(stored);
  }, []);

  const save = useCallback((newItems) => {
    const filtered = newItems.filter(Boolean);
    setItems(filtered);
    localStorage.setItem(CART_KEY, JSON.stringify(filtered));
  }, []);

  const addItem = useCallback((producto, cantidad = 1) => {
    const existing = items.find(i => i.id === producto.id);
    if (existing) {
      const updated = items.map(i =>
        i.id === producto.id ? { ...i, cantidad: i.cantidad + cantidad } : i
      );
      save(updated);
    } else {
      save([...items, { ...producto, cantidad }]);
    }
  }, [items, save]);

  const removeItem = useCallback((id) => {
    save(items.filter(i => i.id !== id));
  }, [items, save]);

  const updateCantidad = useCallback((id, delta) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const nueva = (item.cantidad || 1) + delta;
        return nueva > 0 ? { ...item, cantidad: nueva } : null;
      }
      return item;
    }).filter(Boolean);
    save(updated);
  }, [items, save]);

  const clearCart = useCallback(() => {
    save([]);
  }, [save]);

  const total = items.reduce((sum, i) => sum + (parseFloat(i.precio) || 0) * (i.cantidad || 1), 0);
  const count = items.reduce((sum, i) => sum + (i.cantidad || 1), 0);

  return { items, addItem, removeItem, updateCantidad, clearCart, total, count, setItems: save };
}