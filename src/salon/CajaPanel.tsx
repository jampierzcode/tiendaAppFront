/* eslint-disable @typescript-eslint/no-explicit-any -- los informes de corte son el mismo payload que se imprime, armado por el backend. */
import { useCallback, useEffect, useState } from "react";
import type { AxiosInstance } from "axios";
import { Button, Collapse, Input, InputNumber, Modal, Select, Spin, message } from "antd";
import { TbCash, TbLock, TbMinus, TbPlus, TbPrinter, TbReceipt } from "react-icons/tb";
import dayjs from "dayjs";
import { mensajeError } from "./api";

const METODOS: { value: string; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];
const nombre = (m: string) => METODOS.find((x) => x.value === m)?.label ?? m;

interface Resumen {
  fondo: number;
  porMetodo: Record<string, number>;
  totalVentas: number;
  ventas: number;
  ingresos: number;
  retiros: number;
  efectivoEsperado: number;
  movimientos: { type: string; amount: number; reason: string; userName: string | null; createdAt: string }[];
}

interface Estado {
  turno: { id: number; number: number; openedAt: string; openedByName: string | null } | null;
  cajas: { id: number; name: string; sesionAbierta: number | null }[];
  sesiones: {
    id: number;
    caja: string;
    status: "abierta" | "cerrada";
    userName: string | null;
    openedAt: string;
    closedAt: string | null;
    zNumber: number | null;
    difference: number | null;
    resumen: Resumen | null;
  }[];
  miSesion: number | null;
  mesasAbiertas: number;
}

/**
 * Caja: apertura con fondo, ingresos/retiros, corte X (parcial), corte Z
 * (cierre con conteo a ciegas) y corte global del turno.
 */
