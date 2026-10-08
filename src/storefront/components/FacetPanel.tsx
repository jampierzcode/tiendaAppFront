import { useState } from "react";
import type { Facetas } from "../api";

export interface SeleccionFiltros {
  category: string | null;
  subcategory: string | null;
  tag: string | null;
  valores: number[];
}

interface Props {
  facetas: Facetas | null;
  seleccion: SeleccionFiltros;
  onCategoria: (categoria: string | null, subcategoria?: string | null) => void;
  onEtiqueta: (slug: string | null) => void;
  onValor: (id: number) => void;
}

/**
 * Columna de filtros del catálogo: categorías (con subcategorías de la que
 * está abierta), atributos (marca, medida, color…) y etiquetas (vehículos).
 * Cada opción muestra cuántos productos hay detrás, y las que quedarían en
 * cero ni aparecen: hacer clic nunca lleva a una pantalla vacía.
 */
export default function FacetPanel({ facetas, seleccion, onCategoria, onEtiqueta, onValor }: Props) {
  if (!facetas) {
    return (
      <div className="space-y-6" aria-busy>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-36 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    );
  }

  const abierta = facetas.categories.find((c) => c.slug === seleccion.category) ?? null;

  return (
    <div className="space-y-6 text-sm">
      <Seccion titulo="Categorías">
        <ul className="space-y-0.5">
          {(seleccion.category || seleccion.subcategory) && (
            <li>
              <button
                onClick={() => onCategoria(null)}
                className="mb-1 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
              >
                ‹ Todas las categorías
              </button>
            </li>
          )}

          {/* Con una categoría abierta solo se ve ella y sus subcategorías,
              como en cualquier tienda grande: se va afinando, no se pierde. */}
          {(abierta ? [abierta] : facetas.categories).map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onCategoria(c.slug)}
                aria-current={abierta && !seleccion.subcategory ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-neutral-100 ${
                  abierta ? "font-semibold text-neutral-900" : "text-neutral-700"
                }`}
              >
                <span>{c.name}</span>
                <Cuenta n={c.count} />
              </button>

              {abierta && (
                <ul className="ml-2.5 mt-0.5 space-y-0.5 border-l border-neutral-200 pl-2">
                  {c.subcategories.map((s) => {
                    const activa = seleccion.subcategory === s.slug;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => onCategoria(c.slug, activa ? null : s.slug)}
                          aria-current={activa ? "true" : undefined}
                          className={`flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-neutral-100 ${
                            activa ? "font-semibold" : "text-neutral-700"
                          }`}
                          style={activa ? { color: "var(--tienda-secundario, #F59E0B)" } : undefined}
                        >
                          <span>{s.name}</span>
                          <Cuenta n={s.count} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Seccion>

      {[...facetas.attributes]
        .filter((a) => a.values.length > 0)
        // Lo que más se usa para buscar un repuesto va primero.
        .sort((a, b) => prioridad(a.name) - prioridad(b.name))
        .map((atributo) => (
          <Seccion key={atributo.id} titulo={atributo.name}>
            {atributo.type === "color" ? (
              <div className="flex flex-wrap gap-2">
                {atributo.values.map((v) => {
                  const activo = seleccion.valores.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      onClick={() => onValor(v.id)}
                      title={`${v.value} (${v.count})`}
                      aria-label={`${v.value}, ${v.count} productos`}
                      aria-pressed={activo}
                      className="h-7 w-7 rounded-full ring-2 ring-offset-2 transition"
                      style={{
                        backgroundColor: v.hexColor ?? "#ccc",
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)",
                        ["--tw-ring-color" as string]: activo ? "var(--tienda-secundario, #F59E0B)" : "transparent",
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <ListaOpciones
                opciones={atributo.values.map((v) => ({
                  clave: String(v.id),
                  etiqueta: v.value,
                  count: v.count,
                  activa: seleccion.valores.includes(v.id),
                  alternar: () => onValor(v.id),
                }))}
              />
            )}
          </Seccion>
        ))}

      {facetas.tags.length > 0 && (
        <Seccion titulo="Vehículo y marca">
          <ListaOpciones
            opciones={facetas.tags.map((t) => ({
              clave: t.slug,
              etiqueta: t.name,
              count: t.count,
              activa: seleccion.tag === t.slug,
              alternar: () => onEtiqueta(seleccion.tag === t.slug ? null : t.slug),
            }))}
          />
        </Seccion>
      )}
    </div>
  );
}

const PRIORIDAD = ["marca", "medida", "color"];
const prioridad = (nombre: string) => {
  const i = PRIORIDAD.indexOf(nombre.trim().toLowerCase());
  return i === -1 ? PRIORIDAD.length : i;
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-200 pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900">{titulo}</h3>
      {children}
    </section>
  );
}

function Cuenta({ n }: { n: number }) {
  return <span className="shrink-0 text-xs text-neutral-400">{n}</span>;
}

interface Opcion {
  clave: string;
  etiqueta: string;
  count: number;
  activa: boolean;
  alternar: () => void;
}

/** Casillas con «Ver más»: una lista de 40 marcas no puede comerse la columna. */
function ListaOpciones({ opciones }: { opciones: Opcion[] }) {
  const [verTodo, setVerTodo] = useState(false);
  const LIMITE = 7;
  // Las elegidas siempre se ven, aunque caigan fuera del recorte.
  const visibles = verTodo
    ? opciones
    : opciones.filter((o, i) => i < LIMITE || o.activa);

  return (
    <>
      <ul className="space-y-0.5">
        {visibles.map((o) => (
          <li key={o.clave}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-neutral-100">
              <input
                type="checkbox"
                checked={o.activa}
                onChange={o.alternar}
                className="h-4 w-4 shrink-0 rounded"
                style={{ accentColor: "var(--tienda-secundario, #F59E0B)" }}
              />
              <span className={`min-w-0 flex-1 truncate ${o.activa ? "font-semibold" : "text-neutral-700"}`}>
                {o.etiqueta}
              </span>
              <Cuenta n={o.count} />
            </label>
          </li>
        ))}
      </ul>
      {opciones.length > LIMITE && (
        <button
          onClick={() => setVerTodo((v) => !v)}
          className="mt-1 px-1.5 text-xs font-medium hover:underline"
          style={{ color: "var(--tienda-secundario, #F59E0B)" }}
        >
          {verTodo ? "Ver menos" : `Ver las ${opciones.length}`}
        </button>
      )}
    </>
  );
}
