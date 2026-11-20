import { useCallback, useEffect, useMemo, useState } from "react";
import type { AxiosInstance } from "axios";
import { Button, Drawer, Empty, Input, InputNumber, Modal, Select, Spin, message } from "antd";
import {
  TbArrowLeft,
  TbArrowsExchange,
  TbCash,
  TbCloudOff,
  TbLogout,
  TbMinus,
  TbPlus,
  TbPrinter,
  TbRefresh,
  TbSearch,
  TbTrash,
  TbX,
} from "react-icons/tb";
import dayjs from "dayjs";
import { usePolling } from "../hooks/usePolling";
import {
  mensajeError,
  type Carta,
  type Cuenta,
  type ItemCuenta,
  type LineaCarrito,
  type Mesa,
  type Plato,
  type Yo,
} from "./api";
import CajaPanel from "./CajaPanel";
import { descartar, encolarComanda, enviarPendientes, leerPendientes, nuevoId, type ComandaPendiente } from "./outbox";

interface Props {
  api: AxiosInstance;
  uuid: string;
  /** Botón de salir (solo personal). */
  onSalir?: () => void;
}

type Vista =
  | { tipo: "mesas" }
  | { tipo: "caja" }
  | { tipo: "mesa"; mesaId: number }
  | { tipo: "comandar"; mesaId: number };

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * PDV de salón: mesas → cuenta → comandar → cobrar. Es la misma pantalla
 * para el dueño (en el panel) y para las meseras (en su celular): lo que
 * cambia es lo que el backend les deja hacer (`puedeCobrar`).
 */
