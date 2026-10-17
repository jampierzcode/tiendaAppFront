import { useState } from "react";
import type { Cotizacion } from "../api";

/**
 * Campo para escribir un cupón. Muestra si se aplicó o por qué no: un código
 * que no hace nada sin explicación es lo que hace que el cliente se vaya.
 */
export default function CuponCarrito({
  aplicado,
  estado,
  onAplicar,
  onQuitar,
}: {
  aplicado: string;
  estado: Cotizacion["cupon"];
  onAplicar: (codigo: string) => void;
  onQuitar: () => void;
}) {
  const [texto, setTexto] = useState("");

  if (aplicado) {
    return (
      <div className="mb-3 flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
        <span className={estado && !estado.valido ? "text-red-700" : "text-emerald-700"}>
          🎟 {estado?.mensaje ?? `Cupón ${aplicado}`}
        </span>
        <button type="button" onClick={onQuitar} className="text-xs text-neutral-500 underline">
          Quitar
        </button>
      </div>
    );
  }

  return (
    <form
      className="mb-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (texto.trim()) onAplicar(texto.trim());
      }}
    >
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value.toUpperCase())}
        placeholder="¿Tienes un cupón?"
        className="h-10 flex-1 rounded-lg border border-neutral-200 px-3 text-sm uppercase outline-none focus:border-neutral-400"
        maxLength={40}
      />
      <button
        type="submit"
        className="rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 disabled:opacity-50"
        disabled={!texto.trim()}
      >
        Aplicar
      </button>
    </form>
  );
}
