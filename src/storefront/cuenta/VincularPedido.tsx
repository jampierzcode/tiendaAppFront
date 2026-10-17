import { useState, type FormEvent } from "react";
import { ligarPorTelefono } from "../cliente";

export function VincularPedido({ slug, nombreTienda, onListo }: { slug: string; nombreTienda: string; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await ligarPorTelefono(slug, codigo.trim(), telefono);
      setOk(true);
      setCodigo("");
      setTelefono("");
      onListo();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "No pudimos vincular ese pedido.");
    } finally {
      setEnviando(false);
    }
  };

  const campo = "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-400";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <button onClick={() => setAbierto(!abierto)} className="w-full text-left font-bold">
        ¿Pediste antes de crear tu cuenta? {abierto ? "−" : "+"}
      </button>
      {abierto && (
        <form onSubmit={enviar} className="mt-3 space-y-2.5">
          <p className="text-sm text-neutral-600">
            Escribe el código de tu pedido en {nombreTienda} (ej. P-000012) y el WhatsApp que usaste. Se agregarán a tu cuenta
            ese pedido y los demás que hayas hecho con ese número en esta tienda.
          </p>
          <input className={campo} placeholder="Código del pedido" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          <input className={campo} inputMode="tel" placeholder="WhatsApp que usaste" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {ok && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">Listo, tu pedido ya está en tu cuenta.</p>}
          <button
            type="submit"
            disabled={enviando}
            className="h-11 w-full rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--tienda-primario)" }}
          >
            {enviando ? "Buscando…" : "Vincular pedido"}
          </button>
        </form>
      )}
    </section>
  );
}

