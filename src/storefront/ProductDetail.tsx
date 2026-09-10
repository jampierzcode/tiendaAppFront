import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { obtenerProducto, type ProductoDetalle, type Variacion } from "./api";
import { useStore } from "./StoreContext";

export default function ProductDetail() {
  const { slug, productSlug = "" } = useParams();
  const { agregar, precio, tienda } = useStore();
  const { abrirCarrito } = useOutletContext<{ abrirCarrito: () => void }>();

  const [producto, setProducto] = useState<ProductoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<Record<string, number>>({});
  const [agregado, setAgregado] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setSeleccion({});

    obtenerProducto(slug!, productSlug)
      .then((d) => vigente && setProducto(d))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [slug, productSlug]);

  /** Atributos del producto agrupados: Talla → [S, M, L], Color → [...] */
  const atributos = useMemo(() => {
    if (!producto) return [];
    const mapa = new Map<
      string,
      { nombre: string; valores: Map<number, { value: string; hexColor: string | null }> }
    >();

    for (const v of producto.variations) {
      for (const a of v.attributes) {
        if (!a.attributeName) continue;
        const grupo = mapa.get(a.attributeName) ?? { nombre: a.attributeName, valores: new Map() };
        grupo.valores.set(a.valueId, { value: a.value, hexColor: a.hexColor });
        mapa.set(a.attributeName, grupo);
      }
    }

    return [...mapa.values()].map((g) => ({
      nombre: g.nombre,
      valores: [...g.valores.entries()].map(([id, v]) => ({ id, ...v })),
    }));
  }, [producto]);

  /** La variación que corresponde a lo elegido, si ya está todo elegido. */
  const variacion: Variacion | null = useMemo(() => {
    if (!producto) return null;

    const unica = producto.variations.find((v) => v.isDefault);
    if (unica && producto.variations.length === 1) return unica;

    const elegidos = Object.values(seleccion);
    if (elegidos.length !== atributos.length) return null;

    return (
      producto.variations.find((v) =>
        elegidos.every((valorId) => v.attributes.some((a) => a.valueId === valorId))
      ) ?? null
    );
  }, [producto, seleccion, atributos]);

  /** ¿Existe alguna variación con stock que use este valor? */
  const valorDisponible = (nombreAtributo: string, valorId: number) => {
    if (!producto) return false;
    const otros = Object.entries(seleccion).filter(([k]) => k !== nombreAtributo);

    return producto.variations.some((v) => {
      if (!v.disponible) return false;
      if (!v.attributes.some((a) => a.valueId === valorId)) return false;
      return otros.every(([, id]) => v.attributes.some((a) => a.valueId === id));
    });
  };

  const alAgregar = () => {
    if (!producto || !variacion) return;

    agregar({
      variationId: variacion.id,
      productSlug: producto.slug,
      productName: producto.name,
      variationLabel: variacion.label,
      imageUrl: producto.imageUrl,
      price: variacion.price,
      stock: variacion.stock,
    });

    setAgregado(true);
    setTimeout(() => setAgregado(false), 1600);
  };

  if (cargando) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200" />
          <div className="space-y-3">
            <div className="h-7 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-5 w-1/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-20 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="text-sm text-neutral-600">No encontramos este producto.</p>
        <Link to={`/t/${slug}`} className="mt-3 inline-block text-sm underline">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  const faltaElegir = atributos.length > 0 && !variacion;
  const sinStock = variacion !== null && !variacion.disponible;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-8">
      <Link
        to={`/t/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Seguir viendo
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl bg-neutral-100">
          {producto.imageUrl ? (
            <motion.img
              layoutId={`producto-${producto.id}`}
              src={producto.imageUrl}
              alt={producto.name}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="grid aspect-[3/4] place-items-center text-sm text-neutral-400">
              Sin foto
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-1.5">
            {producto.tags.map((t) => (
              <span
                key={t.slug}
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: t.color ?? "#334155" }}
              >
                {t.name}
              </span>
            ))}
          </div>

          <h1 className="mt-2 text-2xl font-bold leading-tight" style={{ textWrap: "balance" }}>
            {producto.name}
          </h1>

          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">
              {precio(variacion?.price ?? producto.price)}
            </span>
            {(variacion?.originalPrice ?? producto.originalPrice) && (
              <>
                <span className="text-sm text-neutral-400 line-through">
                  {precio(variacion?.originalPrice ?? producto.originalPrice!)}
                </span>
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                  −{producto.discount}%
                </span>
              </>
            )}
          </div>

          {producto.description && (
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">{producto.description}</p>
          )}

          {/* Selector de talla y color */}
          {atributos.map((atributo) => (
            <fieldset key={atributo.nombre} className="mt-5">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">
                {atributo.nombre}
                {seleccion[atributo.nombre] && (
                  <span className="ml-1.5 font-normal normal-case text-neutral-500">
                    {atributo.valores.find((v) => v.id === seleccion[atributo.nombre])?.value}
                  </span>
                )}
              </legend>

              <div className="flex flex-wrap gap-2">
                {atributo.valores.map((v) => {
                  const elegido = seleccion[atributo.nombre] === v.id;
                  const disponible = valorDisponible(atributo.nombre, v.id);

                  return v.hexColor ? (
                    <button
                      key={v.id}
                      onClick={() => setSeleccion({ ...seleccion, [atributo.nombre]: v.id })}
                      disabled={!disponible}
                      title={disponible ? v.value : `${v.value} — agotado`}
                      aria-label={v.value}
                      aria-pressed={elegido}
                      className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition disabled:opacity-25 ${
                        elegido ? "ring-neutral-900" : "ring-transparent"
                      }`}
                      style={{ backgroundColor: v.hexColor, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}
                    />
                  ) : (
                    <button
                      key={v.id}
                      onClick={() => setSeleccion({ ...seleccion, [atributo.nombre]: v.id })}
                      disabled={!disponible}
                      aria-pressed={elegido}
                      className={`min-w-11 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:text-neutral-300 disabled:line-through ${
                        elegido
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      {v.value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {variacion && variacion.stock > 0 && variacion.stock <= 5 && (
            <p className="mt-4 text-sm font-medium text-amber-700">
              ¡Quedan solo {variacion.stock}!
            </p>
          )}

          {/* Botón de compra: en escritorio va aquí, en móvil en la barra fija */}
          <div className="mt-6 hidden md:block">
            <BotonComprar
              faltaElegir={faltaElegir}
              sinStock={sinStock}
              agregado={agregado}
              aceptaPedidos={tienda?.aceptaPedidos ?? false}
              onAgregar={alAgregar}
              onVerCarrito={abrirCarrito}
            />
          </div>
        </div>
      </div>

      {/* En móvil el botón vive fijo abajo: es donde llega el pulgar. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <BotonComprar
          faltaElegir={faltaElegir}
          sinStock={sinStock}
          agregado={agregado}
          aceptaPedidos={tienda?.aceptaPedidos ?? false}
          onAgregar={alAgregar}
          onVerCarrito={abrirCarrito}
        />
      </div>
    </div>
  );
}

function BotonComprar({
  faltaElegir,
  sinStock,
  agregado,
  aceptaPedidos,
  onAgregar,
  onVerCarrito,
}: {
  faltaElegir: boolean;
  sinStock: boolean;
  agregado: boolean;
  aceptaPedidos: boolean;
  onAgregar: () => void;
  onVerCarrito: () => void;
}) {
  if (!aceptaPedidos) {
    return (
      <div className="rounded-lg bg-neutral-100 py-3 text-center text-sm text-neutral-600">
        Esta tienda no está recibiendo pedidos ahora
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <motion.button
        onClick={onAgregar}
        disabled={faltaElegir || sinStock}
        whileTap={{ scale: 0.97 }}
        className="relative flex-1 overflow-hidden rounded-lg py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
        style={{ backgroundColor: faltaElegir || sinStock ? undefined : "var(--tienda-primario, #111827)" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={agregado ? "ok" : sinStock ? "sin" : faltaElegir ? "elige" : "agregar"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="block"
          >
            {agregado
              ? "✓ Agregado"
              : sinStock
                ? "Agotado"
                : faltaElegir
                  ? "Elige talla y color"
                  : "Agregar al pedido"}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <button
        onClick={onVerCarrito}
        className="rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:border-neutral-500"
      >
        Ver pedido
      </button>
    </div>
  );
}
