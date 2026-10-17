import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useStore } from "../StoreContext";
import type { ContextoCuenta } from "./ClienteLayout";
import { ESTADOS, FINALIZADOS } from "./estados";
import { VincularPedido } from "./VincularPedido";

type Filtro = "curso" | "anteriores" | "todos";

/** Pedidos del cliente en todas las tiendas. */
export default function PedidosCuenta() {
  const { cliente, pedidos, recargar } = useOutletContext<ContextoCuenta>();
  const { slug, tienda } = useStore();
  const [filtro, setFiltro] = useState<Filtro>("curso");

  const lista = (pedidos ?? []).filter((p) =>
    filtro === "todos" ? true : filtro === "curso" ? !FINALIZADOS.includes(p.status) : FINALIZADOS.includes(p.status)
  );
  const nCurso = (pedidos ?? []).filter((p) => !FINALIZADOS.includes(p.status)).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Hola, {cliente.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-neutral-500">Aquí están tus pedidos de todas las tiendas.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["curso", `En curso${nCurso ? ` (${nCurso})` : ""}`],
            ["anteriores", "Anteriores"],
            ["todos", "Todos"],
          ] as [Filtro, string][]
        ).map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
              filtro === id ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-700"
            }`}
            style={filtro === id ? { backgroundColor: "var(--tienda-primario)" } : undefined}
          >
            {texto}
          </button>
        ))}
      </div>

      {pedidos === null ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-200" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="font-bold">
            {pedidos.length === 0 ? "Aún no tienes pedidos en tu cuenta" : "No hay pedidos en esta lista"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {pedidos.length === 0
              ? "Los pedidos que hagas con tu sesión iniciada aparecerán aquí."
              : "Cambia el filtro para ver los demás."}
          </p>
          <Link
            to={`/t/${slug}`}
            className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--tienda-primario)" }}
          >
            Ir a {tienda?.name ?? "la tienda"}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((p) => {
            const e = ESTADOS[p.status] ?? { texto: p.status, clase: "bg-neutral-100 text-neutral-700" };
            return (
              <li key={`${p.storeSlug}-${p.code}`}>
                <Link
                  to={`/t/${slug}/cuenta/pedido/${p.storeSlug}/${p.code}`}
                  className="flex h-full items-center gap-3 rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  {p.storeLogo ? (
                    <img src={p.storeLogo} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-neutral-100 font-bold">
                      {p.storeName.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p.storeName}</span>
                    <span className="block text-xs text-neutral-500">
                      {p.code} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {p.lastMessage && (
                      <span
                        className={`mt-0.5 block truncate text-xs ${
                          p.unreadMessages > 0 ? "font-bold text-neutral-900" : "text-neutral-500"
                        }`}
                      >
                        💬 {p.lastDirection === "out" ? `${p.storeName}: ` : "Tú: "}
                        {p.lastMessage}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-extrabold tabular-nums">
                      {p.currencySymbol} {p.total.toFixed(2)}
                    </span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${e.clase}`}>{e.texto}</span>
                    {p.unreadMessages > 0 && (
                      <span className="ml-1 inline-block rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        {p.unreadMessages}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <VincularPedido slug={slug} nombreTienda={tienda?.name ?? "esta tienda"} onListo={recargar} />
    </div>
  );
}
