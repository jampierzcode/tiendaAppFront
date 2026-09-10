import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { obtenerTienda, type Tienda } from "./api";

export interface LineaCarrito {
  variationId: number;
  productSlug: string;
  productName: string;
  variationLabel: string;
  imageUrl: string | null;
  price: number;
  stock: number;
  quantity: number;
}

interface StoreContextType {
  slug: string;
  tienda: Tienda | null;
  cargando: boolean;
  error: string | null;
  carrito: LineaCarrito[];
  totalItems: number;
  subtotal: number;
  envio: number;
  total: number;
  agregar: (linea: Omit<LineaCarrito, "quantity">, cantidad?: number) => void;
  cambiarCantidad: (variationId: number, cantidad: number) => void;
  quitar: (variationId: number) => void;
  vaciar: () => void;
  precio: (valor: number) => string;
}

const StoreContext = createContext<StoreContextType | null>(null);

/** El carrito se guarda por tienda: dos tiendas abiertas no se pisan. */
const claveCarrito = (slug: string) => `carrito:${slug}`;

function leerCarrito(slug: string): LineaCarrito[] {
  try {
    const crudo = localStorage.getItem(claveCarrito(slug));
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    // Ventana privada o almacenamiento bloqueado: se empieza vacío.
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { slug = "" } = useParams();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<LineaCarrito[]>(() => leerCarrito(slug));

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    obtenerTienda(slug)
      .then((data) => {
        if (vigente) setTienda(data);
      })
      .catch(() => {
        if (vigente) setError("No encontramos esta tienda.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [slug]);

  useEffect(() => {
    setCarrito(leerCarrito(slug));
  }, [slug]);

  useEffect(() => {
    try {
      localStorage.setItem(claveCarrito(slug), JSON.stringify(carrito));
    } catch {
      // Si no se puede guardar, el carrito sigue vivo en memoria.
    }
  }, [slug, carrito]);

  /** Los colores de la tienda entran como variables CSS: cada negocio pinta
   *  su propia tienda sin que haya que recompilar nada. */
  useEffect(() => {
    if (!tienda) return;
    const raiz = document.documentElement;
    raiz.style.setProperty("--tienda-primario", tienda.primaryColor);
    raiz.style.setProperty("--tienda-secundario", tienda.secondaryColor);
    document.title = tienda.name;
  }, [tienda]);

  const agregar = useCallback(
    (linea: Omit<LineaCarrito, "quantity">, cantidad = 1) => {
      setCarrito((actual) => {
        const existente = actual.find((l) => l.variationId === linea.variationId);
        if (existente) {
          // Nunca por encima del stock: el backend lo rechazaría igual, pero
          // es mejor que el cliente no llegue a intentarlo.
          const nueva = Math.min(existente.quantity + cantidad, linea.stock);
          return actual.map((l) =>
            l.variationId === linea.variationId ? { ...l, quantity: nueva } : l
          );
        }
        return [...actual, { ...linea, quantity: Math.min(cantidad, linea.stock) }];
      });
    },
    []
  );

  const cambiarCantidad = useCallback((variationId: number, cantidad: number) => {
    setCarrito((actual) =>
      actual
        .map((l) =>
          l.variationId === variationId
            ? { ...l, quantity: Math.max(0, Math.min(cantidad, l.stock)) }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const quitar = useCallback((variationId: number) => {
    setCarrito((actual) => actual.filter((l) => l.variationId !== variationId));
  }, []);

  const vaciar = useCallback(() => setCarrito([]), []);

  const { totalItems, subtotal, envio, total } = useMemo(() => {
    const items = carrito.reduce((t, l) => t + l.quantity, 0);
    const sub = carrito.reduce((t, l) => t + l.price * l.quantity, 0);

    let costoEnvio = tienda?.shippingCost ?? 0;
    if (
      tienda?.freeShippingFrom !== null &&
      tienda?.freeShippingFrom !== undefined &&
      sub >= tienda.freeShippingFrom
    ) {
      costoEnvio = 0;
    }
    if (sub === 0) costoEnvio = 0;

    return {
      totalItems: items,
      subtotal: sub,
      envio: costoEnvio,
      total: sub + costoEnvio,
    };
  }, [carrito, tienda]);

  const precio = useCallback(
    (valor: number) => `${tienda?.currencySymbol ?? "S/"} ${Number(valor).toFixed(2)}`,
    [tienda]
  );

  return (
    <StoreContext.Provider
      value={{
        slug,
        tienda,
        cargando,
        error,
        carrito,
        totalItems,
        subtotal,
        envio,
        total,
        agregar,
        cambiarCantidad,
        quitar,
        vaciar,
        precio,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de StoreProvider");
  return ctx;
}
