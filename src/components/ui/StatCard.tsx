import type { ReactNode } from "react";
import { motion } from "motion/react";

interface Props {
  etiqueta: string;
  valor: string | number;
  icono?: ReactNode;
  detalle?: string;
  /** Tono del icono. El color nunca va solo: siempre hay etiqueta. */
  tono?: "brand" | "ok" | "warn" | "danger";
  indice?: number;
}

const tonos = {
  brand: "bg-brand-50 text-brand-600",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
};

export default function StatCard({
  etiqueta,
  valor,
  icono,
  detalle,
  tono = "brand",
  indice = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(indice * 0.05, 0.3) }}
      className="card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{etiqueta}</p>
        {icono && (
          <span className={`grid h-8 w-8 place-items-center rounded-lg text-base ${tonos[tono]}`}>
            {icono}
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-[26px] font-extrabold leading-none text-ink">
        {valor}
      </p>
      {detalle && <p className="mt-1.5 text-[12px] text-muted">{detalle}</p>}
    </motion.div>
  );
}
