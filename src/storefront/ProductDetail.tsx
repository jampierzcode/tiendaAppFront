import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { obtenerProducto, type ProductoDetalle, type Variacion } from "./api";
import { useStore } from "./StoreContext";

/**
 * ¿El color es claro? Sirve para decidir de qué color va el check sobre la
 * muestra: uno blanco sobre un beige no se ve, y uno negro sobre el negro
 * tampoco.
 */
function esClaro(hex: string) {
  const limpio = hex.replace("#", "");
  const n =
    limpio.length === 3
      ? limpio.split("").map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16));

  if (n.some((c) => Number.isNaN(c))) return true;

  // Luminancia percibida: el ojo pesa mucho más el verde que el azul.
  return (0.299 * n[0] + 0.587 * n[1] + 0.114 * n[2]) / 255 > 0.6;
}

export default function ProductDetail() {
  const { slug, productSlug = "" } = useParams();
  const { agregar, precio, tienda } = useStore();
  const { abrirCarrito } = useOutletContext<{ abrirCarrito: () => void }>();

  const [producto, setProducto] = useState<ProductoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<Record<string, number>>({});
  const [agregado, setAgregado] = useState(false);
  const [indice, setIndice] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origen, setOrigen] = useState({ x: 50, y: 50 });

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setSeleccion({});
    setIndice(0);
    setZoom(false);

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

  /**
   * Foto que se muestra arriba. Manda la de la variación elegida; si todavía
   * falta elegir algo, vale la primera que encaje con lo ya marcado — al tocar
   * "beige" la foto cambia sin esperar a que elijan la talla. Si nada de eso
   * tiene foto propia, se queda la del producto.
   */
  const imagenActual = useMemo(() => {
    if (!producto) return null;
    if (variacion?.imageUrl) return variacion.imageUrl;

    const elegidos = Object.values(seleccion);
    if (elegidos.length) {
      const parcial = producto.variations.find(
        (v) => v.imageUrl && elegidos.every((id) => v.attributes.some((a) => a.valueId === id))
      );
      if (parcial?.imageUrl) return parcial.imageUrl;
    }

    return producto.imageUrl;
  }, [producto, variacion, seleccion]);

  /**
   * Las fotos que se pueden ver: la del producto primero y luego una por cada
   * variación que tenga la suya. Sin repetir, porque la S, la M y la L de un
   * mismo color comparten foto y no tiene sentido mostrarla tres veces.
   */
  const galeria = useMemo(() => {
    if (!producto) return [] as { url: string; etiqueta: string }[];

    const vistas = new Map<string, { url: string; etiqueta: string }>();

    if (producto.imageUrl) {
      vistas.set(producto.imageUrl, { url: producto.imageUrl, etiqueta: producto.name });
    }

    for (const v of producto.variations) {
      if (v.imageUrl && !vistas.has(v.imageUrl)) {
        vistas.set(v.imageUrl, { url: v.imageUrl, etiqueta: v.label || producto.name });
      }
    }

    return [...vistas.values()];
  }, [producto]);

  // Elegir talla o color mueve el carrusel a la foto que toca; tocar una
  // miniatura lo mueve a mano. No se pisan: esto solo corre cuando cambia lo
  // que dicta la selección.
  useEffect(() => {
    if (!imagenActual) return;
    const i = galeria.findIndex((g) => g.url === imagenActual);
    if (i >= 0) setIndice(i);
  }, [imagenActual, galeria]);

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
      imageUrl: variacion.imageUrl ?? producto.imageUrl,
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
  const foto = galeria[indice] ?? galeria[0] ?? null;

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
        <div>
          <div
            className={`relative overflow-hidden rounded-xl bg-neutral-100 ${
              foto ? (zoom ? "cursor-zoom-out" : "cursor-zoom-in") : ""
            }`}
            onMouseMove={(e) => {
              if (!zoom) return;
              const r = e.currentTarget.getBoundingClientRect();
              setOrigen({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              });
            }}
            onMouseLeave={() => setZoom(false)}
            onClick={() => foto && setZoom((z) => !z)}
          >
            {foto ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={foto.url}
                  src={foto.url}
                  alt={foto.etiqueta}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="aspect-[3/4] w-full object-cover transition-transform duration-300"
                  style={{
                    transform: zoom ? "scale(2)" : "scale(1)",
                    transformOrigin: `${origen.x}% ${origen.y}%`,
                  }}
                />
              </AnimatePresence>
            ) : (
              <div className="grid aspect-[3/4] place-items-center text-sm text-neutral-400">
                Sin foto
              </div>
            )}

            {galeria.length > 1 && !zoom && (
              <>
                <FlechaGaleria
                  hacia="anterior"
                  onClick={() => setIndice((i) => (i - 1 + galeria.length) % galeria.length)}
                />
                <FlechaGaleria
                  hacia="siguiente"
                  onClick={() => setIndice((i) => (i + 1) % galeria.length)}
                />
              </>
            )}

            {foto && !zoom && (
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
                Toca para ampliar
              </span>
            )}
          </div>

          {/* Cuadraditos para saltar entre fotos */}
          {galeria.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {galeria.map((g, i) => (
                <button
                  key={g.url}
                  onClick={() => {
                    setIndice(i);
                    setZoom(false);
                  }}
                  title={g.etiqueta}
                  aria-label={g.etiqueta}
                  aria-current={i === indice}
                  className={`h-16 w-16 overflow-hidden rounded-lg transition ${
                    i === indice
                      ? "ring-2 ring-neutral-900 ring-offset-2"
                      : "opacity-60 ring-1 ring-black/10 hover:opacity-100"
                  }`}
                >
                  <img src={g.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
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
                      /* El anillo solo no basta: sobre una muestra negra, un
                         anillo negro no se ve. El elegido crece y lleva un
                         check, que se lee sobre cualquier color. */
                      className={`relative grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-25 ${
                        elegido
                          ? "scale-110 ring-2 ring-neutral-900 ring-offset-2"
                          : "ring-1 ring-black/15 hover:ring-2 hover:ring-neutral-400"
                      }`}
                      style={{ backgroundColor: v.hexColor }}
                    >
                      {elegido && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={esClaro(v.hexColor) ? "#111827" : "#ffffff"}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                    </button>
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

function FlechaGaleria({
  hacia,
  onClick,
}: {
  hacia: "anterior" | "siguiente";
  onClick: () => void;
}) {
  const anterior = hacia === "anterior";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={anterior ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-neutral-800 shadow transition hover:bg-white ${
        anterior ? "left-2" : "right-2"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={anterior ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
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
