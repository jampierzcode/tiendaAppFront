import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { obtenerFacetas, type Facetas } from "./api";
import CartDrawer from "./components/CartDrawer";
import { esClaro } from "./color";
import { useStore } from "./StoreContext";

type CategoriaMenu = Facetas["categories"][number];

/** Enlace del catálogo ya filtrado. La búsqueda vive en la URL: se puede compartir. */
const enlaceCategoria = (slug: string, categoria: string, subcategoria?: string) => {
  const q = new URLSearchParams({ category: categoria });
  if (subcategoria) q.set("subcategory", subcategoria);
  return `/t/${slug}?${q.toString()}`;
};

export default function StoreLayout() {
  const { tienda, cargando, error, totalItems, slug } = useStore();
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaMenu[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [texto, setTexto] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  useEffect(() => {
    obtenerFacetas(slug)
      .then((f) => setCategorias(f.categories))
      .catch(() => undefined);
  }, [slug]);

  // El cuadro de búsqueda refleja lo que hay en la URL (y se vacía al salir).
  useEffect(() => {
    setTexto(location.pathname === `/t/${slug}` ? params.get("search") ?? "" : "");
  }, [location.pathname, params, slug]);

  // Al navegar se cierran los menús.
  useEffect(() => {
    setMenuAbierto(false);
    setDrawerAbierto(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuAbierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setMenuAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuAbierto]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const q = texto.trim();
    navigate({ pathname: `/t/${slug}`, search: q ? `?search=${encodeURIComponent(q)}` : "" });
  };

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

  // El encabezado se pinta con el color principal de la tienda; el texto
  // cambia solo entre blanco y oscuro para que se lea con cualquier color.
  const claro = esClaro(tienda.primaryColor);
  const texto1 = claro ? "#111827" : "#ffffff";
  const sobreMenu = claro ? "rgba(17,24,39,.75)" : "rgba(255,255,255,.82)";
  const borde = claro ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.14)";
  const destacadas = [...categorias].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-30 shadow-sm" style={{ backgroundColor: "var(--tienda-primario, #111827)", color: texto1 }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {/* Móvil: abre las categorías */}
          <button
            onClick={() => setDrawerAbierto(true)}
            className="-ml-1 rounded-full p-2 lg:hidden"
            aria-label="Abrir categorías"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to={`/t/${slug}`} className="flex min-w-0 shrink-0 items-center gap-2.5">
            {tienda.logoUrl ? (
              <img src={tienda.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
              >
                {tienda.name.charAt(0)}
              </span>
            )}
            <span className="hidden truncate text-base font-semibold sm:block">{tienda.name}</span>
          </Link>

          {/* Buscador: es lo primero que usa quien viene con un código en la mano */}
          <form onSubmit={buscar} role="search" className="relative hidden min-w-0 flex-1 md:block lg:mx-6 lg:max-w-3xl">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Busca por nombre, código o vehículo…"
              aria-label="Buscar en la tienda"
              className="w-full rounded-lg border-0 bg-white py-2.5 pl-4 pr-12 text-sm text-neutral-900 outline-none ring-2 ring-transparent focus:ring-[var(--tienda-secundario,#F59E0B)]"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-1 top-1 grid h-8 w-10 place-items-center rounded-md text-white"
              style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              onClick={() => setCarritoAbierto(true)}
              className="relative rounded-full p-2 hover:bg-white/10"
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
        </div>

        {/* Móvil: el buscador baja a su propia fila, a todo el ancho */}
        <form onSubmit={buscar} role="search" className="px-4 pb-3 md:hidden">
          <div className="relative">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Busca por nombre, código o vehículo…"
              aria-label="Buscar en la tienda"
              className="w-full rounded-lg bg-white py-2.5 pl-4 pr-12 text-sm text-neutral-900 outline-none"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-1 top-1 grid h-8 w-10 place-items-center rounded-md text-white"
              style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </div>
        </form>

        {/* Escritorio: barra de categorías */}
        <nav className="relative hidden border-t lg:block" style={{ borderColor: borde }} aria-label="Categorías">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 text-sm">
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              className="flex items-center gap-2 py-2.5 pr-4 font-semibold"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Categorías
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`transition ${menuAbierto ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {destacadas.map((c) => (
              <Link
                key={c.id}
                to={enlaceCategoria(slug, c.slug)}
                className="rounded px-3 py-2.5 hover:text-[var(--tienda-secundario,#F59E0B)]"
                style={{ color: sobreMenu }}
              >
                {c.name}
              </Link>
            ))}
          </div>

          <AnimatePresence>
            {menuAbierto && categorias.length > 0 && (
              <>
                <div className="fixed inset-0 top-0 -z-10" onClick={() => setMenuAbierto(false)} aria-hidden />
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-x-0 top-full border-t bg-white text-neutral-900 shadow-xl"
                >
                  <div className="mx-auto grid max-w-7xl grid-cols-4 gap-x-8 gap-y-6 px-4 py-6">
                    {categorias.map((c) => (
                      <div key={c.id}>
                        <Link
                          to={enlaceCategoria(slug, c.slug)}
                          className="text-sm font-semibold hover:text-[var(--tienda-secundario,#F59E0B)]"
                        >
                          {c.name}
                          <span className="ml-1.5 text-xs font-normal text-neutral-400">{c.count}</span>
                        </Link>
                        <ul className="mt-1.5 space-y-1">
                          {c.subcategories.slice(0, 7).map((s) => (
                            <li key={s.id}>
                              <Link
                                to={enlaceCategoria(slug, c.slug, s.slug)}
                                className="text-sm text-neutral-600 hover:text-[var(--tienda-secundario,#F59E0B)]"
                              >
                                {s.name}
                              </Link>
                            </li>
                          ))}
                          {c.subcategories.length > 7 && (
                            <li>
                              <Link
                                to={enlaceCategoria(slug, c.slug)}
                                className="text-xs font-medium text-[var(--tienda-secundario,#F59E0B)]"
                              >
                                Ver las {c.subcategories.length} →
                              </Link>
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </nav>
      </header>

      {/* Móvil: panel lateral de categorías */}
      <AnimatePresence>
        {drawerAbierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setDrawerAbierto(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[88vw] flex-col bg-white"
              aria-label="Categorías"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold">Categorías</span>
                <button onClick={() => setDrawerAbierto(false)} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="Cerrar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <Link to={`/t/${slug}`} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-neutral-50">
                  Todos los productos
                </Link>
                {categorias.map((c) => (
                  <details key={c.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-neutral-50">
                      {c.name}
                      <svg className="transition group-open:rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="mb-1 ml-3 border-l pl-3">
                      <Link to={enlaceCategoria(slug, c.slug)} className="block py-2 text-sm font-medium text-[var(--tienda-secundario,#F59E0B)]">
                        Ver todo en {c.name}
                      </Link>
                      {c.subcategories.map((s) => (
                        <Link key={s.id} to={enlaceCategoria(slug, c.slug, s.slug)} className="block py-2 text-sm text-neutral-600">
                          {s.name} <span className="text-neutral-400">({s.count})</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main>
        <Outlet context={{ abrirCarrito: () => setCarritoAbierto(true) }} />
      </main>

      <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-600">
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
