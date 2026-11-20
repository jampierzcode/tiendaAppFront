import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, Input, Radio, Switch, Tag, message } from "antd";
import { TbBluetooth, TbPlus, TbPrinter, TbRefresh } from "react-icons/tb";
import dayjs from "dayjs";
import PageHeader from "../components/ui/PageHeader";
import { usePolling } from "../hooks/usePolling";
import { crearApiSalon, mensajeError } from "./api";
import { conectada, emparejar, hayBluetooth, imprimir, nombreEquipo, olvidar, reconectar } from "./bluetooth";
import { copiasDe, ticketEscPos, type TrabajoImpresion } from "./escpos";

interface Impresora {
  id: number;
  name: string;
  paperWidth: number;
  isActive: boolean;
}

interface Job extends TrabajoImpresion {
  status: string;
  attempts: number;
  error: string | null;
  createdAt: string;
  printedAt: string | null;
}

const ETIQUETA: Record<string, string> = {
  comanda: "Comanda",
  anulacion: "Anulación",
  precuenta: "Precuenta",
  nota_venta: "Nota de venta",
  cancelacion: "Cancelación",
  corte_x: "Corte X",
  corte_z: "Corte Z",
  corte_global: "Corte global",
  prueba: "Prueba",
};

const clave = (id: number) => `printer-${id}`;

/**
 * Central de impresión: el celular Android del local que recibe las
 * comandas de todas las meseras (por internet) y las imprime por Bluetooth.
 * Mientras esta pantalla esté abierta y activa, todo sale solo.
 */
