import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  obtenerCategorias,
  obtenerFiltros,
  obtenerProductos,
  type Categoria,
  type FiltroAtributo,
  type ProductoResumen,
} from "./api";
import ProductCard from "./components/ProductCard";
import { useStore } from "./StoreContext";

export default function StoreHome() {
  const { slug, tienda } = useStore();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtros, setFiltros] = useState<FiltroAtributo[]>([]);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);

  const [categoria, setCategoria] = useState<string | null>(null);
  const [valores, setValores] = useState<number[]>([]);
  const [orden, setOrden] = useState("recientes");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  useEffect(() => {
    obtenerCategorias(slug).then(setCategorias).catch(() => undefined);
    obtenerFiltros(slug).then(setFiltros).catch(() => undefined);
  }, [slug]);

  // La búsqueda espera a que el cliente deje de escribir: una petición por
  // tecla satura el servidor y hace parpadear la grilla.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);

    obtenerProductos(slug, {
      category: categoria ?? undefined,
      attributeValues: valores.length ? valores.join(",") : undefined,
      search: busquedaAplicada || undefined,
      sort: orden,
      perPage: 24,
    })
      .then((r) => {
        if (!vigente) return;
        setProductos(r.data);
        setTotal(r.meta.total);
      })
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [slug, categoria, valores, orden, busquedaAplicada]);

  const alternarValor = (id: number) =>
    setValores((actual) =>
      actual.includes(id) ? actual.filter((v) => v !== id) : [...actual, id]
    );

  const hayFiltros = categoria !== null || valores.length > 0 || busquedaAplicada !== "";

  const claveGrilla = useMemo(
    () => `${categoria}-${valores.join(",")}-${orden}-${busquedaAplicada}`,
    [categoria, valores, orden, busquedaAplicada]
  );

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden border-b border-neutral-200">
        {tienda?.bannerUrl && (
          <img src={tienda.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="relative"
          style={{
            background: tienda?.bannerUrl
              ? "linear-gradient(to right, rgba(0,0,0,.72), rgba(0,0,0,.35))"
              : "var(--tienda-primario, #111827)",
          }}
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
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
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="mt-2 max-w-xl text-sm text-white/80 sm:text-base"
              >
                {tienda.description}
              </motion.p>
            )}
            {tienda?.freeShippingFrom != null && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
              >
                Envío gratis desde {tienda.currencySymbol} {tienda.freeShippingFrom.toFixed(2)}
              </motion.p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Buscador y orden */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <input
              id="buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en la tienda…"
              className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-neutral-900"
            />
            <svg
              className="absolute left-3 top-2.5 text-neutral-400"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
          </div>

          <select
            id="orden"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            aria-label="Ordenar"
          >
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="nombre">Nombre</option>
          </select>
        </div>

        {/* Categorías */}
        {categorias.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Chip activo={categoria === null} onClick={() => setCategoria(null)}>
              Todos
            </Chip>
            {categorias.map((c) => (
              <Chip
                key={c.id}
                activo={categoria === c.slug}
                onClick={() => setCategoria(categoria === c.slug ? null : c.slug)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        )}

        {/* Filtros de talla y color */}
        {filtros.map((atributo) => (
          <div key={atributo.id} className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {atributo.name}
            </span>
            {atributo.values.map((v) =>
              atributo.type === "color" && v.hexColor ? (
                <button
                  key={v.id}
                  onClick={() => alternarValor(v.id)}
                  title={v.value}
                  aria-label={v.value}
                  aria-pressed={valores.includes(v.id)}
                  className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${
                    valores.includes(v.id) ? "ring-neutral-900" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: v.hexColor, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)" }}
                />
              ) : (
                <Chip key={v.id} activo={valores.includes(v.id)} onClick={() => alternarValor(v.id)}>
                  {v.value}
                </Chip>
              )
            )}
          </div>
        ))}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {cargando ? "Buscando…" : `${total} ${total === 1 ? "producto" : "productos"}`}
          </p>
          {hayFiltros && (
            <button
              onClick={() => {
                setCategoria(null);
                setValores([]);
                setBusqueda("");
              }}
              className="text-sm text-neutral-600 underline hover:text-neutral-900"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Grilla */}
        {productos.length === 0 && !cargando ? (
          <p className="py-16 text-center text-sm text-neutral-500">
            No encontramos productos con esos filtros.
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={claveGrilla}
              className="mt-4 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4"
            >
              {productos.map((p, i) => (
                <ProductCard key={p.id} producto={p} slugTienda={slug} indice={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
        activo
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
      }`}
    >
      {children}
    </button>
  );
}
