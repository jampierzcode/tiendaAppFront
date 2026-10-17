import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../StoreContext";
import {
  borrarClaim,
  entrarCliente,
  guardarTokenCliente,
  ligarPedido,
  registrarCliente,
  useCliente,
} from "../cliente";

interface Props {
  code: string;
  /** Código de un solo uso del pedido; sin él no se puede ligar. */
  claimToken: string | null;
}

/**
 * Invitación a crear una cuenta de cliente desde el detalle del pedido.
 * Con sesión iniciada el pedido se liga solo; sin ella se ofrece crear la
 * cuenta o entrar a la que ya tiene.
 */
export default function InvitacionCuenta({ code, claimToken }: Props) {
  const { slug, tienda } = useStore();
  const { cliente, cargando } = useCliente();
  const [modo, setModo] = useState<"crear" | "entrar">("crear");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ligado, setLigado] = useState(false);

  // Con sesión, el pedido de este navegador se agrega a la cuenta.
  useEffect(() => {
    if (!cliente || !claimToken || ligado) return;
    ligarPedido(slug, code, claimToken)
      .then(() => {
        borrarClaim(slug, code);
        setLigado(true);
      })
      .catch(() => undefined);
  }, [cliente, claimToken, slug, code, ligado]);

  if (cargando) return null;

  if (cliente) {
    return (
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm text-neutral-700">
          Sesión iniciada como <strong>{cliente.name}</strong>.
          {ligado ? " Este pedido ya está en tu cuenta." : ""}
        </p>
        <Link
          to={`/t/${slug}/cuenta`}
          className="mt-2 inline-block text-sm font-bold underline"
          style={{ color: "var(--tienda-primario)" }}
        >
          Ver todos mis pedidos
        </Link>
      </section>
    );
  }

  if (!claimToken) {
    return (
      <p className="px-2 text-center text-sm text-neutral-500">
        ¿Ya tienes cuenta?{" "}
        <Link to={`/t/${slug}/cuenta`} className="font-bold underline">
          Entra para ver tus pedidos
        </Link>
      </p>
    );
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r =
        modo === "crear"
          ? await registrarCliente(slug, { name: nombre, email, password: clave, orderCode: code, claimToken })
          : await entrarCliente({ email, password: clave, slug, orderCode: code, claimToken });
      borrarClaim(slug, code);
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
      <h3 className="font-bold">Entérate de todas las novedades de {tienda?.name}</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Crea tu cuenta y tendrás aquí todos tus pedidos, siempre a la mano.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 text-sm font-semibold">
        {(["crear", "entrar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              setError(null);
            }}
            className={`rounded-lg py-1.5 ${modo === m ? "bg-white shadow-sm" : "text-neutral-500"}`}
          >
            {m === "crear" ? "Crear cuenta" : "Ya tengo cuenta"}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="mt-3 space-y-2.5">
        {modo === "crear" && (
          <input
            className={campo}
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            required
          />
        )}
        <input
          className={campo}
          type="email"
          placeholder="Tu correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
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
          {enviando ? "Un momento…" : modo === "crear" ? "Crear mi cuenta" : "Entrar"}
        </button>
      </form>
    </section>
  );
}
