import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { esClaro } from "../color";
import { useStore } from "../StoreContext";
import CartSheet from "./CartSheet";
import { MenuCartProvider, useMenuCart } from "./MenuCart";

/** Mesa tomada del QR (?mesa=5). Se recuerda por pestaña: sobrevive a navegar. */
export function useMesa(slug: string) {
  const [params] = useSearchParams();
  const clave = `mesa:${slug}`;
  const desdeUrl = params.get("mesa");

  useEffect(() => {
    if (!desdeUrl) return;
    try {
      sessionStorage.setItem(clave, desdeUrl);
    } catch {
      // sin almacenamiento: vale solo mientras la URL la traiga
    }
  }, [desdeUrl, clave]);

  if (desdeUrl) return desdeUrl;
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function Contenido() {
  const { tienda, cargando, error, slug, precio } = useStore();
  const { totalItems, subtotal } = useMenuCart();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  const mesa = useMesa(slug);

  useEffect(() => setAbierto(false), [pathname]);

  if (cargando) {
    return (
      <div className="mx-auto max-w-2xl p-5">
        <div className="h-40 animate-pulse rounded-3xl bg-neutral-200" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !tienda) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-bold text-neutral-900">{error ?? "Carta no disponible"}</p>
          <p className="mt-1 text-sm text-neutral-500">Revisa el enlace o el código QR.</p>
        </div>
      </div>
    );
  }

  const textoSobrePrimario = esClaro(tienda.primaryColor) ? "#111827" : "#ffffff";
  const enSeguimiento = pathname.includes("/pedido/");

  return (
    <div className="min-h-screen bg-neutral-50 pb-28">
      <header
        className="relative overflow-hidden"
        style={{ backgroundColor: tienda.primaryColor, color: textoSobrePrimario }}
      >
        {tienda.bannerUrl && (
          <img
            src={tienda.bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        )}
        <div className="relative mx-auto flex max-w-2xl items-center gap-4 px-5 py-6">
          {tienda.logoUrl ? (
            <img
              src={tienda.logoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl bg-white object-cover shadow-lg"
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-black">
              {tienda.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black leading-tight">{tienda.name}</h1>
            <p className="mt-0.5 line-clamp-2 text-sm opacity-85">
              {tienda.schedule || tienda.description || "Haz tu pedido desde aquí"}
            </p>
            {mesa && (
              <span className="mt-2 inline-block rounded-full bg-white/90 px-3 py-0.5 text-xs font-bold text-neutral-900">
                Mesa {mesa}
              </span>
            )}
          </div>
        </div>
      </header>

      {!tienda.aceptaPedidos && (
        <p className="bg-amber-50 px-5 py-2 text-center text-sm font-medium text-amber-800">
          Por ahora no estamos recibiendo pedidos en línea.
        </p>
      )}

      <main className="mx-auto max-w-2xl">
        <Outlet />
      </main>

      <AnimatePresence>
        {totalItems > 0 && !enSeguimiento && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 p-4"
          >
            <button
              onClick={() => setAbierto(true)}
              className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between rounded-full px-6 text-sm font-bold shadow-xl"
              style={{ backgroundColor: tienda.secondaryColor, color: esClaro(tienda.secondaryColor) ? "#111827" : "#fff" }}
            >
              <span className="flex items-center gap-2">
                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-black/15 px-2 tabular-nums">
                  {totalItems}
                </span>
                Ver mi pedido
              </span>
              <span className="tabular-nums">{precio(subtotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <CartSheet abierto={abierto} onClose={() => setAbierto(false)} mesa={mesa} />
    </div>
  );
}

export default function MenuLayout() {
  const { slug } = useStore();
  return (
    <MenuCartProvider slug={slug}>
      <Contenido />
    </MenuCartProvider>
  );
}
