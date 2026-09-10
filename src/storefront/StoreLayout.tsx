import { motion } from "motion/react";
import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import CartDrawer from "./components/CartDrawer";
import { useStore } from "./StoreContext";

export default function StoreLayout() {
  const { tienda, cargando, error, totalItems, slug } = useStore();
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  if (cargando) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-8 w-44 animate-pulse rounded bg-neutral-200" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !tienda) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Tienda no disponible</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Puede que el enlace esté mal escrito o que la tienda no esté publicada.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to={`/t/${slug}`} className="flex min-w-0 items-center gap-2.5">
            {tienda.logoUrl ? (
              <img src={tienda.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: "var(--tienda-primario, #111827)" }}
              >
                {tienda.name.charAt(0)}
              </span>
            )}
            <span className="truncate text-base font-semibold">{tienda.name}</span>
          </Link>

          <button
            onClick={() => setCarritoAbierto(true)}
            className="relative rounded-full p-2 text-neutral-700 hover:bg-neutral-100"
            aria-label={`Ver carrito, ${totalItems} artículos`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
            </svg>
            {totalItems > 0 && (
              <motion.span
                key={totalItems}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white"
                style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
              >
                {totalItems}
              </motion.span>
            )}
          </button>
        </div>
      </header>

      <main>
        <Outlet context={{ abrirCarrito: () => setCarritoAbierto(true) }} />
      </main>

      <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-600">
          <p className="font-semibold text-neutral-900">{tienda.name}</p>
          {tienda.description && <p className="mt-1 max-w-prose">{tienda.description}</p>}

          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            {tienda.address && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Dirección</dt>
                <dd>{[tienda.address, tienda.city].filter(Boolean).join(", ")}</dd>
              </div>
            )}
            {tienda.schedule && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Horario</dt>
                <dd>{tienda.schedule}</dd>
              </div>
            )}
            {tienda.instagram && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Instagram</dt>
                <dd>
                  <a
                    className="underline"
                    href={`https://instagram.com/${tienda.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{tienda.instagram}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </footer>

      <CartDrawer abierto={carritoAbierto} onCerrar={() => setCarritoAbierto(false)} />
    </div>
  );
}
