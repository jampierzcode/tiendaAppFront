import { useRef, useState } from "react";

/** Mueve el elemento `desde` a la posición que ocupa `hasta`. */
export function moverElemento<T>(lista: T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  const [x] = copia.splice(desde, 1);
  copia.splice(hasta, 0, x);
  return copia;
}

/**
 * Arrastrar y soltar filas de una tabla con la API nativa del navegador (sin
 * librerías). `grupoDe` limita el soltar a filas del mismo grupo.
 */
export function useFilasArrastrables<T extends { id: number | string }>(opts: {
  habilitado: boolean;
  onSoltar: (desdeId: T["id"], haciaId: T["id"]) => void;
  grupoDe?: (fila: T) => string | undefined;
}) {
  const origen = useRef<T | null>(null);
  const [sobre, setSobre] = useState<T["id"] | null>(null);

  const onRow = (fila: T) => {
    if (!opts.habilitado) return {};
    const grupo = opts.grupoDe?.(fila);
    return {
      draggable: true,
      style: { cursor: "grab", opacity: origen.current?.id === fila.id ? 0.5 : 1 },
      className: sobre === fila.id ? "bg-brand-50" : "",
      onDragStart: (e: React.DragEvent) => {
        origen.current = fila;
        e.dataTransfer.effectAllowed = "move";
      },
      onDragOver: (e: React.DragEvent) => {
        const o = origen.current;
        if (!o || o.id === fila.id) return;
        if (opts.grupoDe && opts.grupoDe(o) !== grupo) return;
        e.preventDefault();
        setSobre(fila.id);
      },
      onDragLeave: () => setSobre(null),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const o = origen.current;
        origen.current = null;
        setSobre(null);
        if (!o || o.id === fila.id) return;
        if (opts.grupoDe && opts.grupoDe(o) !== grupo) return;
        opts.onSoltar(o.id, fila.id);
      },
      onDragEnd: () => {
        origen.current = null;
        setSobre(null);
      },
    };
  };

  return { onRow };
}