export default function CajaPanel({
  api,
  simbolo,
  esDueno,
}: {
  api: AxiosInstance;
  simbolo: string;
  esDueno: boolean;
}) {
  const [e, setE] = useState<Estado | null>(null);
  const [abrir, setAbrir] = useState<{ registerId: number | null; fondo: number | null } | null>(null);
  const [mov, setMov] = useState<{ sesion: number; type: "ingreso" | "retiro"; amount: number | null; reason: string } | null>(null);
  const [zDe, setZDe] = useState<number | null>(null);
  const [informe, setInforme] = useState<{ titulo: string; datos: any } | null>(null);
  const [historial, setHistorial] = useState<any[] | null>(null);
  const dinero = (n: number) => `${simbolo} ${Number(n ?? 0).toFixed(2)}`;

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/cash");
      setE(data.data);
    } catch (err) {
      message.error(mensajeError(err));
    }
  }, [api]);

  const cargarHistorial = useCallback(async () => {
    if (!esDueno) return;
    try {
      const { data } = await api.get("/cash/history");
      setHistorial(data.data);
    } catch {
      /* opcional */
    }
  }, [api, esDueno]);

  useEffect(() => {
    void cargar();
    void cargarHistorial();
  }, [cargar, cargarHistorial]);

  const accion = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      const r = await fn();
      if (ok) message.success(ok);
      await cargar();
      return r;
    } catch (err) {
      message.error(mensajeError(err));
      return null;
    }
  };

  if (!e) return <Spin />;

  const abiertas = e.sesiones.filter((s) => s.status === "abierta");
  const cerradas = e.sesiones.filter((s) => s.status === "cerrada");
  const cajasLibres = e.cajas.filter((c) => !c.sesionAbierta);

  const corteGlobal = async (force = false) => {
    const r = (await accion(() => api.post("/cash/close-shift", { force }))) as { data: { data: any } } | null;
    if (r) {
      setInforme({ titulo: `Corte global · Turno #${r.data.data.turno}`, datos: r.data.data });
      void cargarHistorial();
    }
  };

  return (
    <div className="space-y-4">
      {/* Turno */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <div className="text-[12px] uppercase tracking-wide text-muted">Turno</div>
          {e.turno ? (
            <div className="font-semibold text-ink">
              #{e.turno.number} abierto desde {dayjs(e.turno.openedAt).format("DD/MM HH:mm")}
              {e.turno.openedByName ? ` · ${e.turno.openedByName}` : ""}
            </div>
          ) : (
            <div className="font-semibold text-ink">Sin turno abierto: se abre solo al abrir la primera caja.</div>
          )}
          {e.mesasAbiertas > 0 && <div className="text-[12.5px] text-warn">{e.mesasAbiertas} mesa(s) con cuenta abierta</div>}
        </div>
        {cajasLibres.length > 0 && (
          <Button type="primary" icon={<TbCash />} onClick={() => setAbrir({ registerId: cajasLibres[0].id, fondo: null })}>
            Abrir caja
          </Button>
        )}
        {esDueno && e.turno && (
          <Button
            danger
            icon={<TbLock />}
            disabled={abiertas.length > 0}
            title={abiertas.length ? "Primero haz el corte Z de cada caja" : ""}
            onClick={() =>
              Modal.confirm({
                title: "Corte global del turno",
                content:
                  e.mesasAbiertas > 0
                    ? `Hay ${e.mesasAbiertas} mesa(s) sin cobrar. Si cierras igual, quedarán para el próximo turno.`
                    : "Se cierra el turno y se imprime el resumen del día.",
                okText: "Cerrar turno",
                okButtonProps: { danger: true },
                onOk: () => corteGlobal(e.mesasAbiertas > 0),
              })
            }
          >
            Corte global
          </Button>
        )}
      </div>

      {/* Cajas abiertas */}
      {abiertas.map((s) => {
        const r = s.resumen!;
        return (
          <div key={s.id} className={`card p-4 ${s.id === e.miSesion ? "ring-2 ring-brand-300" : ""}`}>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <span className="text-[16px] font-bold text-ink">{s.caja}</span>
              <span className="text-[12.5px] text-muted">
                {s.userName} · desde {dayjs(s.openedAt).format("HH:mm")}
              </span>
              <span className="ml-auto font-mono text-[18px] font-bold">{dinero(r.totalVentas)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-3">
              {Object.entries(r.porMetodo).map(([m, v]) => (
                <div key={m} className="flex justify-between">
                  <span className="text-muted">{nombre(m)}</span>
                  <span className="font-mono">{dinero(v)}</span>
                </div>
              ))}
              {!Object.keys(r.porMetodo).length && <span className="text-muted">Aún sin ventas</span>}
            </div>
            <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[13px]">
              <div className="flex justify-between"><span>Fondo</span><span className="font-mono">{dinero(r.fondo)}</span></div>
              {r.ingresos > 0 && <div className="flex justify-between"><span>Ingresos</span><span className="font-mono">+{dinero(r.ingresos)}</span></div>}
              {r.retiros > 0 && <div className="flex justify-between"><span>Retiros</span><span className="font-mono">−{dinero(r.retiros)}</span></div>}
              <div className="flex justify-between font-semibold"><span>Efectivo que debería haber</span><span className="font-mono">{dinero(r.efectivoEsperado)}</span></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button icon={<TbPlus />} onClick={() => setMov({ sesion: s.id, type: "ingreso", amount: null, reason: "" })}>Ingreso</Button>
              <Button icon={<TbMinus />} onClick={() => setMov({ sesion: s.id, type: "retiro", amount: null, reason: "" })}>Retiro / gasto</Button>
              <Button
                icon={<TbPrinter />}
                onClick={async () => {
                  const res = (await accion(() => api.post(`/cash/sessions/${s.id}/x`), "Corte X enviado a la impresora")) as { data: { data: any } } | null;
                  if (res) setInforme({ titulo: `Corte X · ${s.caja}`, datos: res.data.data });
                }}
              >
                Corte X
              </Button>
              <Button type="primary" danger icon={<TbReceipt />} onClick={() => setZDe(s.id)}>
                Corte Z (cerrar caja)
              </Button>
            </div>
          </div>
        );
      })}

      {/* Cajas cerradas en este turno */}
      {cerradas.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 font-semibold">Cajas cerradas en este turno</div>
          {cerradas.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border-t border-line-soft py-2 text-[13px] first:border-0">
              <span className="font-mono text-muted">Z#{s.zNumber}</span>
              <span className="flex-1">{s.caja} · {s.userName} · {dayjs(s.closedAt).format("HH:mm")}</span>
              <Diferencia valor={Number(s.difference ?? 0)} dinero={dinero} />
            </div>
          ))}
        </div>
      )}

      {/* Historial de turnos */}
      {esDueno && historial && historial.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 font-semibold">Turnos anteriores</div>
          <Collapse
            size="small"
            items={historial.map((t) => ({
              key: t.id,
              label: (
                <div className="flex gap-2 text-[13px]">
                  <span className="font-semibold">#{t.number}</span>
                  <span className="flex-1 text-muted">{dayjs(t.closedAt).format("DD/MM HH:mm")}</span>
                  <span className="font-mono">{dinero(t.summary?.total ?? 0)}</span>
                </div>
              ),
              children: (
                <div>
                  <InformeGlobal datos={t.summary} dinero={dinero} />
                  <Button
                    className="mt-2"
                    size="small"
                    icon={<TbPrinter />}
                    onClick={() => accion(() => api.post(`/cash/shifts/${t.id}/reprint`), "Enviado a la impresora")}
                  >
                    Reimprimir
                  </Button>
                </div>
              ),
            }))}
          />
        </div>
      )}

      {/* Abrir caja */}
      <Modal
        open={Boolean(abrir)}
        title="Abrir caja"
        okText="Abrir"
        onCancel={() => setAbrir(null)}
        onOk={async () => {
          if (!abrir) return;
          const ok = await accion(() => api.post("/cash/open", { registerId: abrir.registerId, openingFloat: abrir.fondo ?? 0 }), "Caja abierta");
          if (ok) setAbrir(null);
        }}
      >
        {abrir && (
          <div className="space-y-3">
            {cajasLibres.length > 1 && (
              <Select
                className="w-full"
                value={abrir.registerId}
                options={cajasLibres.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(v) => setAbrir({ ...abrir, registerId: v })}
              />
            )}
            <div>
              <div className="mb-1 text-[13px]">Fondo inicial (sencillo en efectivo)</div>
              <InputNumber className="w-full" size="large" min={0} prefix={simbolo} value={abrir.fondo} onChange={(v) => setAbrir({ ...abrir, fondo: v === null ? null : Number(v) })} />
            </div>
            {esDueno && (
              <Button
                type="link"
                className="!px-0"
                onClick={() => {
                  let nombreCaja = "";
                  Modal.confirm({
                    title: "Nueva caja",
                    content: <Input placeholder="Barra, Caja 2…" onChange={(ev) => (nombreCaja = ev.target.value)} />,
                    onOk: () => accion(() => api.post("/cash/registers", { name: nombreCaja }), "Caja creada"),
                  });
                }}
              >
                + Crear otra caja (si cobran en dos puntos a la vez)
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Ingreso / retiro */}
      <Modal
        open={Boolean(mov)}
        title={mov?.type === "ingreso" ? "Ingreso de efectivo" : "Retiro o gasto de efectivo"}
        okText="Registrar"
        onCancel={() => setMov(null)}
        okButtonProps={{ disabled: !mov?.amount || !mov.reason.trim() }}
        onOk={async () => {
          if (!mov) return;
          const ok = await accion(() => api.post(`/cash/sessions/${mov.sesion}/movements`, mov), "Registrado");
          if (ok) setMov(null);
        }}
      >
        {mov && (
          <div className="space-y-3">
            <InputNumber className="w-full" size="large" min={0} prefix={simbolo} value={mov.amount} onChange={(v) => setMov({ ...mov, amount: v === null ? null : Number(v) })} />
            <div className="flex flex-wrap gap-1">
              {(mov.type === "ingreso" ? ["Sencillo", "Aporte del dueño"] : ["Compra de insumos", "Gas", "Pago a proveedor", "Retiro del dueño"]).map((m) => (
                <Button key={m} size="small" onClick={() => setMov({ ...mov, reason: m })}>{m}</Button>
              ))}
            </div>
            <Input placeholder="Motivo" value={mov.reason} onChange={(ev) => setMov({ ...mov, reason: ev.target.value })} />
          </div>
        )}
      </Modal>

      {zDe && (
        <CorteZModal
          api={api}
          sesionId={zDe}
          simbolo={simbolo}
          onClose={() => setZDe(null)}
          onHecho={(datos) => {
            setZDe(null);
            setInforme({ titulo: `Corte Z #${datos.z}`, datos });
            void cargar();
          }}
        />
      )}

      <Modal open={Boolean(informe)} title={informe?.titulo} footer={<Button type="primary" onClick={() => setInforme(null)}>Listo</Button>} onCancel={() => setInforme(null)}>
        {informe && (informe.datos.turno ? <InformeGlobal datos={informe.datos} dinero={dinero} /> : <InformeCaja datos={informe.datos} dinero={dinero} />)}
      </Modal>
    </div>
  );
}

function Diferencia({ valor, dinero }: { valor: number; dinero: (n: number) => string }) {
  if (Math.abs(valor) < 0.005) return <span className="pill bg-ok-bg text-ok">Cuadra</span>;
  return valor < 0 ? (
    <span className="pill bg-danger-bg text-danger">Faltante {dinero(Math.abs(valor))}</span>
  ) : (
    <span className="pill bg-warn-bg text-warn">Sobrante {dinero(valor)}</span>
  );
}

/** Corte Z a ciegas: se cuenta sin ver cuánto "debería" haber. */
function CorteZModal({
  api,
  sesionId,
  simbolo,
  onClose,
  onHecho,
}: {
  api: AxiosInstance;
  sesionId: number;
  simbolo: string;
  onClose: () => void;
  onHecho: (datos: any) => void;
}) {
  const [declarado, setDeclarado] = useState<Record<string, number | null>>({ efectivo: null });
  const [nota, setNota] = useState("");
  const [cargando, setCargando] = useState(false);
  const usados = Object.keys(declarado);

  return (
    <Modal
      open
      title="Corte Z: cerrar caja"
      okText="Cerrar caja e imprimir"
      okButtonProps={{ danger: true, loading: cargando }}
      onCancel={onClose}
      onOk={async () => {
        setCargando(true);
        try {
          const { data } = await api.post(`/cash/sessions/${sesionId}/z`, { declared: declarado, note: nota });
          onHecho(data.data);
        } catch (err) {
          message.error(mensajeError(err));
        } finally {
          setCargando(false);
        }
      }}
    >
      <p className="mb-3 text-[13px] text-muted">
        Cuenta el efectivo de la caja (con el fondo) y suma lo cobrado por Yape, Plin y tarjeta. El sistema te dirá si cuadra
        después de cerrar.
      </p>
      {usados.map((m) => (
        <div key={m} className="mb-2 flex items-center gap-2">
          <span className="w-28 text-[13px]">{nombre(m)}</span>
          <InputNumber className="flex-1" min={0} prefix={simbolo} value={declarado[m]} onChange={(v) => setDeclarado({ ...declarado, [m]: v === null ? null : Number(v) })} />
        </div>
      ))}
      <div className="mb-3 flex flex-wrap gap-1">
        {METODOS.filter((m) => !usados.includes(m.value)).map((m) => (
          <Button key={m.value} size="small" icon={<TbPlus />} onClick={() => setDeclarado({ ...declarado, [m.value]: null })}>
            {m.label}
          </Button>
        ))}
      </div>
      <Input placeholder="Nota (opcional)" value={nota} onChange={(ev) => setNota(ev.target.value)} />
    </Modal>
  );
}

function Fila({ izq, der, fuerte }: { izq: string; der: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 text-[13px] ${fuerte ? "font-semibold" : ""}`}>
      <span>{izq}</span>
      <span className="font-mono">{der}</span>
    </div>
  );
}

function InformeCaja({ datos, dinero }: { datos: any; dinero: (n: number) => string }) {
  const porMetodo: { metodo: string; monto: number }[] = Array.isArray(datos.porMetodo)
    ? datos.porMetodo
    : Object.entries(datos.porMetodo ?? {}).map(([metodo, monto]) => ({ metodo, monto: Number(monto) }));
  return (
    <div>
      {porMetodo.map((m) => <Fila key={m.metodo} izq={nombre(m.metodo)} der={dinero(m.monto)} />)}
      <Fila izq={`Total (${datos.ventas} ventas)`} der={dinero(datos.totalVentas)} fuerte />
      <div className="my-2 border-t border-line" />
      <Fila izq="Fondo" der={dinero(datos.fondo)} />
      <Fila izq="Ingresos" der={dinero(datos.ingresos)} />
      <Fila izq="Retiros" der={`−${dinero(datos.retiros)}`} />
      <Fila izq="Efectivo esperado" der={dinero(datos.efectivoEsperado)} fuerte />
      {datos.lineas && (
        <>
          <div className="my-2 border-t border-line" />
          {datos.lineas.map((l: any) => (
            <div key={l.metodo} className="flex items-center justify-between py-1 text-[13px]">
              <span>{nombre(l.metodo)}</span>
              <span className="font-mono text-muted">{Number(l.declarado).toFixed(2)} / {Number(l.esperado).toFixed(2)}</span>
              <Diferencia valor={l.diferencia} dinero={dinero} />
            </div>
          ))}
          <div className="mt-2 flex justify-end">
            <Diferencia valor={datos.diferencia} dinero={dinero} />
          </div>
        </>
      )}
    </div>
  );
}

function InformeGlobal({ datos, dinero }: { datos: any; dinero: (n: number) => string }) {
  if (!datos) return null;
  return (
    <div>
      <div className="mb-2 text-[12.5px] text-muted">{datos.apertura} → {datos.cierre} · cerró {datos.cerradoPor}</div>
      {(datos.sesiones ?? []).map((s: any) => (
        <div key={s.z} className="flex items-center justify-between py-1 text-[13px]">
          <span>Z#{s.z} {s.caja} · {s.usuario}</span>
          <Diferencia valor={s.diferencia} dinero={dinero} />
        </div>
      ))}
      <div className="my-2 border-t border-line" />
      {(datos.porMetodo ?? []).map((m: any) => <Fila key={m.metodo} izq={nombre(m.metodo)} der={dinero(m.monto)} />)}
      <Fila izq="Total vendido" der={dinero(datos.total)} fuerte />
      <Fila izq="Ventas" der={String(datos.ventas)} />
      <Fila izq="Ticket promedio" der={dinero(datos.ticketPromedio)} />
      <Fila izq="Descuentos" der={dinero(datos.descuentos)} />
      <Fila izq={`Anulaciones (${datos.anulaciones?.cantidad ?? 0})`} der={dinero(datos.anulaciones?.monto ?? 0)} />
      <Fila izq="Cuentas canceladas" der={String(datos.cuentasCanceladas ?? 0)} />
      <Fila izq="Diferencia de cajas" der={dinero(datos.diferencia)} fuerte />
      {(datos.top ?? []).length > 0 && (
        <>
          <div className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-muted">Más vendidos</div>
          {datos.top.map((t: any) => <Fila key={t.nombre} izq={`${t.cantidad} × ${t.nombre}`} der={dinero(t.total)} />)}
        </>
      )}
    </div>
  );
}
