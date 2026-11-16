import type { EnvioPublico } from "../api";

const PASOS: { estado: EnvioPublico["status"]; texto: string }[] = [
  { estado: "preparando", texto: "Preparando el envío" },
  { estado: "en_transito", texto: "En camino" },
  { estado: "en_agencia", texto: "Listo para recoger en la agencia" },
  { estado: "entregado", texto: "Entregado" },
];

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** Envío del pedido (Shalom, Olva, motorizado…): empresa, guía, agencia y avance. */
export default function SeguimientoEnvio({ envio }: { envio: EnvioPublico }) {
  // Un envío de motorizado no pasa por agencia: ese paso no se muestra.
  const pasos = envio.agency || envio.status === "en_agencia" ? PASOS : PASOS.filter((p) => p.estado !== "en_agencia");
  const actual = envio.status === "incidencia" ? -1 : pasos.findIndex((p) => p.estado === envio.status);
  const cuando = (estado: string) => envio.events.filter((e) => e.status === estado).at(-1)?.happenedAt ?? null;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h3 className="font-bold">Envío{envio.carrier ? ` por ${envio.carrier}` : ""}</h3>

      <dl className="mt-2 space-y-1 text-sm">
        {envio.trackingCode && (
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Guía / código</dt>
            <dd className="font-mono font-bold">{envio.trackingCode}</dd>
          </div>
        )}
        {envio.agency && (
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Agencia de destino</dt>
            <dd className="text-right font-semibold">{envio.agency}</dd>
          </div>
        )}
        {envio.estimatedAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Llegada estimada</dt>
            <dd className="font-semibold">{envio.estimatedAt.slice(0, 10)}</dd>
          </div>
        )}
      </dl>

      {envio.status === "incidencia" ? (
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          Hubo un inconveniente con tu envío. La tienda te escribirá para resolverlo.
        </p>
      ) : (
        <ol className="mt-4">
          {pasos.map((p, i) => {
            const hecho = i <= actual;
            return (
              <li key={p.estado} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold"
                    style={
                      hecho
                        ? { backgroundColor: "var(--tienda-primario)", color: "#fff" }
                        : { backgroundColor: "#e5e5e5", color: "#a3a3a3" }
                    }
                  >
                    {hecho ? "✓" : i + 1}
                  </span>
                  {i < pasos.length - 1 && <span className="h-5 w-0.5 bg-neutral-200" />}
                </div>
                <p className={`text-sm ${i === actual ? "font-extrabold text-neutral-900" : "text-neutral-500"}`}>
                  {p.texto}
                  {hecho && cuando(p.estado) && (
                    <span className="ml-2 text-xs font-normal text-neutral-400">{fecha(cuando(p.estado))}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {envio.status === "en_agencia" && (
        <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">
          Recógelo con tu DNI y la clave que te enviamos por WhatsApp.
        </p>
      )}

      {envio.trackingUrl && (
        <a
          href={envio.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-sm font-bold underline"
        >
          Rastrear en la web de {envio.carrier ?? "la agencia"}
        </a>
      )}
    </section>
  );
}
