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
        platos: carta.products.filter((p) => p.categoryIds.includes(c.id) && coincide(p)),
      }))
      .filter((g) => g.platos.length > 0);

    // Platos sin categoría: no se pierden, van al final.
    const sueltos = carta.products.filter((p) => p.categoryIds.length === 0 && coincide(p));
    if (sueltos.length) lista.push({ id: 0, name: "Otros", platos: sueltos });

    return lista;
  }, [carta, texto]);

  const irA = (id: number | "todas") => {
    setCategoria(id);
    if (id === "todas") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = secciones.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

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
      </div>

      {grupos.length === 0 && (
        <p className="p-10 text-center text-neutral-500">
          {texto ? "No hay platos con ese nombre." : "La carta aún no tiene platos."}
        </p>
      )}

      {grupos.map((g) => (
        <section
          key={g.id}
          ref={(el) => {
            secciones.current[g.id] = el;
          }}
          className="px-4 pt-6"
        >
          <h2 className="text-lg font-extrabold text-neutral-900">{g.name}</h2>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {g.platos.map((p, i) => (
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
                  <div className="relative aspect-[4/3] bg-neutral-100">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
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
        </section>
      ))}

      <ProductSheet plato={elegido} onClose={() => setElegido(null)} />
    </>
  );
}
