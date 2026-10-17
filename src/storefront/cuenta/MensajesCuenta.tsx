import { Link, useOutletContext } from "react-router-dom";
import { useStore } from "../StoreContext";
import type { ContextoCuenta } from "./ClienteLayout";

/** Conversaciones con las tiendas: una por pedido con mensajes. */
export default function MensajesCuenta() {
  const { pedidos } = useOutletContext<ContextoCuenta>();
  const { slug } = useStore();
  const conversaciones = (pedidos ?? []).filter((p) => p.lastMessage);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Mensajes</h1>
        <p className="text-sm text-neutral-500">Lo que te escriben las tiendas sobre tus pedidos.</p>
      </div>

      {pedidos === null ? (
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-200" />
      ) : conversaciones.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="font-bold">Sin mensajes por ahora</p>
          <p className="mt-1 text-sm text-neutral-500">
            Cuando una tienda te escriba sobre un pedido, la conversación aparecerá aquí. También puedes escribirle desde
            el detalle de cada pedido.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {conversaciones.map((p) => (
            <li key={`${p.storeSlug}-${p.code}`}>
              <Link
                to={`/t/${slug}/cuenta/pedido/${p.storeSlug}/${p.code}`}
                className="flex items-center gap-3 p-4 hover:bg-neutral-50"
              >
                {p.storeLogo ? (
                  <img src={p.storeLogo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-neutral-100 font-bold">
                    {p.storeName.charAt(0)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold">{p.storeName}</span>
                    <span className="shrink-0 text-[11px] text-neutral-400">Pedido {p.code}</span>
                  </span>
                  <span
                    className={`block truncate text-sm ${
                      p.unreadMessages > 0 ? "font-bold text-neutral-900" : "text-neutral-500"
                    }`}
                  >
                    {p.lastDirection === "in" ? "Tú: " : ""}
                    {p.lastMessage}
                  </span>
                </span>
                {p.unreadMessages > 0 && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {p.unreadMessages}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
