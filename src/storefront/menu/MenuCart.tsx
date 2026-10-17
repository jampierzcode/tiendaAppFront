import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cotizacion } from "../api";
import { useCotizacion } from "../useCotizacion";

export interface OpcionElegida {
  optionId: number;
  groupName: string;
  name: string;
  priceDelta: number;
  quantity: number;
}

export interface LineaMenu {
  /** Identifica la línea: dos hamburguesas con distinta carne son líneas distintas. */
  key: string;
  productId: number;
  name: string;
  imageUrl: string | null;
  /** Precio del plato sin modificadores. */
  basePrice: number;
  options: OpcionElegida[];
  note: string;
  quantity: number;
}

export const precioUnitario = (l: LineaMenu) =>
  l.basePrice + l.options.reduce((t, o) => t + o.priceDelta * o.quantity, 0);

interface Ctx {
  lineas: LineaMenu[];
  totalItems: number;
  /** A precio de lista con extras; las promociones van aparte en `descuento`. */
  subtotal: number;
  descuento: number;
  cupon: string;
  cuponEstado: Cotizacion["cupon"];
  aplicarCupon: (codigo: string) => void;
  quitarCupon: () => void;
  agregar: (linea: Omit<LineaMenu, "key">) => void;
  cambiarCantidad: (key: string, cantidad: number) => void;
  quitar: (key: string) => void;
  vaciar: () => void;
}

const MenuCartContext = createContext<Ctx | null>(null);

const clave = (slug: string) => `menu-carrito:${slug}`;

function leer(slug: string): LineaMenu[] {
  try {
    const crudo = localStorage.getItem(clave(slug));
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

/** Misma línea = mismo plato, mismas opciones y misma nota. */
const firma = (l: Omit<LineaMenu, "key" | "quantity">) =>
  JSON.stringify([
    l.productId,
    l.note.trim(),
    [...l.options].sort((a, b) => a.optionId - b.optionId).map((o) => [o.optionId, o.quantity]),
  ]);

export function MenuCartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaMenu[]>(() => leer(slug));
  const [cupon, setCupon] = useState("");

  useEffect(() => setLineas(leer(slug)), [slug]);

  useEffect(() => {
    try {
      localStorage.setItem(clave(slug), JSON.stringify(lineas));
    } catch {
      // Sin almacenamiento el carrito vive solo en memoria.
    }
  }, [slug, lineas]);

  const agregar = useCallback((linea: Omit<LineaMenu, "key">) => {
    setLineas((actual) => {
      const k = firma(linea);
      const existente = actual.find((l) => l.key === k);
      if (existente) {
        return actual.map((l) =>
          l.key === k ? { ...l, quantity: Math.min(99, l.quantity + linea.quantity) } : l
        );
      }
      return [...actual, { ...linea, key: k }];
    });
  }, []);

  const cambiarCantidad = useCallback((key: string, cantidad: number) => {
    setLineas((actual) =>
      actual
        .map((l) => (l.key === key ? { ...l, quantity: Math.min(99, Math.max(0, cantidad)) } : l))
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const quitar = useCallback(
    (key: string) => setLineas((actual) => actual.filter((l) => l.key !== key)),
    []
  );
  const vaciar = useCallback(() => setLineas([]), []);

  // El servidor dice cuánto ahorra el carrito. Los extras (modificadores) se
  // cobran completos: la promoción actúa sobre el plato.
  const cotizacion = useCotizacion(
    slug,
    lineas.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      extras: l.options.reduce((t, o) => t + o.priceDelta * o.quantity, 0),
    })),
    cupon
  );

  const valor = useMemo<Ctx>(() => {
    const local = lineas.reduce((t, l) => t + precioUnitario(l) * l.quantity, 0);
    return {
      lineas,
      totalItems: lineas.reduce((t, l) => t + l.quantity, 0),
      subtotal: cotizacion ? cotizacion.subtotal : local,
      descuento: cotizacion ? cotizacion.descuento : 0,
      cupon,
      cuponEstado: cotizacion?.cupon ?? null,
      aplicarCupon: setCupon,
      quitarCupon: () => setCupon(""),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
    };
  }, [lineas, cotizacion, cupon, agregar, cambiarCantidad, quitar, vaciar]);

  return <MenuCartContext.Provider value={valor}>{children}</MenuCartContext.Provider>;
}

export function useMenuCart() {
  const ctx = useContext(MenuCartContext);
  if (!ctx) throw new Error("useMenuCart debe usarse dentro de MenuCartProvider");
  return ctx;
}
