import { useCallback, useEffect, useMemo, useState } from "react";
import type { AxiosInstance } from "axios";
import { AutoComplete, Button, Drawer, Dropdown, Empty, Input, InputNumber, Modal, Segmented, Select, Spin, message } from "antd";
import {
  TbArmchair,
  TbArrowLeft,
  TbList,
  TbArrowsExchange,
  TbBike,
  TbCash,
  TbCloudOff,
  TbDots,
  TbGift,
  TbLock,
  TbLockOpen,
  TbLogout,
  TbMinus,
  TbPaperBag,
  TbPlus,
  TbPrinter,
  TbRefresh,
  TbSearch,
  TbTrash,
  TbUser,
  TbX,
} from "react-icons/tb";
import dayjs from "dayjs";
import { usePolling } from "../hooks/usePolling";
import {
  NOMBRE_SERVICIO,
  mensajeError,
  puede,
  type Carta,
  type Cuenta,
  type ItemCuenta,
  type LineaCarrito,
  type Mesa,
  type Plato,
  type ResumenCuenta,
  type Servicio,
  type Yo,
} from "./api";
import { AutorizacionProvider } from "./autorizacion";
import { conPin, fueCancelado, useConAutorizacion } from "./autorizacionCtx";
import CajaPanel from "./CajaPanel";
import { aCuerpo, descartar, encolarComanda, enviarPendientes, leerPendientes, nuevoId, type ComandaPendiente } from "./outbox";

interface Props {
  api: AxiosInstance;
  uuid: string;
  /** Botón de salir (solo personal). */
  onSalir?: () => void;
  /** Avisa quién es (para el bloqueo por inactividad). */
  onYo?: (yo: Yo) => void;
}

/** A dónde va una comanda. */
type Destino =
  | { tipo: "mesa"; mesaId: number; nombre: string }
  | { tipo: "cuenta"; orderId: number; nombre: string }
  | {
      tipo: "nueva";
      key: string;
      service: "comedor" | "para_llevar" | "delivery";
      nombre: string;
      alias?: string;
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
      shippingCost?: number;
    };

type Raiz = "mesas" | "para_llevar" | "delivery" | "cuentas";

type Vista =
  | { tipo: "mesas" }
  | { tipo: "para_llevar" }
  | { tipo: "delivery" }
  | { tipo: "cuentas" }
  | { tipo: "caja" }
  | { tipo: "cuenta"; orderId: number }
  | { tipo: "comandar"; destino: Destino };

/** Pedido para llevar o delivery en curso (abierto, o cobrado y sin entregar). */
interface EnCurso {
  id: number;
  etiqueta: string;
  cliente: string;
  telefono: string | null;
  direccion: string | null;
  total: number;
  pagado: boolean;
  folio: string | null;
  cocina: "sin_cocina" | "en_cocina" | "parcial" | "listo";
  platos: number;
  listos: number;
  courier: string | null;
  salioEn: string | null;
  desde: string;
}

type Accion = <T>(fn: (pin: string | null) => Promise<T>, ok?: string) => Promise<T | null>;

const claveDestino = (d: Destino) => (d.tipo === "mesa" ? `m${d.mesaId}` : d.tipo === "cuenta" ? `c${d.orderId}` : d.key);

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Para buscar sin importar tildes ni mayúsculas: "perez" encuentra "Pérez". */
const plano = (t: string | null | undefined) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const ESTILO_MESA: Record<Mesa["estado"], { caja: string; texto: string }> = {
  libre: { caja: "border-line bg-white text-ink", texto: "Libre" },
  ocupada: { caja: "border-brand-500 bg-brand-500 text-white shadow-md", texto: "Ocupada" },
  impresa: { caja: "border-warn bg-warn-bg text-warn shadow-md", texto: "Cuenta impresa" },
  por_liberar: { caja: "border-dashed border-muted bg-line-soft text-muted", texto: "Por liberar" },
};

const ICONO_SERVICIO: Record<Servicio, React.ReactNode> = {
  comedor: null,
  para_llevar: <TbPaperBag />,
  delivery: <TbBike />,
};

/**
 * PDV: mesas, cuentas sin mesa (para llevar / delivery), comandas, cobro y
 * caja. Misma pantalla para dueño, cajero, gerente y mesero: cada botón hace
 * lo que su rol permite y, si no, pide la autorización de un encargado.
 */
export default function SalonApp(props: Props) {
  return (
    <AutorizacionProvider>
      <SalonInterno {...props} />
    </AutorizacionProvider>
  );
}

