import { useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { useStore } from "../StoreContext";
import TelefonoPais from "../components/TelefonoPais";
import { dialDePais, separarTelefono, telefonoCompleto } from "../../utilities/paises";
import { actualizarPerfil, enlaceMapa, type Cliente } from "../cliente";
import type { ContextoCuenta } from "./ClienteLayout";

export function Perfil({ cliente, paisTienda }: { cliente: Cliente; paisTienda?: string }) {
  const tel = separarTelefono(cliente.phone);
  const [nombre, setNombre] = useState(cliente.name);
  const [dial, setDial] = useState<string>(tel.dial ?? dialDePais(paisTienda));
  const [telefono, setTelefono] = useState(tel.nacional);
  const [direccion, setDireccion] = useState(cliente.deliveryAddress ?? "");
  const [ciudad, setCiudad] = useState(cliente.deliveryCity ?? "");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    cliente.latitude !== null && cliente.longitude !== null
      ? { latitude: cliente.latitude, longitude: cliente.longitude }
      : null
  );
  const [localizando, setLocalizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const usarUbicacion = () => {
    setAviso(null);
    if (!navigator.geolocation) {
      return setAviso({ ok: false, texto: "Tu navegador no permite obtener la ubicación." });
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) });
        setLocalizando(false);
      },
      () => {
        setLocalizando(false);
        setAviso({ ok: false, texto: "No pudimos obtener tu ubicación. Revisa el permiso del navegador." });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    try {
      await actualizarPerfil({
        name: nombre,
        phone: telefonoCompleto(dial, telefono),
        deliveryAddress: direccion,
        deliveryCity: ciudad,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      setAviso({ ok: true, texto: "Perfil guardado. Lo usaremos para rellenar tus próximos pedidos." });
    } catch (err: any) {
      setAviso({ ok: false, texto: err?.response?.data?.message ?? "No pudimos guardar. Inténtalo de nuevo." });
    } finally {
      setGuardando(false);
    }
  };

  const campo =
    "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-400";
  const mapa = coords ? enlaceMapa(coords) : null;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h3 className="font-bold">Mi perfil</h3>
      <p className="mt-1 text-sm text-neutral-600">Guarda tu WhatsApp y dónde recibes tus pedidos.</p>

      <form onSubmit={guardar} className="mt-3 space-y-2.5">
        <input className={campo} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <TelefonoPais
          dial={dial}
          onDial={setDial}
          value={telefono}
          onValue={setTelefono}
          placeholder="Tu WhatsApp"
          className="h-11 rounded-xl border border-neutral-200 bg-white focus-within:border-neutral-400"
        />
        <input className={campo} placeholder="Dirección para pedir (calle, número, referencia)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <input className={campo} placeholder="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />

        <div className="rounded-xl bg-neutral-50 p-3">
          <button
            type="button"
            onClick={usarUbicacion}
            disabled={localizando}
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {localizando ? "Buscando…" : "📍 Usar mi ubicación actual"}
          </button>
          {coords ? (
            <p className="mt-2 text-xs text-neutral-600">
              Ubicación guardada para pedir.{" "}
              {mapa && (
                <a href={mapa} target="_blank" rel="noreferrer" className="font-bold underline">
                  Ver en el mapa
                </a>
              )}{" "}
              ·{" "}
              <button type="button" onClick={() => setCoords(null)} className="font-bold underline">
                Quitar
              </button>
            </p>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">
              Opcional: el negocio recibe un enlace al mapa para llegar más fácil.
            </p>
          )}
        </div>

        {aviso && (
          <p className={`rounded-xl px-3 py-2 text-sm ${aviso.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {aviso.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={guardando}
          className="h-11 w-full rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--tienda-primario)" }}
        >
          {guardando ? "Guardando…" : "Guardar perfil"}
        </button>
      </form>
    </section>
  );
}


/** Datos de la cuenta y de contacto. */
export default function PerfilCuenta() {
  const { cliente, salir } = useOutletContext<ContextoCuenta>();
  const { tienda } = useStore();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Mi perfil</h1>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <span
            className="grid h-14 w-14 place-items-center rounded-full text-xl font-black text-white"
            style={{ backgroundColor: "var(--tienda-primario)" }}
          >
            {cliente.name.charAt(0).toUpperCase()}
          </span>
          <h2 className="mt-3 truncate text-lg font-black">{cliente.name}</h2>
          <p className="truncate text-sm text-neutral-500">{cliente.email}</p>
          <button onClick={salir} className="mt-4 w-full rounded-full border border-neutral-300 py-2.5 text-sm font-semibold">
            Cerrar sesión
          </button>
        </section>
        <Perfil cliente={cliente} paisTienda={tienda?.country} />
      </div>
    </div>
  );
}
