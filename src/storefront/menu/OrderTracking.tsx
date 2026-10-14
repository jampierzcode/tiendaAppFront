import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { obtenerSeguimiento, type SeguimientoPedido } from "../api";
import { useStore } from "../StoreContext";

const PASOS = [
  { estado: "pendiente", texto: "Recibido" },
  { estado: "confirmado", texto: "Confirmado" },
  { estado: "preparando", texto: "Preparando" },
  { estado: "listo", texto: "Listo" },
  { estado: "entregado", texto: "Entregado" },
];

/** Estados que equivalen a un paso de la línea de tiempo. */
const PASO_DE: Record<string, number> = {
  pendiente: 0,
  confirmado: 1,
  pagado: 1,
  preparando: 2,
  listo: 3,
  enviado: 3,
  entregado: 4,
};

export default function OrderTracking() {
  const { slug, precio } = useStore();
  const { code = "" } = useParams();
  const location = useLocation();
  const whatsappUrl = (location.state as { whatsappUrl?: string | null } | null)?.whatsappUrl;
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [noExiste, setNoExiste] = useState(false);

  useEffect(() => {
    let vigente = true;
    let timer: ReturnType<typeof setTimeout>;

    const cargar = async () => {
      try {
        const data = await obtenerSeguimiento(slug, code);
        if (!vigente) return;
        setPedido(data);
        // Mientras el pedido siga vivo se consulta cada 8 s.
        if (!["entregado", "cancelado", "devuelto"].includes(data.status)) {
          timer = setTimeout(cargar, 8000);
        }
      } catch {
        if (vigente) setNoExiste(true);
      }
    };

    cargar();
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [slug, code]);

  if (noExiste) {
    return <p className="p-10 text-center text-neutral-500">No encontramos ese pedido.</p>;
  }
  if (!pedido) {
    return <div className="m-5 h-48 animate-pulse rounded-3xl bg-neutral-200" />;
  }

  const cancelado = pedido.status === "cancelado" || pedido.status === "devuelto";
  const actual = PASO_DE[pedido.status] ?? 0;

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Tu pedido</p>
        <h2 className="text-2xl font-black">{pedido.code}</h2>
        {pedido.tableLabel && (
          <p className="text-sm text-neutral-500">Mesa {pedido.tableLabel}</p>
        )}

        {cancelado ? (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            Este pedido fue cancelado.
          </p>
        ) : (
          <ol className="mt-5 space-y-0">
            {PASOS.map((p, i) => {
              const hecho = i <= actual;
              return (
                <li key={p.estado} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold"
                      style={
                        hecho
                          ? { backgroundColor: "var(--tienda-primario)", color: "#fff" }
                          : { backgroundColor: "#e5e5e5", color: "#a3a3a3" }
                      }
                    >
                      {hecho ? "✓" : i + 1}
                    </span>
                    {i < PASOS.length - 1 && (
                      <span
                        className="h-6 w-0.5"
                        style={{
                          backgroundColor: i < actual ? "var(--tienda-primario)" : "#e5e5e5",
                        }}
                      />
                    )}
                  </div>
                  <p
                    className={`pt-0.5 text-sm ${
                      i === actual ? "font-extrabold text-neutral-900" : "text-neutral-500"
                    }`}
                  >
                    {p.texto}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {!cancelado && pedido.paymentPolicy !== "none" && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="font-bold">Pago</h3>
          {pedido.paidTotal >= pedido.total - 0.009 ? (
            <p className="mt-2 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">
              ✓ Pagado
            </p>
          ) : (
            <div className="mt-2 text-sm text-neutral-700">
              <p className="font-semibold">
                Pendiente: {precio(pedido.total - pedido.paidTotal)}
              </p>
              <p className="mt-1 text-neutral-500">
                {pedido.paymentPolicy === "on_confirm"
                  ? "Paga para que confirmemos tu pedido."
                  : "Pagas al recibir tu pedido."}
              </p>
              {pedido.paymentInstructions && (
                <p className="mt-2 whitespace-pre-line rounded-2xl bg-neutral-100 p-3 font-semibold">
                  {pedido.paymentInstructions}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="font-bold">Detalle</h3>
        <ul className="mt-3 divide-y divide-neutral-100">
          {pedido.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3 py-2 text-sm">
              <div>
                <p className="font-semibold">
                  {it.quantity} × {it.name}
                </p>
                {it.modifiers.length > 0 && (
                  <p className="text-xs text-neutral-500">{it.modifiers.join(" · ")}</p>
                )}
                {it.note && <p className="text-xs italic text-neutral-500">“{it.note}”</p>}
              </div>
              <span className="tabular-nums">{precio(it.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-neutral-100 pt-3 font-extrabold">
          <span>Total</span>
          <span className="tabular-nums">{precio(pedido.total)}</span>
        </p>
      </section>

      <div className="flex flex-col gap-2">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="grid h-12 place-items-center rounded-full bg-[#25D366] text-sm font-bold text-white"
          >
            Escribirnos por WhatsApp
          </a>
        )}
        <Link
          to={`/t/${slug}`}
          className="grid h-12 place-items-center rounded-full border border-neutral-300 bg-white text-sm font-bold"
        >
          Volver a la carta
        </Link>
      </div>
    </div>
  );
}
