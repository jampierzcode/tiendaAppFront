import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { storeApi } from "../api";
import { cabeceraCliente, useCliente } from "../cliente";
import { useStore } from "../StoreContext";

interface Mensaje {
  id: number;
  direction: "in" | "out";
  body: string;
  createdAt: string;
}

interface Props {
  code: string;
  /** Código de un solo uso del pedido: permite escribir sin cuenta desde este navegador. */
  claimToken: string | null;
  /** Para usarlo fuera de la tienda (app del cliente): la tienda del pedido. */
  slug?: string;
  nombreTienda?: string;
}

/**
 * Mensajes con la tienda dentro del pedido. Se puede usar con el código del
 * pedido (el navegador que lo hizo) o con la cuenta del cliente; sin ninguno
 * de los dos no se muestra.
 */
export default function MensajesPedido({ code, claimToken, slug: slugProp, nombreTienda }: Props) {
  const { slug: slugTienda, tienda } = useStore();
  const slug = slugProp ?? slugTienda;
  const { cliente, cargando } = useCliente();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const cantidad = useRef(0);

  // Con código de pedido se usa la ruta pública; si no, la de la cuenta.
  const acceso = claimToken
    ? { url: `/store/${slug}/orders/${code}/messages`, headers: { "x-claim-token": claimToken } }
    : cliente
      ? { url: `/account/orders/${slug}/${code}/messages`, headers: cabeceraCliente() }
      : null;
  const url = acceso?.url;
  const headers = acceso?.headers;

  const cargar = useCallback(async () => {
    if (!url) return;
    try {
      const r = await storeApi.get<{ data: Mensaje[] }>(url, { headers });
      setMensajes(r.data.data);
    } catch {
      // sin acceso a este pedido: no se muestra nada
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!url || document.hidden) return;
    cargar();
    const t = setInterval(() => !document.hidden && cargar(), 8000);
    return () => clearInterval(t);
  }, [url, cargar]);

  useEffect(() => {
    if (mensajes.length !== cantidad.current) {
      cantidad.current = mensajes.length;
      fin.current?.scrollIntoView({ block: "nearest" });
    }
  }, [mensajes]);

  if (cargando || !acceso) return null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || !url) return;
    setEnviando(true);
    setError(null);
    try {
      await storeApi.post(url, { body: t }, { headers });
      setTexto("");
      await cargar();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "No pudimos enviar tu mensaje");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h3 className="font-bold">Mensajes con {nombreTienda ?? tienda?.name ?? "la tienda"}</h3>
      <div className="mt-3 h-72 space-y-2 overflow-y-auto rounded-2xl bg-neutral-50 p-3">
        {mensajes.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500">
            Aún no hay mensajes. Escríbenos si tienes alguna duda de tu pedido.
          </p>
        ) : (
          mensajes.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "in" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.direction === "in" ? "text-white" : "bg-white ring-1 ring-neutral-200"
                }`}
                style={m.direction === "in" ? { backgroundColor: "var(--tienda-primario)" } : undefined}
              >
                {m.body}
                <span className="mt-0.5 block text-right text-[10px] opacity-60">
                  {new Date(m.createdAt).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={fin} />
      </div>
      <form onSubmit={enviar} className="mt-3 flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu mensaje…"
          maxLength={1000}
          className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="h-11 shrink-0 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--tienda-primario)" }}
        >
          Enviar
        </button>
      </form>
      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
