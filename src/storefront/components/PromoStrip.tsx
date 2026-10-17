import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerPromociones, type PromoPublica } from "../api";
import { useStore } from "../StoreContext";

/**
 * Las ofertas automáticas vigentes de la tienda, en una tira que se desliza.
 * Los cupones no aparecen: son códigos que reparte el negocio.
 */
export default function PromoStrip({ enlaces = true }: { enlaces?: boolean }) {
  const { slug } = useStore();
  const [promos, setPromos] = useState<PromoPublica[]>([]);

  useEffect(() => {
    obtenerPromociones(slug)
      .then(setPromos)
      .catch(() => setPromos([]));
  }, [slug]);

  if (!promos.length) return null;

  return (
    <section aria-label="Promociones" className="border-b border-neutral-200 bg-white">
      <ul className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-3">
        {promos.map((p) => {
          const destino = p.product
            ? `/t/${slug}/p/${p.product.slug}`
            : p.category
              ? `/t/${slug}?category=${p.category.slug}`
              : `/t/${slug}`;
          const clase = "flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1.5 text-xs";
          const Envoltorio = ({ children }: { children: React.ReactNode }) =>
            enlaces ? (
              <Link to={destino} className={`${clase} hover:border-neutral-400`}>
                {children}
              </Link>
            ) : (
              <div className={clase}>{children}</div>
            );
          return (
            <li key={p.id} className="shrink-0">
              <Envoltorio>
                <span
                  className="rounded-full px-2 py-0.5 font-semibold text-white"
                  style={{ backgroundColor: "var(--tienda-secundario, #F59E0B)" }}
                >
                  {p.label}
                </span>
                <span className="font-medium text-neutral-800">{p.name}</span>
                {p.alcance && <span className="text-neutral-500">· {p.alcance}</span>}
                {p.dias && <span className="text-neutral-500">· solo {p.dias}</span>}
                {p.endDate && (
                  <span className="text-neutral-400">
                    hasta{" "}
                    {new Date(p.endDate + "T00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </Envoltorio>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
