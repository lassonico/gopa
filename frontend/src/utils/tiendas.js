// Esquema de categorías de la app GoPalermo
// Grupos fijos del menú + subcategorías con alias para
// clasificar comercios antiguos y nuevos sin importar
// mayúsculas, tildes o singular/plural.

function normalizar(str = '') {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Grupo 1: Consumo (comida)
export const CONSUMO_SUBS = [
  { nombre: 'Comidas rápidas', icono: '🍟', alias: ['comida rapida', 'comidas rapidas', 'rapida', 'rapidas', 'hamburguesa', 'hamburguesas', 'perro', 'perros', 'empanada', 'empanadas', 'fritos', 'asados', 'pollo', 'pollo asado'] },
  { nombre: 'Restaurante', icono: '🍽️', alias: ['restaurante', 'restaurantes', 'almuerzos', 'almuerzo', 'corrientazo', 'casera', 'criolla', 'menu del dia'] },
  { nombre: 'Café', icono: '☕', alias: ['cafe', 'cafeteria', 'cafeterias'] },
  { nombre: 'Panadería y Pastelería', icono: '🥐', alias: ['panaderia', 'pasteleria', 'panaderia y pasteleria', 'reposteria', 'pan', 'tortas'] },
  { nombre: 'Pizza', icono: '🍕', alias: ['pizza', 'pizzas', 'pizzeria'] },
  { nombre: 'Bebidas', icono: '🥤', alias: ['bebida', 'bebidas', 'jugos', 'jugo', 'jugueria', 'malteadas', 'limonadas'] },
  { nombre: 'Helados', icono: '🍦', alias: ['helado', 'helados', 'heladeria', 'paleteria', 'paletas'] },
  { nombre: 'Postres', icono: '🍰', alias: ['postre', 'postres', 'dulces', 'dulce'] },
];

// Grupo 2: Tiendas
export const TIENDAS_SUBS = [
  { nombre: 'Calzado', icono: '👟', alias: ['calzado', 'zapatos', 'zapato', 'zapateria'] },
  { nombre: 'Ropa', icono: '👕', alias: ['ropa', 'moda', 'boutique', 'prendas', 'camisas', 'vestidos'] },
  { nombre: 'Accesorios', icono: '👜', alias: ['accesorio', 'accesorios', 'bisuteria', 'bolsos', 'carteras'] },
  { nombre: 'Perfumes', icono: '🌸', alias: ['perfume', 'perfumes', 'perfumeria', 'lociones', 'fragancias'] },
  { nombre: 'Otros', icono: '🛍️', alias: [] },
];

// Nombres legacy que también cuentan como tienda
const CATEGORIAS_TIENDA_EXTRA = [
  'tienda', 'tiendas', 'joyeria', 'relojeria', 'belleza', 'cosmeticos',
  'electronica', 'tecnologia', 'celulares', 'deportes', 'jugueteria',
  'papeleria', 'hogar', 'decoracion',
];

function coincideSub(sub, categoria) {
  const n = normalizar(categoria);
  if (!n) return false;
  if (n === normalizar(sub.nombre)) return true;
  return (sub.alias || []).some(a => normalizar(a) === n);
}

// ¿La categoría pertenece al grupo Consumo?
export function esCategoriaConsumo(categoria) {
  return CONSUMO_SUBS.some(s => coincideSub(s, categoria));
}

// Subcategorías de Consumo: fijas del esquema + las que el admin
// marque con grupo=consumo (sin duplicar)
export function subsConsumo(catList = []) {
  const extras = (catList || [])
    .filter(c => (c.grupo || '') === 'consumo' && !CONSUMO_SUBS.some(s => normalizar(s.nombre) === normalizar(c.nombre)))
    .map(c => ({ nombre: c.nombre, icono: c.icono || '📦', alias: [c.nombre] }));
  return [...CONSUMO_SUBS, ...extras];
}

// Subcategorías de Tiendas: fijas + grupo=tiendas del admin
export function subsTiendas(catList = []) {
  const extras = (catList || [])
    .filter(c => (c.grupo || '') === 'tiendas' && !TIENDAS_SUBS.some(s => normalizar(s.nombre) === normalizar(c.nombre)))
    .map(c => ({ nombre: c.nombre, icono: c.icono || '🛍️', alias: [c.nombre] }));
  return [...TIENDAS_SUBS, ...extras];
}

// ¿Coincide la categoría con alguna sub de la lista dada? → nombre o null
export function coincideSubLista(subs, categoria) {
  const found = (subs || []).find(s => coincideSub(s, categoria));
  return found ? found.nombre : null;
}

// ¿La categoría pertenece al grupo Tiendas?
export function esCategoriaTienda(categoria) {
  const n = normalizar(categoria);
  if (!n) return false;
  if (n.includes('tiend')) return true;
  if (TIENDAS_SUBS.some(s => coincideSub(s, categoria))) return true;
  return CATEGORIAS_TIENDA_EXTRA.includes(n);
}

export function esComercioTienda(comercio) {
  return esCategoriaTienda(comercio?.categoria);
}

// Subcategoría Consumo exacta de un comercio (o null)
export function subConsumoDe(categoria) {
  const found = CONSUMO_SUBS.find(s => coincideSub(s, categoria));
  return found ? found.nombre : null;
}

// Subcategoría Tienda exacta de un comercio ('Otros' si es tienda sin match)
export function subTiendaDe(categoria) {
  if (!esCategoriaTienda(categoria)) return null;
  const found = TIENDAS_SUBS.find(s => s.nombre !== 'Otros' && coincideSub(s, categoria));
  return found ? found.nombre : 'Otros';
}

export { CATEGORIAS_TIENDA_EXTRA };