function SalonInterno({ api, uuid, onSalir, onYo }: Props) {
  const [yo, setYo] = useState<Yo | null>(null);
  const [mesas, setMesas] = useState<Mesa[] | null>(null);
  const [cuentasAbiertas, setCuentasAbiertas] = useState<ResumenCuenta[]>([]);
  const [carta, setCarta] = useState<Carta | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: "mesas" });
  const [pendientes, setPendientes] = useState<ComandaPendiente[]>(() => leerPendientes(uuid));
  const [sinRed, setSinRed] = useState(false);
  const [carritos, setCarritos] = useState<Record<string, LineaCarrito[]>>({});
  const [comensales, setComensales] = useState<Record<string, number | null>>({});
  const [nuevoDelivery, setNuevoDelivery] = useState(false);
  const [abrirMesaDe, setAbrirMesaDe] = useState<Mesa | null>(null);
  const [abrirSinMesa, setAbrirSinMesa] = useState(false);
  /** Cuenta que se cobra al toque (para llevar "Enviar y cobrar"). */
  const [cobrarAhora, setCobrarAhora] = useState<number | null>(null);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [enCurso, setEnCurso] = useState<{ para_llevar: EnCurso[]; delivery: EnCurso[] }>({ para_llevar: [], delivery: [] });
  const conAut = useConAutorizacion();

  const s = yo?.negocio.simbolo ?? "S/";
  const dinero = (n: number) => `${s} ${Number(n ?? 0).toFixed(2)}`;

  const cargar = useCallback(async () => {
    try {
      const [m, c, pl, dl] = await Promise.all([
        api.get("/tables"),
        api.get("/accounts"),
        api.get("/in-progress", { params: { service: "para_llevar" } }),
        api.get("/in-progress", { params: { service: "delivery" } }),
      ]);
      setMesas(m.data.data);
      setCuentasAbiertas(c.data.data);
      setEnCurso({ para_llevar: pl.data.data, delivery: dl.data.data });
      setSinRed(false);
    } catch (e) {
      if (!(e as { response?: unknown }).response) setSinRed(true);
    }
  }, [api]);

  const cargarCarta = useCallback(async () => {
    try {
      const { data } = await api.get("/menu");
      setCarta(data.data);
    } catch (e) {
      message.error(mensajeError(e, "No se pudo cargar la carta"));
    }
  }, [api]);

  useEffect(() => {
    api
      .get("/me")
      .then(({ data }) => {
        setYo(data.data);
        onYo?.(data.data);
        if (!data.data.servicios.comedor) setVista({ tipo: data.data.servicios.para_llevar ? "para_llevar" : "cuentas" });
      })
      .catch((e) => message.error(mensajeError(e)));
    void cargarCarta();
  }, [api, cargarCarta, onYo]);

  const refrescar = usePolling(cargar, 6000);

  const vaciarCola = useCallback(async () => {
    if (!leerPendientes(uuid).some((c) => !c.error)) return;
    const n = await enviarPendientes(uuid, api);
    if (n > 0) {
      message.success(n === 1 ? "Comanda enviada" : `${n} comandas enviadas`);
      refrescar();
    }
  }, [api, uuid, refrescar]);

  usePolling(vaciarCola, 5000, true, true);

  useEffect(() => {
    const leer = () => setPendientes(leerPendientes(uuid));
    window.addEventListener("pdv-outbox", leer);
    window.addEventListener("online", vaciarCola);
    return () => {
      window.removeEventListener("pdv-outbox", leer);
      window.removeEventListener("online", vaciarCola);
    };
  }, [uuid, vaciarCola]);

  /** Ejecuta una acción con autorización y avisa del error (salvo si se canceló). */
  const accion = useCallback<Accion>(
    async (fn, ok) => {
      try {
        const r = await conAut(fn);
        if (ok) message.success(ok);
        refrescar();
        return r;
      } catch (e) {
        if (!fueCancelado(e)) message.error(mensajeError(e));
        return null;
      }
    },
    [conAut, refrescar]
  );

  const volverARaiz = useCallback(() => {
    setVista({ tipo: "mesas" });
    refrescar();
  }, [refrescar]);

  const enviarComanda = async (destino: Destino, cobrar = false) => {
    const k = claveDestino(destino);
    const items = carritos[k] ?? [];
    if (!items.length) return;
    const alias = destino.tipo === "nueva" ? nombres[k]?.trim() || destino.alias : null;
    const comanda: ComandaPendiente = {
      clientRequestId: nuevoId(),
      tableId: destino.tipo === "mesa" ? destino.mesaId : null,
      orderId: destino.tipo === "cuenta" ? destino.orderId : null,
      service: destino.tipo === "nueva" ? destino.service : null,
      alias,
      customerName: destino.tipo === "nueva" ? destino.customerName || alias : null,
      customerPhone: destino.tipo === "nueva" ? destino.customerPhone : null,
      deliveryAddress: destino.tipo === "nueva" ? destino.deliveryAddress : null,
      shippingCost: destino.tipo === "nueva" ? destino.shippingCost : null,
      tableName: destino.nombre,
      guests: comensales[k] ?? null,
      items,
      createdAt: Date.now(),
    };

    if (cobrar) {
      // "Enviar y cobrar": necesita señal; si no hay, queda en cola y se cobra después.
      try {
        const { data } = await api.post("/command", aCuerpo(comanda));
        setCarritos((c) => ({ ...c, [k]: [] }));
        message.success("Comanda enviada a cocina");
        setCobrarAhora(data.data.orderId);
        void cargar();
        return;
      } catch (e) {
        if ((e as { response?: unknown }).response) {
          message.error(mensajeError(e));
          return;
        }
        message.warning("Sin señal: la comanda queda en cola y la cobras cuando vuelva la conexión");
      }
    }

    encolarComanda(uuid, comanda);
    setCarritos((c) => ({ ...c, [k]: [] }));
    const n = await enviarPendientes(uuid, api);
    if (n > 0) message.success("Comanda enviada");
    else if (!leerPendientes(uuid).some((p) => p.error)) {
      message.warning("Sin señal: la comanda se enviará sola al volver la conexión");
    }
    await cargar();
    if (destino.tipo === "cuenta") setVista({ tipo: "cuenta", orderId: destino.orderId });
    else setVista({ tipo: destino.tipo === "mesa" || destino.service === "comedor" ? "mesas" : destino.service });
  };

  const abrirMesa = (m: Mesa) => {
    if (m.estado === "por_liberar") {
      Modal.confirm({
        title: `Liberar mesa ${m.name}`,
        content: "Ya se cobró. ¿Quedó limpia y lista para nuevos clientes?",
        okText: "Liberar",
        onOk: () => accion((pin) => api.post(`/tables/${m.id}/release`, {}, conPin(pin)), "Mesa libre"),
      });
      return;
    }
    if (m.cuenta) {
      if (!m.cuenta.visible) {
        message.info(`La mesa ${m.name} la atiende ${m.cuenta.mesero ?? "otro mesero"}`);
        return;
      }
      setVista({ tipo: "cuenta", orderId: m.cuenta.id });
      return;
    }
    setAbrirMesaDe(m);
  };

  const nuevoParaLlevar = () =>
    setVista({
      tipo: "comandar",
      destino: { tipo: "nueva", key: `n${Date.now()}`, service: "para_llevar", nombre: "Nuevo para llevar" },
    });

  if (!yo || !mesas) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spin />
      </div>
    );
  }

  const verCaja = ["caja.operar", "caja.corte_x", "caja.cerrar_otras", "caja.corte_global"].some((p) => puede(yo, p));
  const enRaiz = ["mesas", "para_llevar", "delivery", "cuentas"].includes(vista.tipo);
  const titulo =
    enRaiz
      ? "Punto de venta"
      : vista.tipo === "caja"
          ? "Caja"
          : vista.tipo === "comandar"
            ? vista.destino.nombre
            : "Cuenta";

  return (
    <div className="mx-auto max-w-6xl pb-4">
      {/* Barra superior */}
      <div className="mb-3 flex items-center gap-2">
        {!enRaiz && (
          <Button
            icon={<TbArrowLeft />}
            onClick={() =>
              setVista(
                vista.tipo === "comandar" && vista.destino.tipo === "cuenta"
                  ? { tipo: "cuenta", orderId: vista.destino.orderId }
                  : vista.tipo === "comandar" && vista.destino.tipo === "nueva" && vista.destino.service !== "comedor"
                    ? { tipo: vista.destino.service }
                    : { tipo: "mesas" }
              )
            }
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-bold text-ink">{titulo}</div>
          <div className="truncate text-[12px] text-muted">
            {yo.name}
            {yo.caja ? ` · ${yo.caja.name}` : ""} · {yo.negocio.name}
          </div>
        </div>
        {verCaja && enRaiz && (
          <Button icon={<TbCash />} onClick={() => setVista({ tipo: "caja" })}>
            Caja
          </Button>
        )}
        <Button
          icon={<TbRefresh />}
          onClick={() => {
            refrescar();
            void cargarCarta();
          }}
        />
        {onSalir && (
          <Button icon={<TbLogout />} onClick={onSalir}>
            Salir
          </Button>
        )}
      </div>

      {(sinRed || pendientes.length > 0) && (
        <BannerPendientes
          sinRed={sinRed}
          pendientes={pendientes}
          onReintentar={vaciarCola}
          onDescartar={(id) => descartar(uuid, id)}
        />
      )}

      {enRaiz && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Segmented
            size="large"
            value={vista.tipo}
            onChange={(v) => setVista({ tipo: v as Raiz })}
            options={[
              ...(yo.servicios.comedor ? [{ value: "mesas", label: <Pestana icono={<TbArmchair />} texto="Comedor" /> }] : []),
              ...(yo.servicios.para_llevar
                ? [{ value: "para_llevar", label: <Pestana icono={<TbPaperBag />} texto="Para llevar" n={enCurso.para_llevar.length} /> }]
                : []),
              ...(yo.servicios.delivery
                ? [{ value: "delivery", label: <Pestana icono={<TbBike />} texto="Delivery" n={enCurso.delivery.length} /> }]
                : []),
              { value: "cuentas", label: <Pestana icono={<TbList />} texto="Cuentas" n={cuentasAbiertas.length} /> },
            ]}
          />
        </div>
      )}

      {vista.tipo === "para_llevar" && (
        <ListaEnCurso
          servicio="para_llevar"
          lista={enCurso.para_llevar}
          dinero={dinero}
          onNuevo={nuevoParaLlevar}
          onAbrir={(id) => setVista({ tipo: "cuenta", orderId: id })}
          onCobrar={(id) => setCobrarAhora(id)}
          onEntregar={(id) => accion(() => api.post(`/accounts/${id}/deliver`), "Entregado")}
        />
      )}

      {vista.tipo === "delivery" && (
        <ListaEnCurso
          servicio="delivery"
          lista={enCurso.delivery}
          dinero={dinero}
          onNuevo={() => setNuevoDelivery(true)}
          onAbrir={(id) => setVista({ tipo: "cuenta", orderId: id })}
          onCobrar={(id) => setCobrarAhora(id)}
          onEntregar={(id) => accion(() => api.post(`/accounts/${id}/deliver`), "Entregado")}
          onSalio={(id) => {
            let repartidor = "";
            Modal.confirm({
              title: "Salió a reparto",
              content: <Input placeholder="Repartidor (opcional): Moto Jorge, Rappi…" onChange={(e) => (repartidor = e.target.value)} />,
              okText: "Salió",
              onOk: () => accion(() => api.post(`/accounts/${id}/dispatch`, { courier: repartidor }), "En camino"),
            });
          }}
        />
      )}

      {vista.tipo === "mesas" && (
        <VistaComedor
          mesas={mesas}
          sinMesa={cuentasAbiertas.filter((c) => c.service === "comedor" && !c.mesaId)}
          pendientes={pendientes}
          dinero={dinero}
          onElegir={abrirMesa}
          onAbrirCuenta={(id) => setVista({ tipo: "cuenta", orderId: id })}
          onNuevaSinMesa={() => setAbrirSinMesa(true)}
        />
      )}

      {vista.tipo === "cuentas" && (
        <ListaCuentas
          api={api}
          abiertas={cuentasAbiertas}
          dinero={dinero}
          onAbrir={(id) => setVista({ tipo: "cuenta", orderId: id })}
          accion={accion}
        />
      )}

      {vista.tipo === "caja" && <CajaPanel api={api} simbolo={s} esDueno={yo.role === "dueno"} />}

      {vista.tipo === "cuenta" && (
        <VistaCuenta
          key={vista.orderId}
          api={api}
          yo={yo}
          orderId={vista.orderId}
          mesas={mesas}
          dinero={dinero}
          accion={accion}
          pendientes={pendientes.filter((p) => p.orderId === vista.orderId)}
          onAgregar={(c) => setVista({ tipo: "comandar", destino: { tipo: "cuenta", orderId: c.id, nombre: c.etiqueta } })}
          onCerrada={volverARaiz}
        />
      )}

      {vista.tipo === "comandar" && (
        <Comandar
          carta={carta}
          dinero={dinero}
          destino={vista.destino}
          carrito={carritos[claveDestino(vista.destino)] ?? []}
          setCarrito={(l) => setCarritos((c) => ({ ...c, [claveDestino(vista.destino)]: l }))}
          comensales={comensales[claveDestino(vista.destino)] ?? null}
          setComensales={(n) => setComensales((c) => ({ ...c, [claveDestino(vista.destino)]: n }))}
          nombre={nombres[claveDestino(vista.destino)] ?? ""}
          setNombre={(t) => setNombres((n) => ({ ...n, [claveDestino(vista.destino)]: t }))}
          onEnviar={(cobrar) => enviarComanda(vista.destino, cobrar)}
        />
      )}

      <NuevoDeliveryModal
        api={api}
        abierto={nuevoDelivery}
        simbolo={s}
        onClose={() => setNuevoDelivery(false)}
        onListo={(d) => {
          setNuevoDelivery(false);
          setVista({ tipo: "comandar", destino: d });
        }}
      />

      <AbrirMesaModal
        abierto={Boolean(abrirMesaDe) || abrirSinMesa}
        titulo={abrirMesaDe ? `Abrir mesa ${abrirMesaDe.name}` : "Nueva cuenta sin mesa"}
        onClose={() => {
          setAbrirMesaDe(null);
          setAbrirSinMesa(false);
        }}
        onAbrir={(personas) => {
          const destino: Destino = abrirMesaDe
            ? { tipo: "mesa", mesaId: abrirMesaDe.id, nombre: `Mesa ${abrirMesaDe.name}` }
            : { tipo: "nueva", key: `n${Date.now()}`, service: "comedor", nombre: "Cuenta sin mesa (M…)" };
          setAbrirMesaDe(null);
          setAbrirSinMesa(false);
          setComensales((c) => ({ ...c, [claveDestino(destino)]: personas }));
          setVista({ tipo: "comandar", destino });
        }}
      />

      {cobrarAhora && (
        <CobroDirecto
          api={api}
          orderId={cobrarAhora}
          dinero={dinero}
          accion={accion}
          descuentoMax={Number(yo.permisos["cobro.descuento"] ?? 0)}
          onClose={() => {
            setCobrarAhora(null);
            refrescar();
            if (vista.tipo === "comandar" && vista.destino.tipo === "nueva")
              setVista({ tipo: vista.destino.service === "comedor" ? "mesas" : vista.destino.service });
          }}
        />
      )}
    </div>
  );
}

