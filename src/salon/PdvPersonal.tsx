import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Modal, Spin, message } from "antd";
import { TbBackspace, TbDeviceMobile, TbLink } from "react-icons/tb";
import SalonApp from "./SalonApp";
import MonitorProduccion, { type TicketMonitor } from "./MonitorProduccion";
import {
  apiPublica,
  crearApiSalon,
  equipoGuardado,
  guardarEquipo,
  guardarTokenPersonal,
  mensajeError,
  tokenPersonal,
  type EquipoGuardado,
  type Yo,
} from "./api";

/**
 * Comandero / caja del personal: /pdv.
 *
 *  1. La primera vez, el dueño vincula el equipo con el código de 6 dígitos
 *     que ve en Infraestructura → Equipos. Desde ahí el equipo ya sabe de
 *     qué restaurante es.
 *  2. El personal entra solo con su PIN (sin elegir nombre).
 *  3. Si nadie toca la pantalla un rato, se bloquea y pide PIN otra vez.
 */
export default function PdvPersonal() {
  const [equipo, setEquipo] = useState<EquipoGuardado | null>(() => equipoGuardado());
  const [token, setToken] = useState(() => tokenPersonal());
  const [validando, setValidando] = useState(Boolean(equipoGuardado()));

  // Instalable como app (Chrome → «Instalar»): en la PC o el celular queda con
  // su propio ícono y ventana, sin barra del navegador.
  useEffect(() => {
    document.title = "PDV · Peaky Resto";
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/pdv.webmanifest";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  // El equipo puede haber sido revocado por el dueño.
  useEffect(() => {
    if (!equipo) return;
    apiPublica
      .post("/pos/device", { deviceToken: equipo.deviceToken })
      .then(({ data }) => {
        const actualizado = { ...equipo, negocio: data.data.negocio, equipo: data.data.equipo, modo: data.data.modo };
        guardarEquipo(actualizado);
        setEquipo(actualizado);
      })
      .catch((e) => {
        if ((e as { response?: unknown }).response) {
          guardarEquipo(null);
          guardarTokenPersonal(null);
          setEquipo(null);
          setToken(null);
          message.warning("Este equipo ya no está vinculado");
        }
      })
      .finally(() => setValidando(false));
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salir = useCallback(() => {
    void crearApiSalon(equipo?.negocio.uuid ?? "", "personal")
      .delete(`${import.meta.env.VITE_API_URL}/logout`)
      .catch(() => {});
    guardarTokenPersonal(null);
    setToken(null);
  }, [equipo]);

  if (validando) return <div className="grid min-h-screen place-items-center"><Spin /></div>;

  return (
    <div className="min-h-screen bg-canvas px-3 pt-4">
      {!equipo ? (
        <Vincular
          onListo={(e) => {
            guardarEquipo(e);
            setEquipo(e);
          }}
        />
      ) : equipo.modo === "monitor" ? (
        <MonitorEquipo equipo={equipo} />
      ) : token ? (
        <Sesion equipo={equipo} onSalir={salir} onExpirada={() => setToken(null)} />
      ) : (
        <EntradaPin
          equipo={equipo}
          onEntrar={(t) => {
            guardarTokenPersonal(t);
            setToken(t);
          }}
          onDesvincular={() => {
            guardarEquipo(null);
            setEquipo(null);
          }}
        />
      )}
    </div>
  );
}

/** Equipo fijo en cocina o barra: muestra sus áreas sin pedir PIN. */
function MonitorEquipo({ equipo }: { equipo: EquipoGuardado }) {
  const [info, setInfo] = useState<{ negocio: string; areas: string[] } | null>(null);
  const cargar = useCallback(async () => {
    const { data } = await apiPublica.post("/pos/monitor", { deviceToken: equipo.deviceToken });
    setInfo({ negocio: data.data.negocio, areas: data.data.areas });
    return data.data.tickets as TicketMonitor[];
  }, [equipo.deviceToken]);
  const cambiar = useCallback(
    async (ids: number[], estado: string) => {
      await apiPublica.post("/pos/monitor/items", { deviceToken: equipo.deviceToken, ids, estado });
    },
    [equipo.deviceToken]
  );
  return (
    <div className="-mx-3 -mt-4">
      <MonitorProduccion
        titulo={info?.areas.length ? info.areas.join(" · ") : "Todas las áreas"}
        subtitulo={`${equipo.equipo} · ${info?.negocio ?? equipo.negocio.name}`}
        cargar={cargar}
        cambiar={cambiar}
      />
    </div>
  );
}

function Sesion({ equipo, onSalir, onExpirada }: { equipo: EquipoGuardado; onSalir: () => void; onExpirada: () => void }) {
  const api = useMemo(() => crearApiSalon(equipo.negocio.uuid, "personal", onExpirada), [equipo.negocio.uuid, onExpirada]);
  const [inactividad, setInactividad] = useState(0);
  const ultima = useRef(Date.now());

  const onYo = useCallback((yo: Yo) => setInactividad(yo.inactividadSegundos ?? 0), []);

  // Bloqueo por inactividad: no se dispara con un modal o cajón abierto (a
  // media acción) y cualquier toque o tecla reinicia la cuenta.
  useEffect(() => {
    if (!inactividad) return;
    const tocar = () => (ultima.current = Date.now());
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart"];
    eventos.forEach((e) => window.addEventListener(e, tocar, { passive: true }));
    const t = setInterval(() => {
      const ocupado = document.querySelector(".ant-modal-wrap:not([style*='display: none']), .ant-drawer-open");
      if (ocupado) return tocar();
      if (Date.now() - ultima.current > inactividad * 1000) {
        message.info("Sesión bloqueada por inactividad");
        onSalir();
      }
    }, 5000);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, tocar));
      clearInterval(t);
    };
  }, [inactividad, onSalir]);

  return <SalonApp api={api} uuid={equipo.negocio.uuid} onSalir={onSalir} onYo={onYo} />;
}

function Vincular({ onListo }: { onListo: (e: EquipoGuardado) => void }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-[26px] text-brand-600">
          <TbLink />
        </div>
        <h1 className="text-[20px] font-bold text-ink">Vincular este equipo</h1>
        <p className="mt-1 text-[13px] text-muted">
          Se hace una sola vez. El dueño ve el código en su panel: <b>Infraestructura → Equipos</b>.
        </p>
        <Input
          className="mt-5 text-center !text-[24px] !tracking-[0.4em]"
          size="large"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        />
        <Input
          className="mt-3"
          prefix={<TbDeviceMobile />}
          placeholder="Nombre del equipo: Celular Ana, Tablet caja…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button
          type="primary"
          size="large"
          block
          className="mt-4"
          loading={cargando}
          disabled={codigo.length !== 6}
          onClick={async () => {
            setCargando(true);
            try {
              const { data } = await apiPublica.post("/pos/pair", { code: codigo, name: nombre || "Equipo" });
              onListo({ deviceToken: data.data.deviceToken, negocio: data.data.negocio, equipo: nombre || "Equipo" });
              message.success(`Equipo vinculado a ${data.data.negocio.name}`);
            } catch (e) {
              message.error(mensajeError(e));
            } finally {
              setCargando(false);
            }
          }}
        >
          Vincular
        </Button>
      </div>
    </div>
  );
}