export default function CentralImpresion() {
  const { uuid_business = "" } = useParams();
  const api = useMemo(() => crearApiSalon(uuid_business, "dueno"), [uuid_business]);
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [activa, setActiva] = useState(() => localStorage.getItem(`pdv_central_${uuid_business}`) === "1");
  const [caja, setCaja] = useState<number | null>(() => {
    const v = localStorage.getItem(`pdv_caja_${uuid_business}`);
    return v ? Number(v) : null;
  });
  const [, setTick] = useState(0);
  const [historial, setHistorial] = useState<Job[]>([]);
  const [esperando, setEsperando] = useState<Job[]>([]);
  const [nueva, setNueva] = useState("");
  const ocupado = useRef(false);
  const wake = useRef<{ release?: () => Promise<void> } | null>(null);
  const repintar = () => setTick((t) => t + 1);

  useEffect(() => {
    localStorage.setItem(`pdv_central_${uuid_business}`, activa ? "1" : "0");
  }, [activa, uuid_business]);
  useEffect(() => {
    if (caja) localStorage.setItem(`pdv_caja_${uuid_business}`, String(caja));
  }, [caja, uuid_business]);

  // Pantalla siempre encendida mientras la central está activa.
  useEffect(() => {
    const pedir = async () => {
      try {
        if (activa && !document.hidden && "wakeLock" in navigator) {
          wake.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        }
      } catch {
        /* sin soporte: no pasa nada */
      }
    };
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      wake.current?.release?.();
    };
  }, [activa]);

  const cargarHistorial = useCallback(async () => {
    const { data } = await api.get("/print-history");
    setHistorial(data.data);
  }, [api]);

  const procesar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      const { data } = await api.get("/print-queue");
      const lista: Impresora[] = data.data.printers;
      setImpresoras(lista);
      if (!activa) {
        setEsperando(data.data.jobs);
        return;
      }
      const sinImpresora: Job[] = [];
      for (const job of data.data.jobs as Job[]) {
        const destino = job.printerId ?? caja ?? (lista.length === 1 ? lista[0].id : null);
        const imp = lista.find((p) => p.id === destino);
        if (!imp || !(await reconectar(clave(imp.id)))) {
          sinImpresora.push(job);
          continue;
        }
        try {
          const bytes = ticketEscPos(job, imp.paperWidth);
          for (let c = 0; c < copiasDe(job); c++) await imprimir(clave(imp.id), bytes);
          await api.post(`/print-jobs/${job.id}/result`, { ok: true });
        } catch (e) {
          await api.post(`/print-jobs/${job.id}/result`, { ok: false, error: (e as Error).message }).catch(() => {});
        }
      }
      setEsperando(sinImpresora);
      void cargarHistorial();
    } catch {
      /* sin red: el siguiente ciclo reintenta */
    } finally {
      ocupado.current = false;
      repintar();
    }
  }, [api, activa, caja, cargarHistorial]);

  const ahora = usePolling(procesar, 3000, true, true);

  useEffect(() => {
    void cargarHistorial().catch(() => {});
  }, [cargarHistorial]);

  const conectar = async (p: Impresora) => {
    try {
      const nombre = await emparejar(clave(p.id));
      message.success(`${p.name} conectada a ${nombre}`);
      repintar();
      ahora();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (!/cancel/i.test(msg)) message.error(msg || "No se pudo conectar");
    }
  };

  const probar = async (p: Impresora) => {
    try {
      await api.post("/print-test", { printerId: p.id });
      ahora();
    } catch (e) {
      message.error(mensajeError(e));
    }
  };

  const crear = async () => {
    if (!nueva.trim()) return;
    try {
      await api.post("/printers", { name: nueva.trim(), paperWidth: 58 });
      setNueva("");
      ahora();
    } catch (e) {
      message.error(mensajeError(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo="Central de impresión"
        descripcion="Deja esta pantalla abierta en el celular o tablet Android que está junto a las impresoras. Las comandas de todas las meseras llegan por internet y salen aquí por Bluetooth."
      />

      {!hayBluetooth() && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Este navegador no puede usar Bluetooth"
          description="Abre esta página en Chrome desde un celular o tablet Android. En iPhone no funciona la impresión Bluetooth desde el navegador."
        />
      )}

      <div className="card mb-4 flex items-center gap-3 p-4">
        <Switch checked={activa} onChange={setActiva} />
        <div className="flex-1">
          <div className="font-semibold text-ink">{activa ? "Central activa" : "Central apagada"}</div>
          <div className="text-[12.5px] text-muted">
            {activa ? "Imprimiendo todo lo que llega. La pantalla se mantiene encendida." : "Actívala para empezar a imprimir."}
          </div>
        </div>
        {esperando.length > 0 && <Tag color="orange">{esperando.length} en espera</Tag>}
      </div>

      {esperando.length > 0 && activa && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message={`${esperando.length} ticket(s) esperando una impresora conectada`}
          description="Conecta la impresora de su área o elige la impresora de caja."
        />
      )}

      <div className="card mb-4 p-4">
        <div className="mb-3 font-semibold text-ink">Impresoras</div>
        {impresoras.map((p) => {
          const ok = conectada(clave(p.id));
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-3 first:border-0">
              <TbPrinter className="text-[20px] text-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {p.name} <span className="text-[12px] font-normal text-muted">{p.paperWidth} mm</span>
                </div>
                <div className={`text-[12px] ${ok ? "text-ok" : "text-muted"}`}>
                  {ok ? `● Conectada (${nombreEquipo(clave(p.id))})` : nombreEquipo(clave(p.id)) ? `○ Desconectada (${nombreEquipo(clave(p.id))})` : "○ Sin emparejar"}
                </div>
              </div>
              <Button icon={<TbBluetooth />} onClick={() => conectar(p)}>
                {ok ? "Cambiar" : "Conectar"}
              </Button>
              <Button onClick={() => probar(p)}>Probar</Button>
              {nombreEquipo(clave(p.id)) && (
                <Button
                  type="text"
                  onClick={() => {
                    olvidar(clave(p.id));
                    repintar();
                  }}
                >
                  Olvidar
                </Button>
              )}
            </div>
          );
        })}
        <div className="mt-3 flex gap-2">
          <Input placeholder="Nueva impresora (p. ej. Cocina)" value={nueva} onChange={(e) => setNueva(e.target.value)} onPressEnter={crear} />
          <Button icon={<TbPlus />} onClick={crear}>
            Agregar
          </Button>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="mb-1 font-semibold text-ink">Impresora de caja</div>
        <p className="mb-3 text-[12.5px] text-muted">
          Aquí salen la precuenta, la nota de venta y los platos sin área. Si tienes una sola impresora, todo sale por ella.
        </p>
        <Radio.Group value={caja} onChange={(e) => setCaja(e.target.value)}>
          {impresoras.map((p) => (
            <Radio.Button key={p.id} value={p.id}>
              {p.name}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center">
          <span className="flex-1 font-semibold text-ink">Últimos tickets</span>
          <Button size="small" icon={<TbRefresh />} onClick={() => void cargarHistorial()} />
        </div>
        {historial.map((j) => (
          <div key={j.id} className="flex items-center gap-2 border-t border-line-soft py-2 text-[13px] first:border-0">
            <span className="w-12 font-mono text-muted">{dayjs(j.createdAt).format("HH:mm")}</span>
            <span className="flex-1">
              {ETIQUETA[j.kind] ?? j.kind}
              {j.payload?.mesa ? ` · Mesa ${j.payload.mesa}` : ""}
              {j.payload?.area && j.kind === "comanda" ? ` · ${j.payload.area}` : ""}
              {j.error && <span className="block text-[11.5px] text-danger">{j.error}</span>}
            </span>
            <Tag color={j.status === "impreso" ? "green" : j.status === "error" ? "red" : "orange"}>{j.status}</Tag>
            <Button
              size="small"
              onClick={async () => {
                await api.post(`/print-jobs/${j.id}/reprint`);
                ahora();
              }}
            >
              Reimprimir
            </Button>
          </div>
        ))}
        {!historial.length && <div className="text-[13px] text-muted">Aún no hay tickets.</div>}
      </div>
    </div>
  );
}