export default function SalonApp({ api, uuid, onSalir }: Props) {
  const [yo, setYo] = useState<Yo | null>(null);
  const [mesas, setMesas] = useState<Mesa[] | null>(null);
  const [carta, setCarta] = useState<Carta | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: "mesas" });
  const [pendientes, setPendientes] = useState<ComandaPendiente[]>(() => leerPendientes(uuid));
  const [sinRed, setSinRed] = useState(false);
  // Carrito por mesa: si la mesera sale a otra mesa, no pierde lo que iba armando.
  const [carritos, setCarritos] = useState<Record<number, LineaCarrito[]>>({});
  const [comensales, setComensales] = useState<Record<number, number | null>>({});

  const s = yo?.negocio.simbolo ?? "S/";
  const dinero = (n: number) => `${s} ${Number(n ?? 0).toFixed(2)}`;

  const cargarMesas = useCallback(async () => {
    try {
      const { data } = await api.get("/tables");
      setMesas(data.data);
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
      .then(({ data }) => setYo(data.data))
      .catch((e) => message.error(mensajeError(e)));
    void cargarCarta();
  }, [api, cargarCarta]);

  const refrescar = usePolling(cargarMesas, 6000);

  // Cola de comandas: se reintenta cada 5 s y en cuanto vuelve la señal.
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

  const mesaActual = vista.tipo === "mesa" || vista.tipo === "comandar" ? mesas?.find((m) => m.id === vista.mesaId) ?? null : null;

  const enviarComanda = async (mesa: Mesa) => {
    const items = carritos[mesa.id] ?? [];
    if (!items.length) return;
    encolarComanda(uuid, {
      clientRequestId: nuevoId(),
      tableId: mesa.id,
      tableName: mesa.name,
      guests: comensales[mesa.id] ?? null,
      items,
      createdAt: Date.now(),
    });
    setCarritos((c) => ({ ...c, [mesa.id]: [] }));
    setVista({ tipo: "mesa", mesaId: mesa.id });
    const n = await enviarPendientes(uuid, api);
    if (n > 0) message.success("Comanda enviada a cocina");
    else message.warning("Sin señal: la comanda se enviará sola al volver la conexión");
    refrescar();
  };

  if (!yo || !mesas) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spin />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-28">
      {/* Barra superior */}
      <div className="mb-4 flex items-center gap-2">
        {vista.tipo !== "mesas" && (
          <Button
            icon={<TbArrowLeft />}
            onClick={() =>
              setVista(vista.tipo === "comandar" ? { tipo: "mesa", mesaId: vista.mesaId } : { tipo: "mesas" })
            }
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-bold text-ink">
            {vista.tipo === "mesas" ? "Mesas" : vista.tipo === "caja" ? "Caja" : `Mesa ${mesaActual?.name ?? ""}`}
          </div>
          <div className="truncate text-[12px] text-muted">
            {yo.name} · {yo.negocio.name}
          </div>
        </div>
        {yo.puedeCobrar && vista.tipo === "mesas" && (
          <Button icon={<TbCash />} onClick={() => setVista({ tipo: "caja" })}>
            Caja
          </Button>
        )}
        <Button icon={<TbRefresh />} onClick={() => { refrescar(); void cargarCarta(); }} />
        {onSalir && <Button icon={<TbLogout />} onClick={onSalir}>Salir</Button>}
      </div>

      {(sinRed || pendientes.length > 0) && (
        <BannerPendientes
          sinRed={sinRed}
          pendientes={pendientes}
          onReintentar={vaciarCola}
          onDescartar={(id) => descartar(uuid, id)}
        />
      )}

      {vista.tipo === "mesas" && (
        <GrillaMesas
          mesas={mesas}
          pendientes={pendientes}
          dinero={dinero}
          onElegir={(m) => setVista(m.cuenta ? { tipo: "mesa", mesaId: m.id } : { tipo: "comandar", mesaId: m.id })}
        />
      )}

      {vista.tipo === "caja" && (
        <CajaPanel api={api} simbolo={s} esDueno={yo.role === "dueno"} />
      )}

      {vista.tipo === "mesa" && mesaActual && (
        <VistaCuenta
          api={api}
          yo={yo}
          mesa={mesaActual}
          mesas={mesas}
          dinero={dinero}
          pendientes={pendientes.filter((p) => p.tableId === mesaActual.id)}
          onAgregar={() => setVista({ tipo: "comandar", mesaId: mesaActual.id })}
          onCambio={refrescar}
          onCerrada={() => {
            setVista({ tipo: "mesas" });
            refrescar();
          }}
        />
      )}

      {vista.tipo === "comandar" && mesaActual && (
        <Comandar
          carta={carta}
          dinero={dinero}
          mesa={mesaActual}
          carrito={carritos[mesaActual.id] ?? []}
          setCarrito={(l) => setCarritos((c) => ({ ...c, [mesaActual.id]: l }))}
          comensales={comensales[mesaActual.id] ?? null}
          setComensales={(n) => setComensales((c) => ({ ...c, [mesaActual.id]: n }))}
          onEnviar={() => enviarComanda(mesaActual)}
        />
      )}
    </div>
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
            ⏳ Mesa {p.tableName}: {p.items.reduce((t, l) => t + l.quantity, 0)} platos ·{" "}
            {dayjs(p.createdAt).format("HH:mm")}
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
  if (!mesas.length) {
    return <Empty description="Aún no hay mesas. El dueño las crea en Salón → Configuración." />;
  }
  const zonas = [...new Set(mesas.map((m) => m.zone ?? ""))];
  return (
    <div className="space-y-5">
      {zonas.map((z) => (
        <div key={z}>
          {z && <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{z}</div>}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {mesas
              .filter((m) => (m.zone ?? "") === z)
              .map((m) => {
                const ocupada = Boolean(m.cuenta);
                const espera = pendientes.some((p) => p.tableId === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => onElegir(m)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition active:scale-95 ${
                      ocupada
                        ? "border-brand-500 bg-brand-500 text-white shadow-md"
                        : "border-line bg-white text-ink"
                    }`}
                  >
                    {espera && <span className="absolute right-2 top-1 text-[14px]">⏳</span>}
                    <span className="text-[22px] font-bold leading-none">{m.name}</span>
                    {ocupada ? (
                      <>
                        <span className="mt-1 font-mono text-[12px]">{dinero(m.cuenta!.total)}</span>
                        <span className="text-[10.5px] opacity-80">
                          {dayjs(m.cuenta!.abiertaDesde).format("HH:mm")}
                          {m.cuenta!.mesero ? ` · ${m.cuenta!.mesero}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="mt-1 text-[11px] text-muted">Libre</span>
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

// --------------------------------------------------------------------- cuenta

function VistaCuenta({
  api,
  yo,
  mesa,
  mesas,
  dinero,
  pendientes,
  onAgregar,
  onCambio,
  onCerrada,
}: {
  api: AxiosInstance;
  yo: Yo;
  mesa: Mesa;
  mesas: Mesa[];
  dinero: (n: number) => string;
  pendientes: ComandaPendiente[];
  onAgregar: () => void;
  onCambio: () => void;
  onCerrada: () => void;
}) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [anular, setAnular] = useState<ItemCuenta | null>(null);
  const [cobrar, setCobrar] = useState(false);
  const [mover, setMover] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const cuentaId = mesa.cuenta?.id;

  const cargar = useCallback(async () => {
    if (!cuentaId) return setCuenta(null);
    try {
      const { data } = await api.get(`/accounts/${cuentaId}`);
      setCuenta(data.data);
    } catch {
      // se reintenta con el sondeo
    }
  }, [api, cuentaId]);

  usePolling(cargar, 8000);
  // Al llegar una ronda nueva (cambia el total de la mesa) se recarga al instante.
  useEffect(() => {
    void cargar();
  }, [cargar, mesa.cuenta?.total, mesa.cuenta?.items]);

  if (!cuentaId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted">
          {pendientes.length ? "La comanda está por enviarse…" : "Mesa libre."}
        </p>
        <Button type="primary" size="large" className="mt-4" icon={<TbPlus />} onClick={onAgregar}>
          Tomar pedido
        </Button>
      </div>
    );
  }
  if (!cuenta) return <Spin />;

  const precuenta = async () => {
    setOcupado(true);
    try {
      await api.post(`/accounts/${cuenta.id}/pre-bill`);
      message.success("Precuenta enviada a la impresora de caja");
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const rondas = cuenta.rondas.map((r) => ({
    ...r,
    items: cuenta.items.filter((i) => i.roundId === r.id),
  }));

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">
            Cuenta {cuenta.code} · desde {dayjs(cuenta.abiertaDesde).format("HH:mm")}
            {cuenta.guests ? ` · ${cuenta.guests} pers.` : ""}
          </span>
          <span className="font-mono text-[22px] font-bold text-ink">{dinero(cuenta.total)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {rondas.map((r) => (
          <div key={r.id} className="card p-3">
            <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
              Ronda {r.number} · {dayjs(r.createdAt).format("HH:mm")} {r.userName ? `· ${r.userName}` : ""}
            </div>
            {r.items.map((i) => (
              <button
                key={i.id}
                disabled={i.voided || !yo.puedeCobrar}
                onClick={() => setAnular(i)}
                className={`flex w-full items-start gap-2 border-t border-line-soft py-2 text-left first:border-0 ${
                  i.voided ? "opacity-50" : ""
                }`}
              >
                <span className="w-7 font-bold">{i.quantity}×</span>
                <span className="flex-1">
                  <span className={i.voided ? "line-through" : ""}>{i.name}</span>
                  {i.modifiers.length > 0 && (
                    <span className="block text-[12px] text-muted">{i.modifiers.map((m) => m.name).join(", ")}</span>
                  )}
                  {i.note && <span className="block text-[12px] text-warn">📝 {i.note}</span>}
                  {i.voided && <span className="block text-[12px] text-danger">Anulado: {i.voidReason}</span>}
                  {i.area && !i.voided && <span className="block text-[11px] text-muted">→ {i.area}</span>}
                </span>
                <span className="font-mono text-[13px]">{dinero(i.lineTotal)}</span>
              </button>
            ))}
          </div>
        ))}
        {pendientes.length > 0 && (
          <div className="rounded-xl border border-dashed border-warn p-3 text-[13px] text-warn">
            ⏳ {pendientes.length} comanda(s) por enviar a esta mesa
          </div>
        )}
      </div>

      {yo.puedeCobrar && (
        <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
          <Button icon={<TbArrowsExchange />} onClick={() => setMover(true)}>
            Mover de mesa
          </Button>
          <Button danger icon={<TbX />} onClick={() => setCancelar(true)}>
            Cancelar cuenta
          </Button>
          <span className="self-center text-muted">Toca un plato para anularlo.</span>
        </div>
      )}

      {/* Acciones fijas abajo, al alcance del pulgar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button size="large" className="flex-1" icon={<TbPlus />} type={yo.puedeCobrar ? "default" : "primary"} onClick={onAgregar}>
            Agregar
          </Button>
          <Button size="large" className="flex-1" icon={<TbPrinter />} loading={ocupado} onClick={precuenta}>
            Precuenta
          </Button>
          {yo.puedeCobrar && (
            <Button size="large" type="primary" className="flex-1" icon={<TbCash />} onClick={() => setCobrar(true)}>
              Cobrar
            </Button>
          )}
        </div>
      </div>

      <AnularModal
        api={api}
        item={anular}
        onClose={() => setAnular(null)}
        onHecho={() => {
          setAnular(null);
          void cargar();
          onCambio();
        }}
      />
      {cobrar && (
        <CobrarModal
          api={api}
          cuenta={cuenta}
          dinero={dinero}
          onClose={() => setCobrar(false)}
          onCobrada={onCerrada}
        />
      )}
      <Modal
        open={mover}
        title="Mover a otra mesa"
        footer={null}
        onCancel={() => setMover(false)}
      >
        <div className="grid grid-cols-4 gap-2">
          {mesas
            .filter((m) => !m.cuenta)
            .map((m) => (
              <Button
                key={m.id}
                size="large"
                onClick={async () => {
                  try {
                    await api.post(`/accounts/${cuenta.id}/move`, { tableId: m.id });
                    message.success(`Cuenta pasada a la mesa ${m.name}`);
                    setMover(false);
                    onCerrada();
                  } catch (e) {
                    message.error(mensajeError(e));
                  }
                }}
              >
                {m.name}
              </Button>
            ))}
        </div>
      </Modal>
      <MotivoModal
        open={cancelar}
        titulo="Cancelar toda la cuenta"
        texto="Se anulan todos los platos y la mesa queda libre. No se cobra nada."
        onClose={() => setCancelar(false)}
        onConfirmar={async (motivo) => {
          await api.post(`/accounts/${cuenta.id}/cancel`, { reason: motivo });
          message.success("Cuenta cancelada");
          setCancelar(false);
          onCerrada();
        }}
      />
    </div>
  );
}

function MotivoModal({
  open,
  titulo,
  texto,
  onClose,
  onConfirmar,
}: {
  open: boolean;
  titulo: string;
  texto: string;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  return (
    <Modal
      open={open}
      title={titulo}
      okText="Confirmar"
      okButtonProps={{ danger: true, disabled: !motivo.trim(), loading: cargando }}
      onCancel={onClose}
      onOk={async () => {
        setCargando(true);
        try {
          await onConfirmar(motivo.trim());
          setMotivo("");
        } catch (e) {
          message.error(mensajeError(e));
        } finally {
          setCargando(false);
        }
      }}
    >
      <p className="mb-2 text-muted">{texto}</p>
      <Input.TextArea rows={2} placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
    </Modal>
  );
}

function AnularModal({
  api,
  item,
  onClose,
  onHecho,
}: {
  api: AxiosInstance;
  item: ItemCuenta | null;
  onClose: () => void;
  onHecho: () => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    setCantidad(item?.quantity ?? 1);
    setMotivo("");
  }, [item]);
  const MOTIVOS = ["Cliente cambió de opinión", "Error al comandar", "Demora", "Producto agotado"];
  return (
    <Modal
      open={Boolean(item)}
      title={`Anular: ${item?.name ?? ""}`}
      okText="Anular"
      okButtonProps={{ danger: true, disabled: !motivo.trim(), loading: cargando }}
      onCancel={onClose}
      onOk={async () => {
        if (!item) return;
        setCargando(true);
        try {
          await api.post(`/items/${item.id}/void`, { reason: motivo.trim(), quantity: cantidad });
          message.success("Anulado. Se avisó a su área.");
          onHecho();
        } catch (e) {
          message.error(mensajeError(e));
        } finally {
          setCargando(false);
        }
      }}
    >
      {item && item.quantity > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <span>Cantidad a anular</span>
          <InputNumber min={1} max={item.quantity} value={cantidad} onChange={(v) => setCantidad(Number(v) || 1)} />
          <span className="text-muted">de {item.quantity}</span>
        </div>
      )}
      <div className="mb-2 flex flex-wrap gap-1">
        {MOTIVOS.map((m) => (
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
  onClose,
  onCobrada,
}: {
  api: AxiosInstance;
  cuenta: Cuenta;
  dinero: (n: number) => string;
  onClose: () => void;
  onCobrada: () => void;
}) {
  const [descuento, setDescuento] = useState(0);
  const [pagos, setPagos] = useState<{ method: string; amount: number | null }[]>([
    { method: "efectivo", amount: null },
  ]);
  const [cargando, setCargando] = useState(false);
  const [hecho, setHecho] = useState<Cuenta | null>(null);

  const total = r2(cuenta.total - (cuenta.total * descuento) / 100);
  const pagado = r2(pagos.reduce((t, p) => t + Number(p.amount ?? 0), 0));
  const falta = r2(total - pagado);

  const confirmar = async () => {
    setCargando(true);
    try {
      const { data } = await api.post(`/accounts/${cuenta.id}/pay`, {
        discountPercentage: descuento,
        payments: pagos.filter((p) => Number(p.amount) > 0),
      });
      setHecho(data.data);
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  if (hecho) {
    return (
      <Modal open title="Cuenta cobrada" onCancel={onCobrada} footer={<Button type="primary" onClick={onCobrada}>Listo</Button>}>
        <div className="py-4 text-center">
          <div className="text-[13px] text-muted">Nota de venta {hecho.documento}</div>
          <div className="mt-1 font-mono text-[28px] font-bold">{dinero(hecho.total)}</div>
          {Number(hecho.vuelto) > 0 && (
            <div className="mt-3 rounded-xl bg-ok-bg py-3 text-[18px] font-bold text-ok">
              Vuelto: {dinero(Number(hecho.vuelto))}
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-muted">El ticket salió a la impresora de caja.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={`Cobrar mesa ${cuenta.mesa.name ?? ""}`}
      onCancel={onClose}
      okText={falta > 0.009 ? `Falta ${dinero(falta)}` : "Cobrar y cerrar"}
      okButtonProps={{ disabled: falta > 0.009, loading: cargando }}
      onOk={confirmar}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-muted">Total</span>
        <span className="font-mono text-[26px] font-bold">{dinero(total)}</span>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[13px]">Descuento %</span>
        <InputNumber min={0} max={100} value={descuento} onChange={(v) => setDescuento(Number(v) || 0)} />
      </div>
      {pagos.map((p, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <Select
            className="w-36"
            value={p.method}
            options={METODOS}
            onChange={(v) => setPagos(pagos.map((x, j) => (j === i ? { ...x, method: v } : x)))}
          />
          <InputNumber
            className="flex-1"
            min={0}
            step={1}
            placeholder={String(Math.max(0, falta + Number(p.amount ?? 0)).toFixed(2))}
            value={p.amount}
            onChange={(v) => setPagos(pagos.map((x, j) => (j === i ? { ...x, amount: v === null ? null : Number(v) } : x)))}
          />
          <Button
            onClick={() =>
              setPagos(pagos.map((x, j) => (j === i ? { ...x, amount: r2(Math.max(0, falta + Number(x.amount ?? 0))) } : x)))
            }
          >
            Exacto
          </Button>
          {pagos.length > 1 && (
            <Button icon={<TbTrash />} onClick={() => setPagos(pagos.filter((_, j) => j !== i))} />
          )}
        </div>
      ))}
      <Button type="dashed" block icon={<TbPlus />} onClick={() => setPagos([...pagos, { method: "yape", amount: null }])}>
        Pagar con otro método (dividir)
      </Button>
      {pagado > total && (
        <div className="mt-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok">Vuelto: {dinero(r2(pagado - total))}</div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------- comandar

function Comandar({
  carta,
  dinero,
  mesa,
  carrito,
  setCarrito,
  comensales,
  setComensales,
  onEnviar,
}: {
  carta: Carta | null;
  dinero: (n: number) => string;
  mesa: Mesa;
  carrito: LineaCarrito[];
  setCarrito: (l: LineaCarrito[]) => void;
  comensales: number | null;
  setComensales: (n: number | null) => void;
  onEnviar: () => void;
}) {
  const [cat, setCat] = useState<number | null>(null);
  const [buscar, setBuscar] = useState("");
  const [elegir, setElegir] = useState<Plato | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);

  const platos = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (carta?.platos ?? []).filter(
      (p) => (!cat || p.categoryIds.includes(cat)) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [carta, cat, buscar]);

  if (!carta) return <Spin />;

  const agregarSimple = (p: Plato) => {
    const i = carrito.findIndex((l) => l.productId === p.id && !l.options.length && !l.note);
    if (i >= 0) setCarrito(carrito.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l)));
    else setCarrito([...carrito, { key: nuevoId(), productId: p.id, name: p.name, price: p.price, quantity: 1, note: "", options: [] }]);
  };

  const cantidadDe = (id: number) => carrito.filter((l) => l.productId === id).reduce((t, l) => t + l.quantity, 0);
  const totalCarrito = carrito.reduce(
    (t, l) => t + (l.price + l.options.reduce((s, o) => s + o.priceDelta * o.quantity, 0)) * l.quantity,
    0
  );
  const unidades = carrito.reduce((t, l) => t + l.quantity, 0);

  return (
    <div>
      {!mesa.cuenta && (
        <div className="mb-3 flex items-center gap-2 text-[13px]">
          <span>Personas</span>
          <InputNumber min={1} max={50} value={comensales} onChange={(v) => setComensales(v ? Number(v) : null)} />
        </div>
      )}
      <Input
        allowClear
        size="large"
        prefix={<TbSearch />}
        placeholder="Buscar plato"
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        className="mb-3"
      />
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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

      {carrito.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl gap-2">
            <Button size="large" className="flex-1" onClick={() => setVerCarrito(true)}>
              Ver ({unidades}) · {dinero(totalCarrito)}
            </Button>
            <Button size="large" type="primary" className="flex-1" onClick={onEnviar}>
              Enviar comanda
            </Button>
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

      <Drawer
        open={verCarrito}
        placement="bottom"
        height="75vh"
        title={`Comanda mesa ${mesa.name}`}
        onClose={() => setVerCarrito(false)}
        extra={
          <Button
            type="primary"
            disabled={!carrito.length}
            onClick={() => {
              setVerCarrito(false);
              onEnviar();
            }}
          >
            Enviar
          </Button>
        }
      >
        {carrito.map((l, i) => (
          <div key={l.key} className="border-b border-line-soft py-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-semibold">{l.name}</span>
              <Button
                size="small"
                icon={<TbMinus />}
                onClick={() =>
                  setCarrito(
                    l.quantity <= 1
                      ? carrito.filter((_, j) => j !== i)
                      : carrito.map((x, j) => (j === i ? { ...x, quantity: x.quantity - 1 } : x))
                  )
                }
              />
              <span className="w-6 text-center font-bold">{l.quantity}</span>
              <Button
                size="small"
                icon={<TbPlus />}
                onClick={() => setCarrito(carrito.map((x, j) => (j === i ? { ...x, quantity: x.quantity + 1 } : x)))}
              />
            </div>
            {l.options.length > 0 && (
              <div className="text-[12px] text-muted">{l.options.map((o) => o.name).join(", ")}</div>
            )}
            <Input
              size="small"
              className="mt-2"
              placeholder="Nota para cocina (sin ají, término medio…)"
              value={l.note}
              onChange={(e) => setCarrito(carrito.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
            />
          </div>
        ))}
        {!carrito.length && <Empty description="Vacío" />}
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

  const enGrupo = (g: Plato["modifierGroups"][number]) =>
    g.options.reduce((t, o) => t + (elegidas[o.id] ?? 0), 0);
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
    g.options
      .filter((o) => elegidas[o.id])
      .map((o) => ({ optionId: o.id, quantity: elegidas[o.id], name: o.name, priceDelta: o.priceDelta }))
  );

  return (
    <Modal
      open
      title={plato.name}
      onCancel={onClose}
      okText={faltan.length ? `Elige: ${faltan[0].name}` : "Agregar"}
      okButtonProps={{ disabled: faltan.length > 0 }}
      onOk={() =>
        onAgregar({
          key: nuevoId(),
          productId: plato.id,
          name: plato.name,
          price: plato.price,
          quantity: cantidad,
          note: nota,
          options: opciones,
        })
      }
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
