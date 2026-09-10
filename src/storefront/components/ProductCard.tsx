import { motion } from "motion/react";
import { Link } from "react-router-dom";
import type { ProductoResumen } from "../api";

interface Props {
  producto: ProductoResumen;
  slugTienda: string;
  indice: number;
}

/**
 * Tarjeta del catálogo.
 *
 * La imagen lleva `layoutId`: al abrir la ficha, esta misma imagen crece hasta
 * su sitio en la página de detalle en vez de haber un corte. Es la animación
 * que más hace sentir la tienda como una app y no como una web.
 */
export default function ProductCard({ producto, slugTienda, indice }: Props) {
  const agotado = !producto.disponible;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        // Entrada escalonada, pero con tope: con 40 productos nadie espera 8s.
        delay: Math.min(indice * 0.04, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group"
    >
      <Link to={`/t/${slugTienda}/p/${producto.slug}`} className="block">
        <div className="relative overflow-hidden rounded-xl bg-neutral-100 aspect-[3/4]">
          {producto.imageUrl ? (
            <motion.img
              layoutId={`producto-${producto.id}`}
              src={producto.imageUrl}
              alt={producto.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-400 text-sm">
              Sin foto
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {producto.discount > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                −{producto.discount}%
              </span>
            )}
            {producto.tags.slice(0, 2).map((t) => (
              <span
                key={t.slug}
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: t.color ?? "#334155" }}
              >
                {t.name}
              </span>
            ))}
          </div>

          {agotado && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                Agotado
              </span>
            </div>
          )}
        </div>

        <div className="mt-2.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900">
            {producto.name}
          </h3>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-semibold text-neutral-900">
              {producto.currencySymbol} {producto.price.toFixed(2)}
            </span>
            {producto.originalPrice && (
              <span className="text-xs text-neutral-400 line-through">
                {producto.currencySymbol} {producto.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {producto.colores.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              {producto.colores.slice(0, 5).map((c) => (
                <span
                  key={c.value}
                  title={c.value}
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: c.hexColor ?? "#ccc" }}
                />
              ))}
              {producto.colores.length > 5 && (
                <span className="text-[11px] text-neutral-500">
                  +{producto.colores.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.article>
  );
}
