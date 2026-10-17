import { useState, type FormEvent } from "react";
import { entrarCliente, guardarTokenCliente, registrarCliente } from "../cliente";

/** Entrar o crear la cuenta: pantalla completa, con la marca de la tienda por la que llegó el cliente. */
export default function Acceso({ slug, nombreTienda }: { slug: string; nombreTienda: string }) {
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r =
        modo === "crear"
          ? await registrarCliente(slug, { name: nombre, email, password: clave })
          : await entrarCliente({ email, password: clave });
      guardarTokenCliente(r.token);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "No pudimos completar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const campo =
    "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-400";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Clientes</p>
      <h2 className="text-xl font-black">{modo === "entrar" ? "Entra a tu cuenta" : "Crea tu cuenta"}</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Sigue tus pedidos en {nombreTienda || "esta tienda"} y en las demás tiendas donde compres.
      </p>

      <form onSubmit={enviar} className="mt-4 space-y-2.5">
        {modo === "crear" && (
          <input className={campo} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required />
        )}
        <input className={campo} type="email" placeholder="Tu correo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input
          className={campo}
          type="password"
          placeholder={modo === "crear" ? "Crea una contraseña (mínimo 8)" : "Tu contraseña"}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete={modo === "crear" ? "new-password" : "current-password"}
          minLength={modo === "crear" ? 8 : undefined}
          required
        />
        {modo === "crear" && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Esta contraseña es solo para esta aplicación. <strong>No uses la de tu correo</strong>: crea una nueva.
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="h-11 w-full rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--tienda-primario)" }}
        >
          {enviando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear mi cuenta"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setModo(modo === "entrar" ? "crear" : "entrar");
          setError(null);
        }}
        className="mt-3 w-full text-center text-sm font-semibold underline"
      >
        {modo === "entrar" ? "¿Primera vez? Crea tu cuenta" : "Ya tengo cuenta, entrar"}
      </button>
    </section>
  );
}

