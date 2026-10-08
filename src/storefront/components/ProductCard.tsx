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
 * Lleva lo que un comprador de repuestos necesita para distinguir un
 * producto de otro sin abrirlo: la categoría, el nombre completo, el código
 * (SKU) y las marcas o vehículos. La imagen lleva `layoutId`: al abrir la
 * ficha, esta misma imagen crece hasta su sitio en vez de haber un corte.
 */
export default function ProductCard({ producto, slugTienda, indice }: Props) {
  // Sin precio no se puede comprar: se consulta. Tampoco está «agotado»: el
  // stock todavía no se cargó.
  const consultar = producto.price <= 0;
  const agotado = !producto.disponible && !consultar;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        // Entrada escalonada, pero con tope: con 24 productos nadie espera 8s.
        delay: Math.min(indice * 0.03, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group"
    >
      <Link
        to={`/t/${slugTienda}/p/${producto.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-neutral-300 hover:shadow-md"
      >
        <div className="relative aspect-square overflow-hidden bg-neutral-50">
          {producto.imageUrl ? (
            <motion.img
              layoutId={`producto-${producto.id}`}
              src={producto.imageUrl}
              alt={producto.name}
              loading="lazy"
              className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-300">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="1.8" />
                <path d="m21 16-5-5-8 8" />
              </svg>
              <span className="text-xs">Sin foto</span>
            </div>
          )}

          {producto.discount > 0 && (
            <span
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
            >
              −{producto.discount}%
            </span>
          )}

          {agotado && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                Agotado
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          {producto.categoria && (
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {producto.categoria}
            </p>
          )}

          <h3 className="mt-0.5 line-clamp-3 text-sm font-medium leading-snug text-neutral-900">
            {producto.name}
          </h3>

          {producto.sku && (
            <p className="mt-1 truncate font-mono text-xs text-neutral-500">Cód. {producto.sku}</p>
          )}

          {producto.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {producto.tags.slice(0, 3).map((t) => (
                <span
                  key={t.slug}
                  className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}

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
                <span className="text-[11px] text-neutral-500">+{producto.colores.length - 5}</span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-baseline gap-2 pt-3">
            {consultar ? (
              <span className="text-sm font-semibold" style={{ color: "var(--tienda-secundario, #F59E0B)" }}>
                Consultar precio
              </span>
            ) : (
              <>
                <span className="text-lg font-bold text-neutral-900">
                  {producto.currencySymbol} {producto.price.toFixed(2)}
                </span>
                {producto.originalPrice && (
                  <span className="text-xs text-neutral-400 line-through">
                    {producto.currencySymbol} {producto.originalPrice.toFixed(2)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
