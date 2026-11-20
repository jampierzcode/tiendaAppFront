import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Spin, message } from "antd";
import { TbBackspace, TbUser } from "react-icons/tb";
import SalonApp from "./SalonApp";
import { apiPublica, claveTokenPersonal, crearApiSalon, mensajeError, tokenPersonal } from "./api";

/**
 * Comandero del personal: /pdv/<uuid-del-negocio>. La mesera abre el link
 * en su celular, toca su nombre y escribe su PIN. No necesita correo.
 */
export default function PdvPersonal() {
  const { uuid = "" } = useParams();
  const [token, setToken] = useState(() => tokenPersonal(uuid));
  const salir = () => {
    localStorage.removeItem(claveTokenPersonal(uuid));
    setToken(null);
  };
  const api = useMemo(() => crearApiSalon(uuid, "personal", () => setToken(null)), [uuid]);

  useEffect(() => {
    document.title = "Comandero";
  }, []);

  return (
    <div className="min-h-screen bg-canvas px-3 pt-4">
      {token ? (
        <SalonApp api={api} uuid={uuid} onSalir={salir} />
      ) : (
        <EntradaPin uuid={uuid} onEntrar={setToken} />
      )}
    </div>
  );
}

function EntradaPin({ uuid, onEntrar }: { uuid: string; onEntrar: (t: string) => void }) {
  const [datos, setDatos] = useState<{ negocio: string; personal: { id: number; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<{ id: number; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    apiPublica
      .get(`/staff/${uuid}`)
      .then(({ data }) => setDatos(data.data))
      .catch((e) => setError(mensajeError(e, "Link no válido")));
  }, [uuid]);

  const entrar = async (valor: string) => {
    if (!elegido) return;
    setCargando(true);
    try {
      const { data } = await apiPublica.post(`/staff/${uuid}/login`, { staffId: elegido.id, pin: valor });
      localStorage.setItem(claveTokenPersonal(uuid), data.data.token.token);
      onEntrar(data.data.token.token);
    } catch (e) {
      message.error(mensajeError(e));
      setPin("");
    } finally {
      setCargando(false);
    }
  };

  const tecla = (d: string) => {
    if (cargando) return;
    const nuevo = (pin + d).slice(0, 6);
    setPin(nuevo);
  };

  if (error) return <div className="mt-20 text-center text-danger">{error}</div>;
  if (!datos) return <div className="mt-20 text-center"><Spin /></div>;

  return (
    <div className="mx-auto mt-6 max-w-sm">
      <div className="mb-6 text-center">
        <div className="text-[13px] text-muted">Comandero</div>
        <div className="text-[22px] font-bold text-ink">{datos.negocio}</div>
      </div>

      {!elegido ? (
        <>
          <div className="mb-3 text-center text-[14px] text-ink-soft">¿Quién eres?</div>
          {!datos.personal.length && (
            <p className="text-center text-muted">El dueño aún no creó usuarios para el personal.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {datos.personal.map((p) => (
              <button
                key={p.id}
                onClick={() => setElegido(p)}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-line bg-white p-4 active:scale-95"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-[22px] text-brand-600">
                  <TbUser />
                </span>
                <span className="font-semibold text-ink">{p.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="mb-1 text-[16px] font-semibold">Hola, {elegido.name}</div>
          <div className="mb-4 text-[13px] text-muted">Escribe tu PIN</div>
          <div className="mb-5 flex justify-center gap-3">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-brand-500" : "bg-line"}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} onClick={() => tecla(d)} className="h-16 rounded-2xl bg-white text-[24px] font-semibold shadow-sm active:bg-brand-50">
                {d}
              </button>
            ))}
            <button onClick={() => { setElegido(null); setPin(""); }} className="h-16 rounded-2xl text-[13px] text-muted">
              Cambiar
            </button>
            <button onClick={() => tecla("0")} className="h-16 rounded-2xl bg-white text-[24px] font-semibold shadow-sm active:bg-brand-50">
              0
            </button>
            <button onClick={() => setPin(pin.slice(0, -1))} className="grid h-16 place-items-center rounded-2xl text-[24px] text-muted">
              <TbBackspace />
            </button>
          </div>
          <Button type="primary" size="large" block className="mt-5" disabled={pin.length < 4} loading={cargando} onClick={() => entrar(pin)}>
            Entrar
          </Button>
        </div>
      )}
    </div>
  );
}
