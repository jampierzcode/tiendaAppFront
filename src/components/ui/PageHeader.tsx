import type { ReactNode } from "react";

interface Props {
  titulo: string;
  descripcion?: string;
  /** Botones de la esquina derecha. */
  acciones?: ReactNode;
}

/**
 * Encabezado común de todas las pantallas del panel.
 *
 * Existe para que el título, el subtítulo y los botones caigan siempre en el
 * mismo sitio: cuando cada página inventa su propio encabezado, el panel se
 * siente hecho de retazos.
 */
export default function PageHeader({ titulo, descripcion, acciones }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight text-ink">{titulo}</h1>
        {descripcion && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            {descripcion}
          </p>
        )}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
