import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const CLAVE = 'autonex.carrito';
const CarritoContext = createContext(null);

function leer() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(guardado) ? guardado.filter((i) => i?.publicacion_id && i.cantidad > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Carrito persistente en localStorage. Cada ítem es una publicación (producto + vendedor + condición).
 * Los precios guardados son solo para mostrar: el backend recalcula todo al comprar,
 * y `sincronizar()` los actualiza con los valores reales (precio, stock, estado).
 */
export function CarritoProvider({ children }) {
  const [items, setItems] = useState(leer);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
    } catch {
      /* sin localStorage */
    }
  }, [items]);

  // Mantiene el carrito igual en todas las pestañas abiertas.
  useEffect(() => {
    const alCambiar = (e) => {
      if (e.key === CLAVE) setItems(leer());
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  /** Agrega una oferta (publicación). Nunca supera el stock disponible. */
  const agregar = useCallback((oferta, producto, cantidad = 1) => {
    const existente = items.find((i) => i.publicacion_id === oferta.publicacion_id);
    const deseada = (existente?.cantidad || 0) + cantidad;
    const final = Math.min(deseada, oferta.stock);
    const nuevo = {
      publicacion_id: oferta.publicacion_id,
      cantidad: final,
      precio: oferta.precio,
      stock: oferta.stock,
      condicion: oferta.condicion,
      producto: {
        id: producto.id, nombre: producto.nombre, marca: producto.marca,
        numero_pieza: producto.numero_pieza, sku: producto.sku, imagen: producto.imagen,
      },
      vendedor: oferta.vendedor,
    };
    setItems((lista) => (existente
      ? lista.map((i) => (i.publicacion_id === oferta.publicacion_id ? { ...i, ...nuevo } : i))
      : [...lista, nuevo]));
    return { cantidad: final, limitado: final < deseada, yaEstabaAlMaximo: existente && existente.cantidad >= oferta.stock };
  }, [items]);

  const cambiarCantidad = useCallback((publicacionId, cantidad) => {
    setItems((lista) => lista.map((i) => (i.publicacion_id === publicacionId
      ? { ...i, cantidad: Math.max(1, Math.min(Math.floor(cantidad) || 1, i.stock)) }
      : i)));
  }, []);

  const quitar = useCallback((publicacionId) => {
    setItems((lista) => lista.filter((i) => i.publicacion_id !== publicacionId));
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  /** Trae precio, stock y estado reales. Devuelve mensajes para mostrarle al comprador. */
  const sincronizar = useCallback(async () => {
    const actuales = leer();
    if (!actuales.length) return [];
    const { items: validados } = await api('/carrito/validar', {
      method: 'POST',
      body: { items: actuales.map(({ publicacion_id, cantidad }) => ({ publicacion_id, cantidad })) },
    });
    const mensajes = [];
    const porId = new Map(validados.map((v) => [v.publicacion_id, v]));
    const nuevos = [];
    for (const item of actuales) {
      const v = porId.get(item.publicacion_id);
      const nombre = v?.producto?.nombre || item.producto.nombre;
      if (!v || v.estado === 'no_existe') {
        mensajes.push(`"${nombre}" ya no está publicado y se quitó del carrito.`);
        continue;
      }
      if (v.estado === 'pausada' || v.estado === 'sin_stock') {
        mensajes.push(`"${nombre}" de ${v.vendedor.nombre_comercial} ${v.estado === 'pausada' ? 'está pausado' : 'se quedó sin stock'} y se quitó del carrito.`);
        continue;
      }
      if (v.estado === 'ajustado') {
        mensajes.push(`De "${nombre}" quedan ${v.stock} unidades: ajustamos la cantidad.`);
      }
      if (v.precio !== item.precio) {
        mensajes.push(`El precio de "${nombre}" cambió.`);
      }
      nuevos.push({
        ...item, cantidad: v.cantidad, precio: v.precio, stock: v.stock, condicion: v.condicion,
        producto: v.producto, vendedor: v.vendedor,
      });
    }
    setItems(nuevos);
    return mensajes;
  }, []);

  const resumen = useMemo(() => {
    const grupos = new Map();
    for (const item of items) {
      const vid = item.vendedor.id;
      if (!grupos.has(vid)) grupos.set(vid, { vendedor: item.vendedor, items: [], subtotal: 0, unidades: 0 });
      const g = grupos.get(vid);
      g.items.push(item);
      g.subtotal += item.precio * item.cantidad;
      g.unidades += item.cantidad;
    }
    const lista = [...grupos.values()];
    return {
      grupos: lista,
      total: lista.reduce((s, g) => s + g.subtotal, 0),
      unidades: items.reduce((s, i) => s + i.cantidad, 0),
    };
  }, [items]);

  const valor = useMemo(() => ({
    items, ...resumen, agregar, cambiarCantidad, quitar, vaciar, sincronizar,
    cantidadDe: (publicacionId) => items.find((i) => i.publicacion_id === publicacionId)?.cantidad || 0,
  }), [items, resumen, agregar, cambiarCantidad, quitar, vaciar, sincronizar]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export const useCarrito = () => useContext(CarritoContext);
