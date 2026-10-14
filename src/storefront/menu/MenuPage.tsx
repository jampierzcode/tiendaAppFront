import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { obtenerMenu, type CartaMenu, type PlatoMenu } from "../api";
import { useStore } from "../StoreContext";
import ProductSheet from "./ProductSheet";

/**
 * La carta: categorías fijas arriba, platos en tarjetas con botón PEDIR.
 * Si el plato tiene modificadores se abre la hoja para elegirlos; si no, se
 * abre igual (para cantidad y nota) — un solo camino, sin atajos que
 * sorprendan.
 */
export default function MenuPage() {
  const { slug, precio } = useStore();
  const [carta, setCarta] = useState<CartaMenu | null>(null);
  const [error, setError] = useState(false);
  const [categoria, setCategoria] = useState<number | "todas">("todas");
  const [subcategoria, setSubcategoria] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState<PlatoMenu | null>(null);
  const secciones = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    obtenerMenu(slug)
      .then(setCarta)
      .catch(() => setError(true));
  }, [slug]);

  const grupos = useMemo(() => {
    if (!carta) return [];
    const q = texto.trim().toLowerCase();
    const coincide = (p: PlatoMenu) =>
      !q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);

    const lista = carta.categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        subs: c.subcategories,
        platos: carta.products.filter((p) => p.categoryIds.includes(c.id) && coincide(p)),
      }))
      .filter((g) => g.platos.length > 0);

    // Platos sin categoría: no se pierden, van al final.
    const sueltos = carta.products.filter((p) => p.categoryIds.length === 0 && coincide(p));
    if (sueltos.length) lista.push({ id: 0, name: "Otros", subs: [], platos: sueltos });

    return lista;
  }, [carta, texto]);

  /** Dentro de una categoría, los platos se agrupan por subcategoría. */
  const bloques = (g: (typeof grupos)[number]) => {
    const conSub = g.subs
      .map((s) => ({
        id: s.id,
        titulo: s.name as string | null,
        platos: g.platos.filter((p) => p.subcategoryIds.includes(s.id)),
      }))
      .filter((b) => b.platos.length > 0);
    const sueltos = g.platos.filter((p) => !p.subcategoryIds.some((id) => g.subs.some((s) => s.id === id)));
    if (subcategoria !== null) return conSub.filter((b) => b.id === subcategoria);
    return [
      ...conSub,
      ...(sueltos.length
        ? [{ id: 0, titulo: conSub.length ? "Otros" : null, platos: sueltos }]
        : []),
    ];
  };

  /** Elegir una categoría la filtra: solo se ven sus platos. */
  const irA = (id: number | "todas") => {
    setCategoria(id);
    setSubcategoria(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibles = categoria === "todas" ? grupos : grupos.filter((g) => g.id === categoria);
  const actual = categoria === "todas" ? null : grupos.find((g) => g.id === categoria) ?? null;

  if (error) {
    return <p className="p-8 text-center text-neutral-500">No pudimos cargar la carta.</p>;
  }

  if (!carta) {
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-200" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur">
        <div className="px-4 pt-3">
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar en la carta…"
            aria-label="Buscar en la carta"
            className="h-11 w-full rounded-full border border-neutral-200 bg-white px-5 text-sm outline-none focus:border-neutral-400"
          />
        </div>
        <nav className="scroll-fino flex gap-2 overflow-x-auto px-4 py-3" aria-label="Categorías">
          {[{ id: "todas" as const, name: "Todo" }, ...grupos].map((c) => {
            const activa = categoria === c.id;
            return (
              <button
                key={c.id}
                onClick={() => irA(c.id)}
                className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
                style={
                  activa
                    ? {
                        backgroundColor: "var(--tienda-primario)",
                        borderColor: "var(--tienda-primario)",
                        color: "#fff",
                      }
                    : { backgroundColor: "#fff", borderColor: "#e5e5e5", color: "#404040" }
                }
              >
                {c.name}
              </button>
            );
          })}
        </nav>
        {actual && actual.subs.length > 0 && (
          <nav className="scroll-fino flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Subcategorías">
            {[{ id: null as number | null, name: "Todas" }, ...actual.subs].map((sc) => {
              const on = subcategoria === sc.id;
              return (
                <button
                  key={sc.id ?? "todas"}
                  onClick={() => setSubcategoria(sc.id)}
                  className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={
                    on
                      ? { borderColor: "var(--tienda-primario)", color: "var(--tienda-primario)", backgroundColor: "#fff" }
                      : { backgroundColor: "#fff", borderColor: "#e5e5e5", color: "#525252" }
                  }
                >
                  {sc.name}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {grupos.length === 0 && (
        <p className="p-10 text-center text-neutral-500">
          {texto ? "No hay platos con ese nombre." : "La carta aún no tiene platos."}
        </p>
      )}

      {visibles.map((g) => (
        <section
          key={g.id}
          ref={(el) => {
            secciones.current[g.id] = el;
          }}
          className="px-4 pt-6"
        >
          <h2 className="text-lg font-extrabold text-neutral-900">{g.name}</h2>

          {bloques(g).map((b) => (
          <div key={b.id} className="mt-3">
            {b.titulo && (
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
                {b.titulo}
              </h3>
            )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {b.platos.map((p, i) => (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.2) }}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <button
                  onClick={() => setElegido(p)}
                  className="flex flex-1 flex-col text-left"
                  aria-label={`Ver ${p.name}`}
                >
                  <div className="relative aspect-[4/3] max-h-40 w-full shrink-0 overflow-hidden bg-neutral-100 sm:max-h-48 lg:max-h-56">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-3xl">🍽️</div>
                    )}
                    {p.originalPrice && (
                      <span
                        className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: "var(--tienda-secundario)" }}
                      >
                        Oferta
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-900">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{p.description}</p>
                    )}
                    <div className="mt-auto flex items-baseline gap-1.5 pt-2">
                      <span className="text-base font-extrabold text-neutral-900">
                        {precio(p.price)}
                      </span>
                      {p.originalPrice && (
                        <span className="text-xs text-neutral-400 line-through">
                          {precio(p.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setElegido(p)}
                  className="mx-3 mb-3 flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--tienda-primario)" }}
                >
                  <span aria-hidden className="text-lg leading-none">
                    +
                  </span>
                  PEDIR
                </button>
              </motion.article>
            ))}
          </div>
          </div>
          ))}
        </section>
      ))}

      <ProductSheet plato={elegido} onClose={() => setElegido(null)} />
    </>
  );
}
