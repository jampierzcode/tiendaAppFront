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
import { obtenerTienda, type Cotizacion, type Tienda } from "./api";
import { useCotizacion } from "./useCotizacion";

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
  /** A precio de lista; las promociones se restan aparte en `descuento`. */
  subtotal: number;
  descuento: number;
  /** Código de cupón que el cliente escribió (aunque aún no sea válido). */
  cupon: string;
  cuponEstado: Cotizacion["cupon"];
  aplicarCupon: (codigo: string) => void;
  quitarCupon: () => void;
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
  const [cupon, setCupon] = useState("");

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
    // La pestaña lleva el logo de la tienda: el cliente la reconoce como «su» app.
    if (tienda.logoUrl) {
      let enlace = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!enlace) {
        enlace = document.createElement("link");
        enlace.rel = "icon";
        document.head.appendChild(enlace);
      }
      enlace.href = tienda.logoUrl;
    }
    try {
      localStorage.setItem("cliente:ultima-tienda", tienda.slug);
    } catch {
      // sin almacenamiento
    }
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

  // El servidor dice cuánto ahorra el carrito (promociones y cupón).
  const cotizacion = useCotizacion(
    slug,
    carrito.map((l) => ({ variationId: l.variationId, quantity: l.quantity })),
    cupon
  );

  const { totalItems, subtotal, descuento, envio, total } = useMemo(() => {
    const items = carrito.reduce((t, l) => t + l.quantity, 0);
    const local = carrito.reduce((t, l) => t + l.price * l.quantity, 0);
    // Con cotización, el subtotal es a precio de lista y el descuento va aparte;
    // sin ella, los precios del carrito ya traen las promociones por producto.
    const sub = cotizacion ? cotizacion.subtotal : local;
    const desc = cotizacion ? cotizacion.descuento : 0;
    const neto = sub - desc;

    let costoEnvio = tienda?.shippingCost ?? 0;
    if (
      tienda?.freeShippingFrom !== null &&
      tienda?.freeShippingFrom !== undefined &&
      neto >= tienda.freeShippingFrom
    ) {
      costoEnvio = 0;
    }
    if (sub === 0) costoEnvio = 0;

    return {
      totalItems: items,
      subtotal: sub,
      descuento: desc,
      envio: costoEnvio,
      total: neto + costoEnvio,
    };
  }, [carrito, tienda, cotizacion]);

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
        descuento,
        cupon,
        cuponEstado: cotizacion?.cupon ?? null,
        aplicarCupon: setCupon,
        quitarCupon: () => setCupon(""),
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
