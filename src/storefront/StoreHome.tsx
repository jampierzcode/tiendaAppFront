import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  obtenerFacetas,
  obtenerProductos,
  type Facetas,
  type ProductoResumen,
} from "./api";
import FacetPanel, { type SeleccionFiltros } from "./components/FacetPanel";
import ProductCard from "./components/ProductCard";
import PromoStrip from "./components/PromoStrip";
import { useStore } from "./StoreContext";

const POR_PAGINA = 24;

/**
 * Catálogo de la tienda.
 *
 * Todo lo que el cliente elige (categoría, marca, búsqueda, orden, página)
 * vive en la URL: se puede compartir por WhatsApp, funciona el botón «atrás»
 * y recargar no pierde nada. El estado no se duplica en el componente.
 */
export default function StoreHome() {
  const { slug, tienda } = useStore();
  const [params, setParams] = useSearchParams();

  const seleccion: SeleccionFiltros = useMemo(
    () => ({
      category: params.get("category"),
      subcategory: params.get("subcategory"),
      tag: params.get("tag"),
      valores: (params.get("attributeValues") ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    }),
    [params]
  );
  const search = params.get("search") ?? "";
  const orden = params.get("sort") ?? "recientes";
  const pagina = Math.max(1, Number(params.get("page") ?? 1));

  const [facetas, setFacetas] = useState<Facetas | null>(null);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  /** Cambia la URL: lo que se pasa en `cambios` reemplaza, `null` quita. */
  const actualizar = useCallback(
    (cambios: Record<string, string | null>, conservarPagina = false) => {
      setParams(
        (previos) => {
          const nuevos = new URLSearchParams(previos);
          for (const [k, v] of Object.entries(cambios)) {
            if (v === null || v === "") nuevos.delete(k);
            else nuevos.set(k, v);
          }
          if (!conservarPagina) nuevos.delete("page");
          return nuevos;
        },
        { replace: false }
      );
    },
    [setParams]
  );

  const filtrosApi = useMemo(
    () => ({
      category: seleccion.category ?? undefined,
      subcategory: seleccion.subcategory ?? undefined,
      tag: seleccion.tag ?? undefined,
      attributeValues: seleccion.valores.length ? seleccion.valores.join(",") : undefined,
      search: search || undefined,
    }),
    [seleccion, search]
  );
  const claveFiltros = JSON.stringify(filtrosApi);

  useEffect(() => {
    let vigente = true;
    obtenerFacetas(slug, filtrosApi)
      .then((f) => vigente && setFacetas(f))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, claveFiltros]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);

    obtenerProductos(slug, { ...filtrosApi, sort: orden, page: pagina, perPage: POR_PAGINA })
      .then((r) => {
        if (!vigente) return;
        setProductos(r.data);
        setTotal(r.meta.total);
        setUltimaPagina(r.meta.lastPage);
      })
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, claveFiltros, orden, pagina]);

  // --- acciones del panel de filtros ---
  const elegirCategoria = (categoria: string | null, subcategoria: string | null = null) =>
    actualizar({ category: categoria, subcategory: subcategoria });

  const alternarValor = (id: number) => {
    const actuales = seleccion.valores;
    const nuevos = actuales.includes(id) ? actuales.filter((v) => v !== id) : [...actuales, id];
    actualizar({ attributeValues: nuevos.length ? nuevos.join(",") : null });
  };

  const limpiarTodo = () => setParams(new URLSearchParams());

  // --- textos: título, migas y filtros activos ---
  const categoriaActual = facetas?.categories.find((c) => c.slug === seleccion.category);
  const subActual = categoriaActual?.subcategories.find((s) => s.slug === seleccion.subcategory);
  const nombreValor = (id: number) =>
    facetas?.attributes.flatMap((a) => a.values).find((v) => v.id === id)?.value ?? "…";
  const nombreEtiqueta = (s: string) => facetas?.tags.find((t) => t.slug === s)?.name ?? s;

  const hayFiltros =
    !!seleccion.category || !!seleccion.tag || seleccion.valores.length > 0 || search !== "";

  const titulo = subActual?.name
    ? subActual.name
    : categoriaActual?.name
      ? categoriaActual.name
      : search
        ? `Resultados para “${search}”`
        : "Todos los productos";

  const chips: { clave: string; texto: string; quitar: () => void }[] = [
    ...(search
      ? [{ clave: "q", texto: `“${search}”`, quitar: () => actualizar({ search: null }) }]
      : []),
    ...(seleccion.category
      ? [{ clave: "c", texto: categoriaActual?.name ?? seleccion.category, quitar: () => elegirCategoria(null) }]
      : []),
    ...(seleccion.subcategory
      ? [
          {
            clave: "s",
            texto: subActual?.name ?? seleccion.subcategory,
            quitar: () => elegirCategoria(seleccion.category),
          },
        ]
      : []),
    ...(seleccion.tag
      ? [{ clave: "t", texto: nombreEtiqueta(seleccion.tag), quitar: () => actualizar({ tag: null }) }]
      : []),
    ...seleccion.valores.map((id) => ({
      clave: `v${id}`,
      texto: nombreValor(id),
      quitar: () => alternarValor(id),
    })),
  ];

  const irAPagina = (n: number) => {
    actualizar({ page: n > 1 ? String(n) : null }, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const panel = (
    <FacetPanel
      facetas={facetas}
      seleccion={seleccion}
      onCategoria={elegirCategoria}
      onEtiqueta={(s) => actualizar({ tag: s })}
      onValor={alternarValor}
    />
  );

  return (
    <>
      {/* Portada: solo en la entrada. Con una búsqueda en curso estorba. */}
      {!hayFiltros && pagina === 1 && (
        <section className="relative overflow-hidden border-b border-neutral-200">
          {tienda?.bannerUrl && (
            <img src={tienda.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div
            className="relative"
            style={{
              background: tienda?.bannerUrl
                ? "linear-gradient(to right, rgba(0,0,0,.72), rgba(0,0,0,.3))"
                : "var(--tienda-primario, #111827)",
            }}
          >
            <div className="mx-auto max-w-7xl px-4 py-9 sm:py-12">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl"
                style={{ textWrap: "balance" }}
              >
                {tienda?.name}
              </motion.h1>
              {tienda?.description && (
                <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">{tienda.description}</p>
              )}
              {tienda?.freeShippingFrom != null && (
                <p
                  className="mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
                >
                  Envío gratis desde {tienda.currencySymbol} {tienda.freeShippingFrom.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <PromoStrip />

      <div className="mx-auto max-w-7xl px-4 py-5">
        {/* Migas: dónde está parado y cómo volver un nivel */}
        <nav aria-label="Ruta" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <Link to={`/t/${slug}`} className="hover:text-neutral-900 hover:underline">
            Inicio
          </Link>
          {categoriaActual && (
            <>
              <span aria-hidden>›</span>
              {subActual ? (
                <button onClick={() => elegirCategoria(categoriaActual.slug)} className="hover:text-neutral-900 hover:underline">
                  {categoriaActual.name}
                </button>
              ) : (
                <span className="text-neutral-900">{categoriaActual.name}</span>
              )}
            </>
          )}
          {subActual && (
            <>
              <span aria-hidden>›</span>
              <span className="text-neutral-900">{subActual.name}</span>
            </>
          )}
          {!categoriaActual && search && (
            <>
              <span aria-hidden>›</span>
              <span className="text-neutral-900">Búsqueda</span>
            </>
          )}
        </nav>

        <div className="lg:grid lg:grid-cols-6 lg:gap-10">
          {/* Izquierda (2/6): filtros. En móvil pasan a un panel desplegable. */}
          <aside className="hidden lg:col-span-2 lg:block">
            <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-3">{panel}</div>
          </aside>

          {/* Derecha (4/6): resultados */}
          <section className="lg:col-span-4" aria-live="polite">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold leading-tight sm:text-2xl" style={{ textWrap: "balance" }}>
                  {titulo}
                </h1>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {cargando && productos.length === 0
                    ? "Buscando…"
                    : `${total} ${total === 1 ? "resultado" : "resultados"}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltrosAbiertos(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium lg:hidden"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5h18M6 12h12M10 19h4" />
                  </svg>
                  Filtros{chips.length > 0 ? ` (${chips.length})` : ""}
                </button>

                <label className="flex items-center gap-2 text-sm text-neutral-500">
                  <span className="hidden sm:inline">Ordenar por</span>
                  <select
                    value={orden}
                    onChange={(e) => actualizar({ sort: e.target.value === "recientes" ? null : e.target.value })}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
                  >
                    <option value="recientes">Más recientes</option>
                    <option value="precio-asc">Precio: menor a mayor</option>
                    <option value="precio-desc">Precio: mayor a menor</option>
                    <option value="nombre">Nombre</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Filtros activos: se quitan uno a uno o todos juntos */}
            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <button
                    key={c.clave}
                    onClick={c.quitar}
                    className="group flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-3 pr-2 text-sm text-neutral-800 hover:bg-neutral-200"
                    aria-label={`Quitar filtro ${c.texto}`}
                  >
                    {c.texto}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                ))}
                <button
                  onClick={limpiarTodo}
                  className="text-sm font-medium hover:underline"
                  style={{ color: "var(--tienda-secundario, #F59E0B)" }}
                >
                  Limpiar todo
                </button>
              </div>
            )}

            {/* Grilla */}
            {productos.length === 0 && !cargando ? (
              <div className="py-16 text-center">
                <p className="font-medium">No encontramos productos con esos filtros.</p>
                <p className="mt-1 text-sm text-neutral-500">
                  Prueba con otra palabra, el código del repuesto o quita algún filtro.
                </p>
                {hayFiltros && (
                  <button
                    onClick={limpiarTodo}
                    className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
                  >
                    Ver todo el catálogo
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`${claveFiltros}-${orden}-${pagina}`}
                  className={`mt-5 grid grid-cols-2 gap-x-3 gap-y-6 transition-opacity sm:gap-x-4 md:grid-cols-3 ${
                    cargando ? "opacity-60" : ""
                  }`}
                >
                  {productos.map((p, i) => (
                    <ProductCard key={p.id} producto={p} slugTienda={slug} indice={i} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {ultimaPagina > 1 && (
              <nav aria-label="Páginas" className="mt-10 flex items-center justify-center gap-3 text-sm">
                <button
                  onClick={() => irAPagina(pagina - 1)}
                  disabled={pagina <= 1}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹ Anterior
                </button>
                <span className="text-neutral-600">
                  Página {pagina} de {ultimaPagina}
                </span>
                <button
                  onClick={() => irAPagina(pagina + 1)}
                  disabled={pagina >= ultimaPagina}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente ›
                </button>
              </nav>
            )}
          </section>
        </div>
      </div>

      {/* Móvil: filtros en una hoja que sube desde abajo */}
      <AnimatePresence>
        {filtrosAbiertos && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setFiltrosAbiertos(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.24 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl bg-white lg:hidden"
              role="dialog"
              aria-label="Filtros"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold">Filtros</span>
                <button onClick={() => setFiltrosAbiertos(false)} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="Cerrar filtros">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">{panel}</div>
              <div className="flex gap-2 border-t p-3">
                {hayFiltros && (
                  <button onClick={limpiarTodo} className="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium">
                    Limpiar
                  </button>
                )}
                <button
                  onClick={() => setFiltrosAbiertos(false)}
                  className="flex-1 rounded-lg py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
                >
                  Ver {total} {total === 1 ? "resultado" : "resultados"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