function Pestana({ icono, texto, n }: { icono: React.ReactNode; texto: string; n?: number }) {
  return (
    <span className="flex items-center gap-1.5 px-1">
      {icono}
      {texto}
      {Boolean(n) && <span className="self-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold leading-[18px] text-white">{n}</span>}
    </span>
  );
}

// ------------------------------------------------------------------ pendientes

function BannerPendientes({
  sinRed,
  pendientes,
  onReintentar,
  onDescartar,
}: {
  sinRed: boolean;
  pendientes: ComandaPendiente[];
  onReintentar: () => void;
  onDescartar: (id: string) => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-warn/30 bg-warn-bg px-4 py-3 text-[13px] text-warn">
      <div className="flex items-center gap-2 font-semibold">
        <TbCloudOff /> {sinRed ? "Sin conexión" : "Comandas por enviar"}
        <Button size="small" className="ml-auto" onClick={onReintentar}>
          Reintentar
        </Button>
      </div>
      {pendientes.map((p) => (
        <div key={p.clientRequestId} className="mt-2 flex items-center gap-2">
          <span>
            ⏳ {p.tableName}: {p.items.reduce((t, l) => t + l.quantity, 0)} platos · {dayjs(p.createdAt).format("HH:mm")}
            {p.error && <b className="text-danger"> — {p.error}</b>}
          </span>
          {p.error && (
            <Button size="small" danger className="ml-auto" onClick={() => onDescartar(p.clientRequestId)}>
              Descartar
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------- mesas

/** Comedor: buscador, filtro por zona (piso, terraza…), mesas y cuentas sin mesa. */
function VistaComedor({
  mesas,
  sinMesa,
  pendientes,
  dinero,
  onElegir,
  onAbrirCuenta,
  onNuevaSinMesa,
}: {
  mesas: Mesa[];
  sinMesa: ResumenCuenta[];
  pendientes: ComandaPendiente[];
  dinero: (n: number) => string;
  onElegir: (m: Mesa) => void;
  onAbrirCuenta: (id: number) => void;
  onNuevaSinMesa: () => void;
}) {
  const [q, setQ] = useState("");
  const [zona, setZona] = useState<string>(() => localStorage.getItem("pdv_zona") ?? "");
  const zonas = [...new Set(mesas.map((m) => m.zone ?? "").filter(Boolean))];
  const texto = plano(q.trim());
  const coincide = (...campos: (string | null | undefined)[]) => !texto || campos.some((c) => plano(c).includes(texto));
  const filtradas = mesas.filter(
    (m) =>
      (!zona || (m.zone ?? "") === zona) &&
      coincide(m.name, `mesa ${m.name}`, m.cuenta?.etiqueta, m.cuenta?.cliente, m.cuenta?.mesero, m.cuenta?.folio)
  );
  const cuentas = sinMesa.filter((c) => coincide(c.etiqueta, c.cliente, c.mesero, c.folio));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input allowClear className="max-w-xs" prefix={<TbSearch />} placeholder="Mesa, cuenta o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        {zonas.length > 0 && (
          <Segmented
            value={zona}
            onChange={(v) => {
              setZona(String(v));
              localStorage.setItem("pdv_zona", String(v));
            }}
            options={[{ value: "", label: "Todas" }, ...zonas.map((z) => ({ value: z, label: z }))]}
          />
        )}
        <Button className="ml-auto" icon={<TbPlus />} onClick={onNuevaSinMesa}>
          Cuenta sin mesa
        </Button>
      </div>
      <GrillaMesas mesas={filtradas} pendientes={pendientes} dinero={dinero} onElegir={onElegir} />
      {cuentas.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Cuentas sin mesa</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cuentas.map((c) => (
              <button key={c.id} onClick={() => onAbrirCuenta(c.id)} className="card flex items-center gap-3 p-3 text-left active:scale-[0.99]">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{c.etiqueta}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {c.cliente ? `${c.cliente} · ` : ""}
                    {c.guests ? `${c.guests} pers. · ` : ""}
                    {c.mesero ?? ""} · {dayjs(c.abiertaDesde).format("HH:mm")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono font-semibold">{c.total !== null ? dinero(c.total) : "—"}</span>
                  {Boolean(c.listos) && <span className="pill bg-ok-bg text-ok">🔔 {c.listos}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GrillaMesas({
  mesas,
  pendientes,
  dinero,
  onElegir,
}: {
  mesas: Mesa[];
  pendientes: ComandaPendiente[];
  dinero: (n: number) => string;
  onElegir: (m: Mesa) => void;
}) {
  if (!mesas.length) return <Empty description="No hay mesas que coincidan. El dueño las crea en Infraestructura → Mesas." />;
  const zonas = [...new Set(mesas.map((m) => m.zone ?? ""))];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 text-[11.5px] text-muted">
        {(Object.keys(ESTILO_MESA) as Mesa["estado"][]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`h-3 w-3 rounded border-2 ${ESTILO_MESA[k].caja}`} /> {ESTILO_MESA[k].texto}
          </span>
        ))}
      </div>
      {zonas.map((z) => (
        <div key={z}>
          {(z || zonas.length > 1) && (
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{z || "Salón"}</div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {mesas
              .filter((m) => (m.zone ?? "") === z)
              .map((m) => {
                const espera = pendientes.some((p) => p.tableId === m.id);
                const ajena = m.cuenta && !m.cuenta.visible;
                return (
                  <button
                    key={m.id}
                    onClick={() => onElegir(m)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition active:scale-95 ${
                      ESTILO_MESA[m.estado].caja
                    } ${ajena ? "opacity-60" : ""}`}
                  >
                    {espera && <span className="absolute right-2 top-1 text-[14px]">⏳</span>}
                    {Boolean(m.cuenta?.listos) && (
                      <span className="absolute right-1.5 top-1.5 animate-pulse rounded-full bg-ok px-2 py-0.5 text-[12px] font-bold text-white shadow">
                        🔔 {m.cuenta!.listos}
                      </span>
                    )}
                    {ajena && <TbLock className="absolute left-2 top-2 text-[13px]" />}
                    <span className="text-[22px] font-bold leading-none">{m.name}</span>
                    {m.cuenta ? (
                      <>
                        {m.cuenta.total !== null && <span className="mt-1 font-mono text-[12px]">{dinero(m.cuenta.total)}</span>}
                        <span className="text-[10.5px] opacity-80">
                          {m.estado === "impresa" && m.cuenta.folio ? `${m.cuenta.folio} · ` : ""}
                          {dayjs(m.cuenta.abiertaDesde).format("HH:mm")}
                          {m.cuenta.mesero ? ` · ${m.cuenta.mesero}` : ""}
                        </span>
                        {m.cuenta.cliente && <span className="max-w-full truncate text-[11px] font-semibold">{m.cuenta.cliente}</span>}
                      </>
                    ) : (
                      <span className="mt-1 text-[11px]">{ESTILO_MESA[m.estado].texto}</span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- cuentas

function ListaCuentas({
  api,
  abiertas,
  dinero,
  onAbrir,
  accion,
}: {
  api: AxiosInstance;
  abiertas: ResumenCuenta[];
  dinero: (n: number) => string;
  onAbrir: (id: number) => void;
  accion: Accion;
}) {
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<"abiertas" | "cerradas">("abiertas");
  const [cerradas, setCerradas] = useState<ResumenCuenta[] | null>(null);
  const [busqueda, setBusqueda] = useState<ResumenCuenta[] | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (modo === "cerradas") {
          const { data } = await api.get("/accounts", { params: { cerradas: 1, q } });
          setCerradas(data.data);
        } else if (q.trim()) {
          const { data } = await api.get("/accounts", { params: { q } });
          setBusqueda(data.data);
        } else setBusqueda(null);
      } catch {
        /* sin red */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [api, q, modo]);

  const lista = modo === "cerradas" ? (cerradas ?? []) : (busqueda ?? abiertas);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          allowClear
          className="max-w-xs"
          prefix={<TbSearch />}
          placeholder="Folio, nombre, mesa, teléfono o mesero"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Segmented
          value={modo}
          onChange={(v) => setModo(v as "abiertas" | "cerradas")}
          options={[
            { value: "abiertas", label: "Abiertas" },
            { value: "cerradas", label: "Cerradas hoy" },
          ]}
        />
      </div>
      {!lista.length && <Empty description={modo === "abiertas" ? "No hay cuentas abiertas" : "Nada todavía"} />}
      <div className="grid gap-2 sm:grid-cols-2">
        {lista.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              if (modo === "abiertas") return onAbrir(c.id);
              if (c.status !== "entregado") return;
              Modal.confirm({
                title: `Reimprimir nota de venta ${c.folio ?? ""}`,
                okText: "Reimprimir",
                onOk: () => accion((pin) => api.post(`/accounts/${c.id}/reprint-note`, {}, conPin(pin)), "Enviada a la impresora"),
              });
            }}
            className="card flex items-center gap-3 p-3 text-left active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-[18px] text-brand-600">
              {ICONO_SERVICIO[c.service] ?? <span className="text-[13px] font-bold">{c.mesa ?? "M"}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{c.etiqueta}</span>
              <span className="block truncate text-[12px] text-muted">
                {NOMBRE_SERVICIO[c.service]}
                {c.cliente ? ` · ${c.cliente}` : ""}
                {c.folio ? ` · ${c.folio}` : ""}
                {c.mesero ? ` · ${c.mesero}` : ""} · {dayjs(c.abiertaDesde).format("HH:mm")}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-[14px] font-semibold">{c.total !== null ? dinero(c.total) : "—"}</span>
              {Boolean(c.listos) && <span className="pill bg-ok-bg text-ok">🔔 {c.listos} listos</span>}
              {c.accountStatus === "impresa" && <span className="pill bg-warn-bg text-warn">Impresa</span>}
              {c.status === "cancelado" && <span className="pill bg-danger-bg text-danger">Cancelada</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ListaEnCurso({
  servicio,
  lista,
  dinero,
  onNuevo,
  onAbrir,
  onCobrar,
  onEntregar,
  onSalio,
}: {
  servicio: "para_llevar" | "delivery";
  lista: EnCurso[];
  dinero: (n: number) => string;
  onNuevo: () => void;
  onAbrir: (id: number) => void;
  onCobrar: (id: number) => void;
  onEntregar: (id: number) => void;
  onSalio?: (id: number) => void;
}) {
  const delivery = servicio === "delivery";
  const [q, setQ] = useState("");
  const texto = plano(q.trim());
  const visibles = lista.filter(
    (p) => !texto || [p.etiqueta, p.cliente, p.telefono, p.folio, p.direccion].some((c) => plano(c).includes(texto))
  );
  const COCINA: Record<EnCurso["cocina"], { t: string; c: string }> = {
    sin_cocina: { t: "Sin cocina", c: "bg-line-soft text-muted" },
    en_cocina: { t: "En cocina", c: "bg-warn-bg text-warn" },
    parcial: { t: "Parcial", c: "bg-info-bg text-info" },
    listo: { t: "🔔 Listo", c: "bg-ok-bg text-ok" },
  };
  return (
    <div>
      <button
        onClick={onNuevo}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 py-5 text-[16px] font-bold text-brand-700 active:scale-[0.99]"
      >
        <TbPlus className="text-[20px]" /> {delivery ? "Nuevo delivery" : "Nuevo para llevar"}
      </button>
      {lista.length > 0 && (
        <Input
          allowClear
          className="mb-3 max-w-xs"
          prefix={<TbSearch />}
          placeholder={delivery ? "Cuenta, cliente, teléfono o dirección" : "Cuenta o cliente"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      {!visibles.length && <Empty description={delivery ? "No hay deliveries en curso" : "No hay pedidos para llevar en curso"} />}
      <div className="grid gap-2 sm:grid-cols-2">
        {visibles.map((p) => (
          <div key={p.id} className="card p-3">
            <button className="w-full text-left" onClick={() => onAbrir(p.id)} disabled={p.pagado}>
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-[15px] font-bold text-ink">
                  {p.etiqueta}
                  {p.cliente && <span className="font-normal text-ink-soft"> · {p.cliente}</span>}
                </span>
                <span className="font-mono font-semibold">{dinero(p.total)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                <span className={`pill ${COCINA[p.cocina].c}`}>{COCINA[p.cocina].t}</span>
                {p.pagado ? <span className="pill bg-ok-bg text-ok">Cobrado {p.folio}</span> : <span className="pill bg-danger-bg text-danger">Por cobrar</span>}
                {p.salioEn && <span className="pill bg-info-bg text-info">En camino{p.courier ? ` · ${p.courier}` : ""}</span>}
                <span>· {dayjs(p.desde).format("HH:mm")}</span>
              </div>
              {delivery && (
                <div className="mt-1 text-[12px] text-ink-soft">
                  📍 {p.direccion} · 📞 {p.telefono}
                </div>
              )}
            </button>
            <div className="mt-2 flex gap-2">
              {!p.pagado && (
                <Button type="primary" icon={<TbCash />} onClick={() => onCobrar(p.id)}>
                  Cobrar
                </Button>
              )}
              {delivery && !p.salioEn && onSalio && (
                <Button icon={<TbBike />} onClick={() => onSalio(p.id)}>
                  Salió
                </Button>
              )}
              {p.pagado && (
                <Button type={p.cocina === "listo" ? "primary" : "default"} onClick={() => onEntregar(p.id)}>
                  Entregado
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevoDeliveryModal({
  api,
  abierto,
  simbolo,
  onClose,
  onListo,
}: {
  api: AxiosInstance;
  abierto: boolean;
  simbolo: string;
  onClose: () => void;
  onListo: (d: Destino) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [envio, setEnvio] = useState<number | null>(null);
  const [sugeridos, setSugeridos] = useState<{ id: number; name: string; phone: string; address: string | null }[]>([]);
  useEffect(() => {
    if (!abierto) return;
    setNombre("");
    setTelefono("");
    setDireccion("");
    setEnvio(null);
    setSugeridos([]);
  }, [abierto]);

  const buscar = async (q: string) => {
    if (q.replace(/\D/g, "").length < 3 && q.trim().length < 3) return setSugeridos([]);
    try {
      const { data } = await api.get("/customers", { params: { q } });
      setSugeridos(data.data);
    } catch {
      setSugeridos([]);
    }
  };

  const valido = Boolean(nombre.trim() && telefono.trim() && direccion.trim());
  return (
    <Modal
      open={abierto}
      title="Nuevo delivery"
      okText="Tomar pedido"
      okButtonProps={{ disabled: !valido }}
      onCancel={onClose}
      onOk={() =>
        onListo({
          tipo: "nueva",
          key: `n${Date.now()}`,
          service: "delivery",
          nombre: `Delivery · ${nombre.trim()}`,
          alias: nombre.trim(),
          customerName: nombre.trim(),
          customerPhone: telefono.trim(),
          deliveryAddress: direccion.trim(),
          shippingCost: envio ?? 0,
        })
      }
    >
      <div className="space-y-3">
        <AutoComplete
          className="w-full"
          value={telefono}
          options={sugeridos.map((c) => ({ value: String(c.id), label: `${c.phone} · ${c.name}${c.address ? ` · ${c.address}` : ""}` }))}
          onSearch={(v) => {
            setTelefono(v);
            void buscar(v);
          }}
          onSelect={(id) => {
            const c = sugeridos.find((x) => String(x.id) === id);
            if (!c) return;
            setTelefono(c.phone);
            setNombre(c.name);
            setDireccion(c.address ?? "");
          }}
        >
          <Input inputMode="tel" placeholder="Teléfono (busca clientes anteriores)" />
        </AutoComplete>
        <Input placeholder="Nombre del cliente" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input.TextArea rows={2} placeholder="Dirección y referencia" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <InputNumber className="w-full" min={0} prefix={simbolo} placeholder="Costo de envío" value={envio} onChange={(v) => setEnvio(v === null ? null : Number(v))} />
      </div>
    </Modal>
  );
}

function AbrirMesaModal({
  abierto,
  titulo,
  onClose,
  onAbrir,
}: {
  abierto: boolean;
  titulo: string;
  onClose: () => void;
  onAbrir: (personas: number) => void;
}) {
  const [otro, setOtro] = useState<number | null>(null);
  useEffect(() => setOtro(null), [abierto]);
  if (!abierto) return null;
  return (
    <Modal open title={titulo} footer={null} onCancel={onClose} width={360}>
      <p className="mb-3 text-[13px] text-muted">¿Cuántas personas?</p>
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <Button key={n} size="large" onClick={() => onAbrir(n)}>
            {n}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <InputNumber className="flex-1" min={1} max={99} placeholder="Más" value={otro} onChange={(v) => setOtro(v ? Number(v) : null)} />
        <Button type="primary" disabled={!otro} onClick={() => otro && onAbrir(otro)}>
          Abrir
        </Button>
      </div>
    </Modal>
  );
}

/** Cobro sin entrar a la cuenta (para llevar "Enviar y cobrar", o desde la lista). */
function CobroDirecto({
  api,
  orderId,
  dinero,
  accion,
  descuentoMax,
  onClose,
}: {
  api: AxiosInstance;
  orderId: number;
  dinero: (n: number) => string;
  accion: Accion;
  descuentoMax: number;
  onClose: () => void;
}) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  useEffect(() => {
    api
      .get(`/accounts/${orderId}`)
      .then(({ data }) => setCuenta(data.data))
      .catch((e) => {
        message.error(mensajeError(e));
        onClose();
      });
  }, [api, orderId, onClose]);
  if (!cuenta) return null;
  return <CobrarModal api={api} cuenta={cuenta} dinero={dinero} accion={accion} descuentoMax={descuentoMax} onClose={onClose} onCobrada={onClose} />;
}

// --------------------------------------------------------------------- cuenta

function VistaCuenta({
  api,
  yo,
  orderId,
  mesas,
  dinero,
  accion,
  pendientes,
  onAgregar,
  onCerrada,
}: {
  api: AxiosInstance;
  yo: Yo;
  orderId: number;
  mesas: Mesa[];
  dinero: (n: number) => string;
  accion: Accion;
  pendientes: ComandaPendiente[];
  onAgregar: (c: Cuenta) => void;
  onCerrada: () => void;
}) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [item, setItem] = useState<ItemCuenta | null>(null);
  const [modo, setModo] = useState<"anular" | "cortesia" | null>(null);
  const [cobrar, setCobrar] = useState(false);
  const [mover, setMover] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [asignar, setAsignar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get(`/accounts/${orderId}`);
      setCuenta(data.data);
    } catch (e) {
      const err = e as { response?: { status: number } };
      if (err.response?.status === 422) {
        message.error(mensajeError(e));
        onCerrada();
      }
    }
  }, [api, orderId, onCerrada]);

  usePolling(cargar, 8000);

  if (!cuenta) return <Spin />;
  // Recién cobrada: se deja el modal abierto para mostrar el vuelto.
  if (cuenta.status !== "abierta" && !cobrar) {
    return (
      <Empty description={cuenta.status === "entregado" ? `Cuenta cobrada · ${cuenta.folio ?? ""}` : "Cuenta cerrada"}>
        <Button onClick={onCerrada}>Volver</Button>
      </Empty>
    );
  }

  const impresa = cuenta.accountStatus === "impresa";
  const tras = async <T,>(p: Promise<T | null>) => {
    const r = await p;
    if (r !== null) await cargar();
    return r;
  };

  const rondas = cuenta.rondas.map((r) => ({ ...r, items: cuenta.items.filter((i) => i.roundId === r.id) }));

  const menuMas = [
    { key: "cliente", icon: <TbUser />, label: cuenta.cliente ? "Cambiar cliente" : "Asignar cliente" },
    { key: "mover", icon: <TbArrowsExchange />, label: cuenta.mesa.id ? "Cambiar de mesa" : "Asignar mesa" },
    ...(cuenta.mesa.id && impresa ? [{ key: "liberar", icon: <TbLockOpen />, label: "Liberar mesa (paga en caja)" }] : []),
    { key: "cancelar", icon: <TbX />, label: "Cancelar cuenta", danger: true },
  ];

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[16px] font-bold text-ink">{cuenta.etiqueta}</span>
          {cuenta.cliente && <span className="text-[14px] text-ink-soft">· {cuenta.cliente}</span>}
          <span className="pill bg-brand-50 text-brand-600">{NOMBRE_SERVICIO[cuenta.service]}</span>
          {impresa && <span className="pill bg-warn-bg text-warn">Cuenta impresa · {cuenta.folio}</span>}
          {cuenta.accountStatus === "reabierta" && <span className="pill bg-info-bg text-info">Reabierta · {cuenta.folio}</span>}
          <span className="ml-auto font-mono text-[22px] font-bold text-ink">{dinero(cuenta.total)}</span>
        </div>
        <div className="mt-1 text-[12.5px] text-muted">
          {cuenta.mesero ? `Atiende ${cuenta.mesero} · ` : ""}desde {dayjs(cuenta.abiertaDesde).format("HH:mm")}
          {cuenta.guests ? ` · ${cuenta.guests} pers.` : ""}
          {cuenta.service === "delivery" && (
            <span className="block">
              📞 {cuenta.customerPhone} · 📍 {cuenta.deliveryAddress}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {rondas.map((r) => (
          <div key={r.id} className="card p-3">
            <div className="mb-2 flex items-center text-[11.5px] font-semibold uppercase tracking-wide text-muted">
              <span className="flex-1">
                Ronda {r.number} · {dayjs(r.createdAt).format("HH:mm")} {r.userName ? `· ${r.userName}` : ""}
              </span>
              {r.items.some((i) => !i.voided && i.kitchenStatus === "listo") && (
                <Button
                  size="small"
                  type="primary"
                  className="!bg-ok"
                  onClick={() =>
                    tras(
                      accion(
                        () => api.post("/items/serve", { ids: r.items.filter((i) => !i.voided && i.kitchenStatus === "listo").map((i) => i.id) }),
                        "Marcado como servido"
                      )
                    )
                  }
                >
                  Servido
                </Button>
              )}
              <Button
                size="small"
                type="text"
                icon={<TbPrinter />}
                onClick={() => accion((pin) => api.post(`/rounds/${r.id}/reprint`, {}, conPin(pin)), "Comanda reenviada")}
              >
                Reimprimir
              </Button>
            </div>
            {r.items.map((i) => (
              <button
                key={i.id}
                disabled={i.voided || impresa}
                onClick={() => setItem(i)}
                className={`flex w-full items-start gap-2 border-t border-line-soft py-2 text-left first:border-0 ${
                  i.voided ? "opacity-50" : ""
                }`}
              >
                <span className="w-7 font-bold">{i.quantity}×</span>
                <span className="flex-1">
                  <span className={i.voided ? "line-through" : ""}>{i.name}</span>
                  {i.modifiers.length > 0 && <span className="block text-[12px] text-muted">{i.modifiers.map((m) => m.name).join(", ")}</span>}
                  {i.note && <span className="block text-[12px] text-warn">📝 {i.note}</span>}
                  {i.voided && <span className="block text-[12px] text-danger">Anulado: {i.voidReason}</span>}
                  {i.courtesy && <span className="block text-[12px] text-ok">🎁 {i.courtesyReason}</span>}
                  {i.area && !i.voided && <span className="block text-[11px] text-muted">→ {i.area}</span>}
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[13px]">{dinero(i.lineTotal)}</span>
                  {!i.voided && i.kitchenStatus && <EstadoCocina estado={i.kitchenStatus} />}
                </span>
              </button>
            ))}
          </div>
        ))}
        {pendientes.length > 0 && (
          <div className="rounded-xl border border-dashed border-warn p-3 text-[13px] text-warn">
            ⏳ {pendientes.length} comanda(s) por enviar a esta cuenta
          </div>
        )}
        <p className="text-center text-[12px] text-muted">
          {impresa
            ? "La cuenta está impresa: para agregar o quitar platos, reábrela."
            : "Toca un plato para anularlo o darlo de cortesía."}
        </p>
      </div>

      {/* Acciones fijas abajo, al alcance del pulgar */}
      <div className="sticky bottom-0 z-20 -mx-1 mt-4 rounded-t-2xl border-t border-line bg-white/95 p-3 shadow-[0_-4px_16px_rgba(20,18,67,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2">
          {impresa ? (
            <Button
              size="large"
              className="flex-1"
              icon={<TbLockOpen />}
              onClick={() => tras(accion((pin) => api.post(`/accounts/${cuenta.id}/reopen`, {}, conPin(pin)), "Cuenta reabierta"))}
            >
              Reabrir
            </Button>
          ) : (
            <Button size="large" className="flex-1" icon={<TbPlus />} onClick={() => onAgregar(cuenta)}>
              Agregar
            </Button>
          )}
          <Button
            size="large"
            className="flex-1"
            icon={<TbPrinter />}
            onClick={() =>
              tras(
                accion(
                  (pin) => api.post(`/accounts/${cuenta.id}/print`, {}, conPin(pin)),
                  impresa ? "Cuenta reimpresa (mismo folio)" : "Cuenta impresa con folio"
                )
              )
            }
          >
            {impresa ? "Reimprimir" : "Imprimir cuenta"}
          </Button>
          <Button size="large" type="primary" className="flex-1" icon={<TbCash />} onClick={() => setCobrar(true)}>
            Cobrar
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: menuMas,
              onClick: ({ key }) => {
                if (key === "mover") setMover(true);
                if (key === "cliente") setAsignar(true);
                if (key === "cancelar") setCancelar(true);
                if (key === "liberar" && cuenta.mesa.id) {
                  void accion(
                    (pin) => api.post(`/tables/${cuenta.mesa.id}/release`, {}, conPin(pin)),
                    "Mesa liberada: la cuenta sigue en Cuentas"
                  ).then((r) => r !== null && onCerrada());
                }
              },
            }}
          >
            <Button size="large" icon={<TbDots />} />
          </Dropdown>
        </div>
      </div>

      {/* Plato: anular o cortesía */}
      <Modal open={Boolean(item) && !modo} title={item?.name} footer={null} onCancel={() => setItem(null)} width={340}>
        <div className="grid gap-2">
          <Button size="large" danger icon={<TbTrash />} onClick={() => setModo("anular")}>
            Anular
          </Button>
          <Button size="large" icon={<TbGift />} disabled={item?.courtesy} onClick={() => setModo("cortesia")}>
            Cortesía (sin costo)
          </Button>
        </div>
      </Modal>
      <MotivoModal
        abierto={Boolean(item && modo)}
        item={item}
        titulo={modo === "cortesia" ? "Cortesía" : "Anular"}
        motivos={
          modo === "cortesia"
            ? ["Cliente frecuente", "Demora en el pedido", "Cumpleaños", "Compensación"]
            : ["Cliente cambió de opinión", "Error al comandar", "Demora", "Producto agotado"]
        }
        peligro={modo === "anular"}
        onClose={() => {
          setModo(null);
          setItem(null);
        }}
        onConfirmar={async (reason, quantity) => {
          if (!item || !modo) return;
          const r = await tras(
            accion(
              (pin) => api.post(`/items/${item.id}/${modo === "anular" ? "void" : "courtesy"}`, { reason, quantity }, conPin(pin)),
              modo === "anular" ? "Anulado. Se avisó a su área." : "Cortesía aplicada"
            )
          );
          if (r !== null) {
            setModo(null);
            setItem(null);
          }
        }}
      />

      {cobrar && (
        <CobrarModal
          api={api}
          cuenta={cuenta}
          dinero={dinero}
          accion={accion}
          descuentoMax={Number(yo.permisos["cobro.descuento"] ?? 0)}
          onClose={() => setCobrar(false)}
          onCobrada={onCerrada}
        />
      )}

      <Modal open={mover} title={cuenta.mesa.id ? "Cambiar a otra mesa" : "Asignar mesa"} footer={null} onCancel={() => setMover(false)}>
        <div className="grid grid-cols-4 gap-2">
          {mesas
            .filter((m) => m.estado === "libre")
            .map((m) => (
              <Button
                key={m.id}
                size="large"
                onClick={async () => {
                  const r = await accion((pin) => api.post(`/accounts/${cuenta.id}/move`, { tableId: m.id }, conPin(pin)), `Ahora en la mesa ${m.name}`);
                  if (r !== null) {
                    setMover(false);
                    void cargar();
                  }
                }}
              >
                {m.name}
              </Button>
            ))}
        </div>
      </Modal>

      <AsignarClienteModal
        api={api}
        abierto={asignar}
        onClose={() => setAsignar(false)}
        onGuardar={async (datos) => {
          const r = await accion(() => api.post(`/accounts/${cuenta.id}/customer`, datos), "Cliente asignado");
          if (r !== null) {
            setAsignar(false);
            void cargar();
          }
        }}
      />

      <MotivoModal
        abierto={cancelar}
        item={null}
        titulo="Cancelar toda la cuenta"
        texto="Se anulan todos los platos, cada área recibe el aviso y caja un comprobante. No se cobra nada."
        motivos={["Cliente se retiró", "Error al abrir la cuenta", "Cuenta duplicada"]}
        peligro
        onClose={() => setCancelar(false)}
        onConfirmar={async (reason) => {
          const r = await accion((pin) => api.post(`/accounts/${cuenta.id}/cancel`, { reason }, conPin(pin)), "Cuenta cancelada");
          if (r !== null) {
            setCancelar(false);
            onCerrada();
          }
        }}
      />
    </div>
  );
}

const COCINA: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "En cola", clase: "bg-line-soft text-muted" },
  preparando: { texto: "Preparando", clase: "bg-warn-bg text-warn" },
  listo: { texto: "🔔 Listo", clase: "bg-ok-bg text-ok" },
  servido: { texto: "Servido", clase: "bg-line-soft text-muted" },
};

function EstadoCocina({ estado }: { estado: string }) {
  const e = COCINA[estado];
  return e ? <span className={`pill mt-0.5 inline-block text-[10.5px] ${e.clase}`}>{e.texto}</span> : null;
}

function AsignarClienteModal({
  api,
  abierto,
  onClose,
  onGuardar,
}: {
  api: AxiosInstance;
  abierto: boolean;
  onClose: () => void;
  onGuardar: (d: { customerId?: number; name?: string; phone?: string }) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [sugeridos, setSugeridos] = useState<{ id: number; name: string; phone: string }[]>([]);
  useEffect(() => {
    setQ("");
    setNombre("");
    setTelefono("");
    setSugeridos([]);
  }, [abierto]);
  useEffect(() => {
    if (q.trim().length < 3) return setSugeridos([]);
    const t = setTimeout(() => {
      api
        .get("/customers", { params: { q } })
        .then(({ data }) => setSugeridos(data.data))
        .catch(() => setSugeridos([]));
    }, 250);
    return () => clearTimeout(t);
  }, [api, q]);
  return (
    <Modal
      open={abierto}
      title="Cliente de la cuenta"
      okText="Guardar nuevo"
      okButtonProps={{ disabled: !nombre.trim() }}
      onCancel={onClose}
      onOk={() => onGuardar({ name: nombre.trim(), phone: telefono.trim() || undefined })}
    >
      <Input allowClear prefix={<TbSearch />} placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-2 space-y-1">
        {sugeridos.map((c) => (
          <button
            key={c.id}
            onClick={() => onGuardar({ customerId: c.id })}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-brand-50"
          >
            <TbUser className="text-muted" />
            <span className="flex-1">{c.name}</span>
            <span className="font-mono text-[12px] text-muted">{c.phone}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">O uno nuevo</div>
        <div className="flex gap-2">
          <Input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input inputMode="tel" placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function MotivoModal({
  abierto,
  item,
  titulo,
  texto,
  motivos,
  peligro,
  onClose,
  onConfirmar,
}: {
  abierto: boolean;
  item: ItemCuenta | null;
  titulo: string;
  texto?: string;
  motivos: string[];
  peligro?: boolean;
  onClose: () => void;
  onConfirmar: (motivo: string, cantidad?: number) => Promise<void>;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    setCantidad(item?.quantity ?? 1);
    setMotivo("");
  }, [item, abierto]);
  return (
    <Modal
      open={abierto}
      title={item ? `${titulo}: ${item.name}` : titulo}
      okText="Confirmar"
      okButtonProps={{ danger: peligro, disabled: !motivo.trim(), loading: cargando }}
      onCancel={onClose}
      onOk={async () => {
        setCargando(true);
        try {
          await onConfirmar(motivo.trim(), item ? cantidad : undefined);
        } finally {
          setCargando(false);
        }
      }}
    >
      {texto && <p className="mb-3 text-muted">{texto}</p>}
      {item && item.quantity > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <span>Cantidad</span>
          <InputNumber min={1} max={item.quantity} value={cantidad} onChange={(v) => setCantidad(Number(v) || 1)} />
          <span className="text-muted">de {item.quantity}</span>
        </div>
      )}
      <div className="mb-2 flex flex-wrap gap-1">
        {motivos.map((m) => (
          <Button key={m} size="small" type={motivo === m ? "primary" : "default"} onClick={() => setMotivo(m)}>
            {m}
          </Button>
        ))}
      </div>
      <Input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
    </Modal>
  );
}

// ---------------------------------------------------------------------- cobro

function CobrarModal({
  api,
  cuenta,
  dinero,
  accion,
  descuentoMax,
  onClose,
  onCobrada,
}: {
  api: AxiosInstance;
  cuenta: Cuenta;
  dinero: (n: number) => string;
  accion: Accion;
  descuentoMax: number;
  onClose: () => void;
  onCobrada: () => void;
}) {
  const [descuento, setDescuento] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [pagos, setPagos] = useState<{ method: string; amount: number | null }[]>([{ method: "efectivo", amount: null }]);
  const [cargando, setCargando] = useState(false);
  const [hecho, setHecho] = useState<Cuenta | null>(null);

  const total = r2(cuenta.total - (cuenta.total * descuento) / 100);
  const pagado = r2(pagos.reduce((t, p) => t + Number(p.amount ?? 0), 0));
  const falta = r2(total - pagado);

  const confirmar = async () => {
    setCargando(true);
    const r = await accion((pin) =>
      api.post(
        `/accounts/${cuenta.id}/pay`,
        { discountPercentage: descuento, discountReason: motivo, payments: pagos.filter((p) => Number(p.amount) > 0) },
        conPin(pin)
      )
    );
    setCargando(false);
    if (r) setHecho((r as { data: { data: Cuenta } }).data.data);
  };

  if (hecho) {
    return (
      <Modal open title="Cuenta cobrada" onCancel={onCobrada} footer={<Button type="primary" onClick={onCobrada}>Listo</Button>}>
        <div className="py-4 text-center">
          <div className="text-[13px] text-muted">Nota de venta {hecho.folio}</div>
          <div className="mt-1 font-mono text-[28px] font-bold">{dinero(hecho.total)}</div>
          {Number(hecho.vuelto) > 0 && (
            <div className="mt-3 rounded-xl bg-ok-bg py-3 text-[18px] font-bold text-ok">Vuelto: {dinero(Number(hecho.vuelto))}</div>
          )}
          <p className="mt-3 text-[12.5px] text-muted">El ticket salió a la impresora de caja.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={`Cobrar · ${cuenta.etiqueta}`}
      onCancel={onClose}
      okText={falta > 0.009 ? `Falta ${dinero(falta)}` : "Cobrar y cerrar"}
      okButtonProps={{ disabled: falta > 0.009 || (descuento > 0 && !motivo.trim()), loading: cargando }}
      onOk={confirmar}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-muted">Total {cuenta.folio ? `· ${cuenta.folio}` : ""}</span>
        <span className="font-mono text-[26px] font-bold">{dinero(total)}</span>
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-[13px]">Descuento %</span>
        <InputNumber min={0} max={100} value={descuento} onChange={(v) => setDescuento(Number(v) || 0)} />
        <span className="text-[11.5px] text-muted">{descuentoMax > 0 ? `Tu máximo: ${descuentoMax}%` : "Requiere autorización"}</span>
      </div>
      {descuento > 0 && <Input className="mb-1" placeholder="Motivo del descuento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      <div className="mt-3" />
      {pagos.map((p, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <Select className="w-36" value={p.method} options={METODOS} onChange={(v) => setPagos(pagos.map((x, j) => (j === i ? { ...x, method: v } : x)))} />
          <InputNumber
            className="flex-1"
            min={0}
            step={1}
            placeholder={String(Math.max(0, falta + Number(p.amount ?? 0)).toFixed(2))}
            value={p.amount}
            onChange={(v) => setPagos(pagos.map((x, j) => (j === i ? { ...x, amount: v === null ? null : Number(v) } : x)))}
          />
          <Button onClick={() => setPagos(pagos.map((x, j) => (j === i ? { ...x, amount: r2(Math.max(0, falta + Number(x.amount ?? 0))) } : x)))}>
            Exacto
          </Button>
          {pagos.length > 1 && <Button icon={<TbTrash />} onClick={() => setPagos(pagos.filter((_, j) => j !== i))} />}
        </div>
      ))}
      <Button type="dashed" block icon={<TbPlus />} onClick={() => setPagos([...pagos, { method: "yape", amount: null }])}>
        Pagar con otro método (dividir)
      </Button>
      {pagado > total && <div className="mt-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok">Vuelto: {dinero(r2(pagado - total))}</div>}
    </Modal>
  );
}

// ------------------------------------------------------------------- comandar

function Comandar({
  carta,
  dinero,
  destino,
  carrito,
  setCarrito,
  comensales,
  setComensales,
  nombre,
  setNombre,
  onEnviar,
}: {
  carta: Carta | null;
  dinero: (n: number) => string;
  destino: Destino;
  carrito: LineaCarrito[];
  setCarrito: (l: LineaCarrito[]) => void;
  comensales: number | null;
  setComensales: (n: number | null) => void;
  nombre: string;
  setNombre: (t: string) => void;
  /** `cobrar`: manda la comanda y abre el cobro al toque. */
  onEnviar: (cobrar?: boolean) => void;
}) {
  const [cat, setCat] = useState<number | null>(null);
  const [buscar, setBuscar] = useState("");
  const [elegir, setElegir] = useState<Plato | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);

  const platos = useMemo(() => {
    const q = plano(buscar.trim());
    return (carta?.platos ?? []).filter((p) => (!cat || p.categoryIds.includes(cat)) && (!q || plano(p.name).includes(q)));
  }, [carta, cat, buscar]);

  if (!carta) return <Spin />;

  const agregarSimple = (p: Plato) => {
    const i = carrito.findIndex((l) => l.productId === p.id && !l.options.length && !l.note);
    if (i >= 0) setCarrito(carrito.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l)));
    else setCarrito([...carrito, { key: nuevoId(), productId: p.id, name: p.name, price: p.price, quantity: 1, note: "", options: [] }]);
  };

  const cantidadDe = (id: number) => carrito.filter((l) => l.productId === id).reduce((t, l) => t + l.quantity, 0);
  const precioLinea = (l: LineaCarrito) => (l.price + l.options.reduce((s, o) => s + o.priceDelta * o.quantity, 0)) * l.quantity;
  const totalCarrito = carrito.reduce((t, l) => t + precioLinea(l), 0);
  const unidades = carrito.reduce((t, l) => t + l.quantity, 0);
  const sinMesa = destino.tipo === "nueva" && destino.service !== "comedor";
  const envio = destino.tipo === "nueva" ? Number(destino.shippingCost ?? 0) : 0;

  /** Líneas del ticket con +/− y nota: se usa en el panel de la derecha (PC) y en el cajón (celular). */
  const lineas = (
    <>
      {carrito.map((l, i) => (
        <div key={l.key} className="border-b border-line-soft py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[13.5px] font-semibold">{l.name}</span>
            <span className="font-mono text-[12.5px]">{dinero(precioLinea(l))}</span>
          </div>
          {l.options.length > 0 && <div className="text-[12px] text-muted">{l.options.map((o) => o.name).join(", ")}</div>}
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              size="small"
              icon={<TbMinus />}
              onClick={() =>
                setCarrito(l.quantity <= 1 ? carrito.filter((_, j) => j !== i) : carrito.map((x, j) => (j === i ? { ...x, quantity: x.quantity - 1 } : x)))
              }
            />
            <span className="w-6 text-center font-bold">{l.quantity}</span>
            <Button size="small" icon={<TbPlus />} onClick={() => setCarrito(carrito.map((x, j) => (j === i ? { ...x, quantity: x.quantity + 1 } : x)))} />
            <Input
              size="small"
              className="flex-1"
              placeholder="Nota para cocina"
              value={l.note}
              onChange={(e) => setCarrito(carrito.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
            />
          </div>
        </div>
      ))}
      {!carrito.length && <Empty className="my-6" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Toca los platos para agregarlos" />}
    </>
  );

  const botones = (bloque: boolean) =>
    sinMesa ? (
      <>
        <Button size="large" block={bloque} className={bloque ? "" : "flex-1"} disabled={!carrito.length} onClick={() => onEnviar(false)}>
          Solo enviar
        </Button>
        <Button size="large" block={bloque} type="primary" className={bloque ? "" : "flex-1"} icon={<TbCash />} disabled={!carrito.length} onClick={() => onEnviar(true)}>
          Enviar y cobrar
        </Button>
      </>
    ) : (
      <Button size="large" block={bloque} type="primary" className={bloque ? "" : "flex-1"} disabled={!carrito.length} onClick={() => onEnviar(false)}>
        Enviar comanda
      </Button>
    );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-4">
      <div>
        {(destino.tipo === "mesa" || (destino.tipo === "nueva" && destino.service === "comedor")) && (
          <div className="mb-3 flex items-center gap-2 text-[13px]">
            <span>Personas</span>
            <InputNumber min={1} max={99} value={comensales} onChange={(v) => setComensales(v ? Number(v) : null)} />
          </div>
        )}
        <Input allowClear size="large" prefix={<TbSearch />} placeholder="Buscar plato" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="mb-3" />
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto pb-1">
          <Button type={cat === null ? "primary" : "default"} shape="round" onClick={() => setCat(null)}>
            Todo
          </Button>
          {carta.categorias.map((c) => (
            <Button key={c.id} shape="round" type={cat === c.id ? "primary" : "default"} onClick={() => setCat(c.id)}>
              {c.name}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {platos.map((p) => {
            const n = cantidadDe(p.id);
            return (
              <button
                key={p.id}
                onClick={() => (p.modifierGroups.length ? setElegir(p) : agregarSimple(p))}
                className={`relative flex min-h-[76px] flex-col justify-between rounded-xl border-2 bg-white p-3 text-left transition active:scale-95 ${
                  n ? "border-brand-500" : "border-line"
                }`}
              >
                {n > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand-500 px-1 text-[12px] font-bold text-white">
                    {n}
                  </span>
                )}
                <span className="text-[13.5px] font-semibold leading-tight text-ink">{p.name}</span>
                <span className="mt-1 font-mono text-[12px] text-muted">
                  {dinero(p.price)}
                  {p.modifierGroups.length > 0 ? " · opciones" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PC / tablet ancha: el ticket siempre a la vista */}
      <aside className="hidden lg:block">
        <div className="card sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col p-4">
          <div className="mb-1 font-bold text-ink">{destino.nombre}</div>
          {destino.tipo === "nueva" && destino.service === "para_llevar" && (
            <Input className="mb-2" placeholder="Nombre del cliente (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          )}
          <div className="-mx-1 flex-1 overflow-y-auto px-1">{lineas}</div>
          <div className="mt-3 border-t border-line pt-3">
            {envio > 0 && (
              <div className="flex justify-between text-[13px] text-muted">
                <span>Envío</span>
                <span className="font-mono">{dinero(envio)}</span>
              </div>
            )}
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-muted">Total</span>
              <span className="font-mono text-[22px] font-bold">{dinero(totalCarrito + envio)}</span>
            </div>
            <div className="grid gap-2">{botones(true)}</div>
          </div>
        </div>
      </aside>

      {/* Celular: barra abajo y el ticket en un cajón */}
      {carrito.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-1 mt-4 rounded-t-2xl border-t border-line bg-white/95 p-3 shadow-[0_-4px_16px_rgba(20,18,67,0.06)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl gap-2">
            <Button size="large" className="flex-1" onClick={() => setVerCarrito(true)}>
              Ver ({unidades}) · {dinero(totalCarrito + envio)}
            </Button>
            {botones(false)}
          </div>
        </div>
      )}

      <OpcionesModal
        plato={elegir}
        dinero={dinero}
        onClose={() => setElegir(null)}
        onAgregar={(l) => {
          setCarrito([...carrito, l]);
          setElegir(null);
        }}
      />

      <Drawer open={verCarrito} placement="bottom" height="75vh" title={`Comanda · ${destino.nombre}`} onClose={() => setVerCarrito(false)}>
        {destino.tipo === "nueva" && destino.service === "para_llevar" && (
          <Input className="mb-2" placeholder="Nombre del cliente (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        )}
        {lineas}
      </Drawer>
    </div>
  );
}

function OpcionesModal({
  plato,
  dinero,
  onClose,
  onAgregar,
}: {
  plato: Plato | null;
  dinero: (n: number) => string;
  onClose: () => void;
  onAgregar: (l: LineaCarrito) => void;
}) {
  const [elegidas, setElegidas] = useState<Record<number, number>>({});
  const [nota, setNota] = useState("");
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    setElegidas({});
    setNota("");
    setCantidad(1);
  }, [plato]);

  if (!plato) return null;

  const enGrupo = (g: Plato["modifierGroups"][number]) => g.options.reduce((t, o) => t + (elegidas[o.id] ?? 0), 0);
  const faltan = plato.modifierGroups.filter((g) => enGrupo(g) < g.minSelect);

  const tocar = (g: Plato["modifierGroups"][number], id: number) => {
    const actual = elegidas[id] ?? 0;
    if (g.maxSelect === 1) {
      const nuevo = { ...elegidas };
      for (const o of g.options) delete nuevo[o.id];
      if (!actual) nuevo[id] = 1;
      return setElegidas(nuevo);
    }
    if (actual) {
      const nuevo = { ...elegidas };
      delete nuevo[id];
      return setElegidas(nuevo);
    }
    if (enGrupo(g) >= g.maxSelect) return message.info(`Máximo ${g.maxSelect} en ${g.name}`);
    setElegidas({ ...elegidas, [id]: 1 });
  };

  const opciones = plato.modifierGroups.flatMap((g) =>
    g.options.filter((o) => elegidas[o.id]).map((o) => ({ optionId: o.id, quantity: elegidas[o.id], name: o.name, priceDelta: o.priceDelta }))
  );

  return (
    <Modal
      open
      title={plato.name}
      onCancel={onClose}
      okText={faltan.length ? `Elige: ${faltan[0].name}` : "Agregar"}
      okButtonProps={{ disabled: faltan.length > 0 }}
      onOk={() => onAgregar({ key: nuevoId(), productId: plato.id, name: plato.name, price: plato.price, quantity: cantidad, note: nota, options: opciones })}
    >
      {plato.modifierGroups.map((g) => (
        <div key={g.groupId} className="mb-4">
          <div className="mb-2 text-[13px] font-semibold">
            {g.name}{" "}
            <span className="font-normal text-muted">
              {g.minSelect > 0 ? "(obligatorio)" : "(opcional)"} {g.maxSelect > 1 ? `· hasta ${g.maxSelect}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => (
              <Button key={o.id} type={elegidas[o.id] ? "primary" : "default"} onClick={() => tocar(g, o.id)}>
                {o.name}
                {o.priceDelta ? ` +${dinero(o.priceDelta)}` : ""}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <Input placeholder="Nota para cocina" value={nota} onChange={(e) => setNota(e.target.value)} className="mb-3" />
      <div className="flex items-center gap-2">
        <span>Cantidad</span>
        <InputNumber min={1} max={99} value={cantidad} onChange={(v) => setCantidad(Number(v) || 1)} />
      </div>
    </Modal>
  );
}
