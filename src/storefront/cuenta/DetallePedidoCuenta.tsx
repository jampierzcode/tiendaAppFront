import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { obtenerSeguimiento, type SeguimientoPedido } from "../api";
import { useStore } from "../StoreContext";
import MensajesPedido from "../components/MensajesPedido";
import { PASOS, PASO_DE } from "../menu/OrderTracking";
import type { ContextoCuenta } from "./ClienteLayout";
import { ESTADOS, FINALIZADOS } from "./estados";

/**
 * Un pedido dentro de la app del cliente: estado, detalle y conversación con
 * la tienda, a dos columnas en pantallas grandes para no tener que desplazarse.
 */
export default function DetallePedidoCuenta() {
  const { storeSlug = "", code = "" } = useParams();
  const { slug } = useStore();
  const { pedidos } = useOutletContext<ContextoCuenta>();
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [noExiste, setNoExiste] = useState(false);

  const nombreTienda = pedidos?.find((p) => p.storeSlug === storeSlug && p.code === code)?.storeName ?? "la tienda";

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    const cargar = async () => {
      try {
        const data = await obtenerSeguimiento(storeSlug, code);
        if (!vivo) return;
        setPedido(data);
        if (!FINALIZADOS.includes(data.status)) timer = setTimeout(cargar, 8000);
      } catch {
        if (vivo) setNoExiste(true);
      }
    };
    setPedido(null);
    setNoExiste(false);
    cargar();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [storeSlug, code]);

  const volver = (
    <Link to={`/t/${slug}/cuenta`} className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-600 hover:underline">
      ← Mis pedidos
    </Link>
  );

  if (noExiste) {
    return (
      <div className="space-y-4">
        {volver}
        <p className="rounded-3xl bg-white p-8 text-center text-neutral-500 shadow-sm">No encontramos ese pedido.</p>
      </div>
    );
  }
  if (!pedido) {
    return (
      <div className="space-y-4">
        {volver}
        <div className="h-64 animate-pulse rounded-3xl bg-neutral-200" />
      </div>
    );
  }

  const cancelado = pedido.status === "cancelado" || pedido.status === "devuelto";
  const actual = PASO_DE[pedido.status] ?? 0;
  const e = ESTADOS[pedido.status] ?? { texto: pedido.status, clase: "bg-neutral-100 text-neutral-700" };
  const dinero = (v: number) => `${pedido.currencySymbol} ${v.toFixed(2)}`;

  return (
    <div className="space-y-4">
      {volver}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-black">{pedido.code}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${e.clase}`}>{e.texto}</span>
        <Link to={`/t/${storeSlug}`} className="text-sm text-neutral-500 underline">
          {nombreTienda}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            {cancelado ? (
              <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">Este pedido fue cancelado.</p>
            ) : (
              <ol className="grid grid-cols-5 gap-1 text-center">
                {PASOS.map((p, i) => {
                  const hecho = i <= actual;
                  return (
                    <li key={p.estado} className="flex flex-col items-center gap-1.5">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold"
                        style={hecho ? { backgroundColor: "var(--tienda-primario)", color: "#fff" } : { backgroundColor: "#e5e5e5", color: "#a3a3a3" }}
                      >
                        {hecho ? "✓" : i + 1}
                      </span>
                      <span className={`text-[11px] leading-tight sm:text-xs ${i === actual ? "font-extrabold" : "text-neutral-500"}`}>
                        {p.texto}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {pedido.paymentPolicy !== "none" && !cancelado && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-bold">Pago</h2>
              {pedido.paidTotal >= pedido.total - 0.009 ? (
                <p className="mt-2 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">✓ Pagado</p>
              ) : (
                <div className="mt-2 text-sm text-neutral-700">
                  <p className="font-semibold">Pendiente: {dinero(pedido.total - pedido.paidTotal)}</p>
                  {pedido.paymentInstructions && (
                    <p className="mt-2 whitespace-pre-line rounded-2xl bg-neutral-100 p-3 font-semibold">{pedido.paymentInstructions}</p>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold">Detalle</h2>
            <ul className="mt-2 divide-y divide-neutral-100">
              {pedido.items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 py-3 text-sm">
                  {it.imageUrl && <img src={it.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-neutral-100 object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {it.quantity} × {it.name}
                    </p>
                    {it.variation && <p className="text-xs text-neutral-500">{it.variation}</p>}
                    {it.modifiers.length > 0 && <p className="text-xs text-neutral-500">{it.modifiers.join(" · ")}</p>}
                  </div>
                  <span className="tabular-nums">{dinero(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-neutral-100 pt-3 font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{dinero(pedido.total)}</span>
            </p>
          </section>
        </div>

        <div className="lg:sticky lg:top-6">
          <MensajesPedido code={code} claimToken={null} slug={storeSlug} nombreTienda={nombreTienda} />
        </div>
      </div>
    </div>
  );
}
