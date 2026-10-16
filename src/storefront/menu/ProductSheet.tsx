import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { PlatoMenu } from "../api";
import { useStore } from "../StoreContext";
import { useMenuCart, type OpcionElegida } from "./MenuCart";

interface Props {
  plato: PlatoMenu | null;
  onClose: () => void;
}

/**
 * Hoja inferior para personalizar un plato: grupos de modificadores con sus
 * reglas (obligatorio / hasta N), nota y cantidad. El botón de agregar no se
 * habilita hasta que todo lo obligatorio está elegido, y muestra el total real.
 */
export default function ProductSheet({ plato, onClose }: Props) {
  const { precio } = useStore();
  const { agregar } = useMenuCart();

  // groupId -> (optionId -> cantidad)
  const [elegidas, setElegidas] = useState<Record<number, Record<number, number>>>({});
  const [nota, setNota] = useState("");
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    setElegidas({});
    setNota("");
    setCantidad(1);
  }, [plato?.id]);

  useEffect(() => {
    if (!plato) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [plato, onClose]);

  const totalGrupo = (groupId: number) =>
    Object.values(elegidas[groupId] ?? {}).reduce((t, q) => t + q, 0);

  const extras = useMemo(() => {
    if (!plato) return 0;
    return plato.modifierGroups.reduce(
      (total, g) =>
        total +
        g.options.reduce(
          (t, o) => t + o.priceDelta * (elegidas[g.groupId]?.[o.id] ?? 0),
          0
        ),
      0
    );
  }, [plato, elegidas]);

  if (!plato) return null;

  const pendientes = plato.modifierGroups.filter((g) => totalGrupo(g.groupId) < g.minSelect);
  const unitario = plato.price + extras;

  const alternar = (groupId: number, optionId: number, max: number) => {
    setElegidas((actual) => {
      const grupo = { ...(actual[groupId] ?? {}) };

      if (max === 1) {
        // Un solo cupo: elegir otra opción reemplaza la anterior (como un radio).
        return { ...actual, [groupId]: grupo[optionId] ? {} : { [optionId]: 1 } };
      }

      if (grupo[optionId]) {
        delete grupo[optionId];
      } else if (Object.values(grupo).reduce((t, q) => t + q, 0) < max) {
        grupo[optionId] = 1;
      }
      return { ...actual, [groupId]: grupo };
    });
  };

  const confirmar = () => {
    const options: OpcionElegida[] = plato.modifierGroups.flatMap((g) =>
      g.options
        .filter((o) => (elegidas[g.groupId]?.[o.id] ?? 0) > 0)
        .map((o) => ({
          optionId: o.id,
          groupName: g.name,
          name: o.name,
          priceDelta: o.priceDelta,
          quantity: elegidas[g.groupId][o.id],
        }))
    );

    agregar({
      productId: plato.id,
      name: plato.name,
      imageUrl: plato.imageUrl,
      basePrice: plato.price,
      options,
      note: nota.trim(),
      quantity: cantidad,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="fondo"
        className="fixed inset-0 z-50 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={plato.name}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="overflow-y-auto">
          {plato.imageUrl && (
            <div className="bg-[#f0f1f3]">
              <img src={plato.imageUrl} alt={plato.name} className="h-56 max-h-[40vh] w-full object-contain sm:h-72" />
            </div>
          )}

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold leading-tight text-neutral-900">{plato.name}</h2>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg text-neutral-600"
              >
                ×
              </button>
            </div>

            {plato.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{plato.description}</p>
            )}

            <p className="mt-2 text-lg font-bold" style={{ color: "var(--tienda-primario)" }}>
              {precio(plato.price)}
            </p>

            {plato.modifierGroups.map((g) => {
              const cuenta = totalGrupo(g.groupId);
              const falta = g.minSelect > 0 && cuenta < g.minSelect;
              return (
                <section key={g.groupId} className="mt-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-neutral-900">{g.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        falta ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {g.minSelect > 0 ? "Obligatorio" : "Opcional"}
                      {g.maxSelect > 1 ? ` · hasta ${g.maxSelect}` : ""}
                    </span>
                  </div>
                  {g.description && <p className="text-xs text-neutral-500">{g.description}</p>}

                  <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                    {g.options.map((o) => {
                      const activa = (elegidas[g.groupId]?.[o.id] ?? 0) > 0;
                      const lleno = !activa && g.maxSelect > 1 && cuenta >= g.maxSelect;
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            disabled={lleno}
                            onClick={() => alternar(g.groupId, o.id, g.maxSelect)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-40"
                          >
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center border-2 ${
                                g.maxSelect === 1 ? "rounded-full" : "rounded-md"
                              }`}
                              style={{
                                borderColor: activa ? "var(--tienda-primario)" : "#d4d4d8",
                                backgroundColor: activa ? "var(--tienda-primario)" : "transparent",
                              }}
                            >
                              {activa && <span className="h-2 w-2 rounded-full bg-white" />}
                            </span>
                            <span className="flex-1 text-sm font-medium text-neutral-800">
                              {o.name}
                            </span>
                            {o.priceDelta !== 0 && (
                              <span className="text-sm font-semibold text-neutral-600">
                                {o.priceDelta > 0 ? "+" : "−"} {precio(Math.abs(o.priceDelta))}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <section className="mt-6">
              <label className="font-bold text-neutral-900" htmlFor="nota-plato">
                ¿Algo más?
              </label>
              <textarea
                id="nota-plato"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Ej.: sin cebolla, la salsa aparte"
                className="mt-2 w-full resize-none rounded-2xl border border-neutral-200 p-3 text-sm outline-none focus:border-neutral-400"
              />
            </section>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-100 bg-white p-4">
          <div className="flex items-center rounded-full border border-neutral-200">
            <button
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              aria-label="Menos"
              className="h-11 w-11 text-xl text-neutral-700"
            >
              −
            </button>
            <span className="w-7 text-center font-bold tabular-nums">{cantidad}</span>
            <button
              onClick={() => setCantidad((c) => Math.min(99, c + 1))}
              aria-label="Más"
              className="h-11 w-11 text-xl text-neutral-700"
            >
              +
            </button>
          </div>

          <button
            onClick={confirmar}
            disabled={pendientes.length > 0}
            className="h-12 flex-1 rounded-full px-5 text-sm font-bold text-white transition disabled:opacity-40"
            style={{ backgroundColor: "var(--tienda-primario)" }}
          >
            {pendientes.length > 0
              ? `Elige: ${pendientes[0].name}`
              : `Agregar · ${precio(unitario * cantidad)}`}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
