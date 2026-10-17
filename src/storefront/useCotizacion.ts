import { useEffect, useState } from "react";
import { cotizarCarrito, type Cotizacion } from "./api";

type Item = { variationId?: number; productId?: number; quantity: number; extras?: number };

/**
 * Pide al servidor cuánto ahorra el carrito (promociones y cupón) cada vez que
 * cambia. Si falla, el carrito sigue funcionando con sus precios: es ayuda,
 * no un requisito para pedir.
 */
export function useCotizacion(slug: string, items: Item[], cupon: string) {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const firma = JSON.stringify([items, cupon]);

  useEffect(() => {
    if (!slug || items.length === 0) {
      setCotizacion(null);
      return;
    }
    let vigente = true;
    const t = setTimeout(() => {
      cotizarCarrito(slug, items, cupon || undefined)
        .then((c) => vigente && setCotizacion(c))
        .catch(() => vigente && setCotizacion(null));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, firma]);

  return cotizacion;
}
