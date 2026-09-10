import { useMemo, useState } from "react";

export interface PuntoSerie {
  periodo: string;
  neto: number;
  margen: number;
  pedidos: number;
}

interface Props {
  serie: PuntoSerie[];
  simbolo: string;
  granularidad: "day" | "week" | "month";
}

const ALTO = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

const formatoFecha = (iso: string, g: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (g === "month") return d.toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};

/**
 * Ventas netas en el tiempo.
 *
 * Una sola serie, así que no lleva leyenda: el título ya dice qué es. El eje
 * arranca en cero a propósito — recortarlo exagera las subidas y es la forma
 * más común de que un gráfico de ventas mienta.
 */
export default function SalesChart({ serie, simbolo, granularidad }: Props) {
  const [activo, setActivo] = useState<number | null>(null);
  const [ancho, setAncho] = useState(720);

  const { puntos, maximo, ticks } = useMemo(() => {
    const max = Math.max(...serie.map((p) => p.neto), 0);
    // Techo redondeado hacia arriba para que las marcas del eje caigan en
    // números legibles y no en 3.847,32.
    const magnitud = Math.pow(10, Math.floor(Math.log10(max || 1)));
    const techo = max === 0 ? 100 : Math.ceil(max / magnitud) * magnitud;

    const anchoUtil = ancho - PAD.left - PAD.right;
    const altoUtil = ALTO - PAD.top - PAD.bottom;

    const pts = serie.map((p, i) => ({
      ...p,
      x:
        serie.length === 1
          ? PAD.left + anchoUtil / 2
          : PAD.left + (i / (serie.length - 1)) * anchoUtil,
      y: PAD.top + altoUtil - (p.neto / techo) * altoUtil,
    }));

    return {
      puntos: pts,
      maximo: techo,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => ({
        valor: techo * f,
        y: PAD.top + altoUtil - f * altoUtil,
      })),
    };
  }, [serie, ancho]);

  if (!serie.length) {
    return (
      <div className="grid h-[220px] place-items-center text-[13px] text-muted">
        No hubo ventas en este periodo.
      </div>
    );
  }

  const linea = puntos.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${PAD.left},${ALTO - PAD.bottom} ${linea} ${
    puntos[puntos.length - 1].x
  },${ALTO - PAD.bottom}`;

  return (
    <div
      className="relative w-full"
      ref={(el) => {
        if (el && el.clientWidth && Math.abs(el.clientWidth - ancho) > 8) {
          setAncho(el.clientWidth);
        }
      }}
    >
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        width="100%"
        height={ALTO}
        role="img"
        aria-label={`Ventas netas por ${granularidad === "day" ? "día" : granularidad === "week" ? "semana" : "mes"}`}
        onMouseLeave={() => setActivo(null)}
      >
        <defs>
          <linearGradient id="degradadoVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Rejilla discreta: está para leer, no para mirarse */}
        {ticks.map((t) => (
          <g key={t.y}>
            <line
              x1={PAD.left}
              x2={ancho - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={t.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--color-muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.valor >= 1000 ? `${Math.round(t.valor / 1000)}k` : Math.round(t.valor)}
            </text>
          </g>
        ))}

        {puntos.length > 1 && (
          <>
            <polygon points={area} fill="url(#degradadoVentas)" />
            <polyline
              points={linea}
              fill="none"
              stroke="var(--color-brand-500)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {puntos.map((p, i) => (
          <g key={p.periodo}>
            {/* Zona de captura más ancha que el punto: acertar un círculo de
                4px con el ratón es una pelea que nadie quiere. */}
            <rect
              x={p.x - (ancho - PAD.left - PAD.right) / (puntos.length * 2) - 6}
              y={PAD.top}
              width={(ancho - PAD.left - PAD.right) / puntos.length + 12}
              height={ALTO - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setActivo(i)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={activo === i ? 5 : puntos.length === 1 ? 5 : 3.5}
              fill="var(--color-brand-500)"
              stroke="#fff"
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={ALTO - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-muted)"
            >
              {formatoFecha(p.periodo, granularidad)}
            </text>
          </g>
        ))}
      </svg>

      {activo !== null && puntos[activo] && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg"
          style={{
            left: Math.min(Math.max(puntos[activo].x - 60, 0), ancho - 130),
            top: Math.max(puntos[activo].y - 62, 0),
          }}
        >
          <p className="font-semibold">
            {formatoFecha(puntos[activo].periodo, granularidad)}
          </p>
          <p className="tabular">
            Neto {simbolo} {puntos[activo].neto.toFixed(2)}
          </p>
          <p className="tabular text-white/70">
            Margen {simbolo} {puntos[activo].margen.toFixed(2)} · {puntos[activo].pedidos} pedidos
          </p>
        </div>
      )}

      <p className="mt-1 text-center text-[11px] text-muted">
        Máximo del periodo: {simbolo} {maximo.toFixed(0)}
      </p>
    </div>
  );
}