function EntradaPin({
  equipo,
  onEntrar,
  onDesvincular,
}: {
  equipo: EquipoGuardado;
  onEntrar: (t: string) => void;
  onDesvincular: () => void;
}) {
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (valor: string) => {
    setCargando(true);
    try {
      const { data } = await apiPublica.post("/pos/login", { deviceToken: equipo.deviceToken, pin: valor });
      message.success(`Hola, ${data.data.name}`);
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
    setPin((pin + d).slice(0, 6));
  };

  return (
    <div className="mx-auto mt-6 max-w-sm text-center">
      <div className="text-[13px] text-muted">{equipo.equipo}</div>
      <div className="text-[22px] font-bold text-ink">{equipo.negocio.name}</div>
      <div className="mb-5 mt-4 text-[14px] text-ink-soft">Escribe tu PIN</div>
      <div className="mb-6 flex justify-center gap-3">
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
        <button
          onClick={() =>
            Modal.confirm({
              title: "¿Desvincular este equipo?",
              content: "Para volver a usarlo hará falta el código del dueño.",
              okText: "Desvincular",
              okButtonProps: { danger: true },
              onOk: onDesvincular,
            })
          }
          className="h-16 rounded-2xl text-[12px] text-muted"
        >
          Desvincular
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
  );
}
