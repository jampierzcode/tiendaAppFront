import { useCallback, useEffect, useRef, useState } from "react";
import { decir, desbloquearAudio, pitar } from "../hooks/useAvisos";
import { Button, Empty, Spin, message } from "antd";
import { TbArrowBackUp, TbBike, TbCheck, TbFlame, TbPaperBag, TbVolume, TbVolumeOff } from "react-icons/tb";
import dayjs from "dayjs";
import { usePolling } from "../hooks/usePolling";
import { mensajeError } from "./api";

export interface ItemMonitor {
  id: number;
  cantidad: number;
  nombre: string;
  opciones: string[];
  nota: string | null;
  estado: "pendiente" | "preparando" | "listo" | "servido";
  anulado: boolean;
  listoEn: string | null;
}

export interface TicketMonitor {
  clave: string;
  orderId: number;
  area: string;
  canal: string;
  servicio: "comedor" | "para_llevar" | "delivery";
  etiqueta: string;
  mesero: string | null;
  ronda: number | null;
  nota: string | null;
  desde: string;
  estado: "pendiente" | "preparando" | "listo" | "anulado";
  items: ItemMonitor[];
}

interface Props {
  titulo: string;
  subtitulo?: string;
  cargar: () => Promise<TicketMonitor[]>;
  cambiar: (ids: number[], estado: "pendiente" | "preparando" | "listo") => Promise<void>;
}

const SIGUIENTE: Record<string, "preparando" | "listo" | "pendiente"> = {
  pendiente: "preparando",
  preparando: "listo",
  listo: "pendiente",
};

/**
 * Monitor de producción (KDS): una tarjeta por comanda y área. Se toca un
 * plato para avanzar su estado (pendiente → preparando → listo) o «Listo» para
 * todo el ticket. El color del reloj avisa la demora: verde, ámbar a los 10
 * min y rojo a los 20. Los listos se quedan abajo un rato por si hay que
 * deshacer.
 */
export default function MonitorProduccion({ titulo, subtitulo, cargar, cambiar }: Props) {
  const [tickets, setTickets] = useState<TicketMonitor[] | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [sonido, setSonido] = useState(() => localStorage.getItem("kds_sonido") !== "0");
  const vistos = useRef<Set<string> | null>(null);

  const leer = useCallback(async () => {
    try {
      const lista = await cargar();
      const nuevos = lista.filter((t) => t.estado === "pendiente" && !vistos.current?.has(t.clave));
      if (vistos.current && nuevos.length && sonido) {
        pitar();
        decir(nuevos.length > 1 ? `${nuevos.length} comandas nuevas` : "Nueva comanda");
      }
      vistos.current = new Set(lista.map((t) => t.clave));
      setTickets(lista);
    } catch (e) {
      message.error(mensajeError(e));
    }
  }, [cargar, sonido]);

  const refrescar = usePolling(leer, 4000, true, true);
  useEffect(() => desbloquearAudio(), []);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Pantalla siempre encendida en la cocina.
  useEffect(() => {
    let lock: { release?: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        if (!document.hidden && "wakeLock" in navigator) {
          lock = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        }
      } catch {
        /* sin soporte */
      }
    };
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      void lock?.release?.();
    };
  }, []);

  const mover = async (ids: number[], estado: "pendiente" | "preparando" | "listo") => {
    try {
      await cambiar(ids, estado);
      refrescar();
    } catch (e) {
      message.error(mensajeError(e));
    }
  };

  if (!tickets) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spin />
      </div>
    );
  }

  const enCurso = tickets.filter((t) => t.estado !== "listo");
  const listos = tickets.filter((t) => t.estado === "listo");

  return (
    <div className="min-h-screen bg-[#14122b] p-3 text-white">
      <div className="mb-3 flex items-center gap-3">
        <TbFlame className="shrink-0 text-[24px] text-orange-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold">{titulo}</div>
          {subtitulo && <div className="text-[12px] text-white/60">{subtitulo}</div>}
        </div>
        <span className="shrink-0 whitespace-nowrap text-[13px] text-white/70">{enCurso.length} en curso</span>
        <span className="font-mono text-[20px]">{dayjs(ahora).format("HH:mm")}</span>
        <Button
          type="text"
          className="!text-white"
          icon={sonido ? <TbVolume /> : <TbVolumeOff />}
          onClick={() => {
            localStorage.setItem("kds_sonido", sonido ? "0" : "1");
            setSonido(!sonido);
            if (!sonido) pitar();
          }}
        />
      </div>

      {!enCurso.length && (
        <div className="grid min-h-[40vh] place-items-center">
          <Empty description={<span className="text-white/60">Sin comandas pendientes</span>} />
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {enCurso.map((t) => (
          <Tarjeta key={t.clave} t={t} ahora={ahora} onMover={mover} />
        ))}
      </div>

      {listos.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[12px] uppercase tracking-wide text-white/50">Listos recientes (toca para deshacer)</div>
          <div className="flex flex-wrap gap-2">
            {listos.map((t) => (
              <button
                key={t.clave}
                onClick={() => mover(t.items.filter((i) => !i.anulado).map((i) => i.id), "preparando")}
                className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[13px] active:bg-white/20"
              >
                <TbArrowBackUp /> {t.etiqueta} · {t.area}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  t,
  ahora,
  onMover,
}: {
  t: TicketMonitor;
  ahora: number;
  onMover: (ids: number[], estado: "pendiente" | "preparando" | "listo") => void;
}) {
  const min = Math.floor((ahora - new Date(t.desde).getTime()) / 60000);
  const color = min >= 20 ? "bg-red-600" : min >= 10 ? "bg-amber-500" : "bg-emerald-600";
  const vivos = t.items.filter((i) => !i.anulado);
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white text-ink shadow-lg">
      <div className={`${color} flex items-center gap-2 px-3 py-2 text-white`}>
        <span className="flex-1 truncate text-[17px] font-bold">{t.etiqueta}</span>
        <span className="font-mono text-[15px] font-semibold">{min}′</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 px-3 pt-2 text-[12px] text-muted">
        <span className="font-semibold text-ink">{t.area}</span>
        {t.servicio === "para_llevar" && (
          <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 font-bold text-amber-800">
            <TbPaperBag /> PARA LLEVAR
          </span>
        )}
        {t.servicio === "delivery" && (
          <span className="flex items-center gap-1 rounded bg-sky-100 px-1.5 font-bold text-sky-800">
            <TbBike /> DELIVERY
          </span>
        )}
        {t.ronda && <span>Ronda {t.ronda}</span>}
        {t.mesero && <span>· {t.mesero}</span>}
        {t.canal !== "salon" && <span>· Online</span>}
      </div>
      {t.nota && <div className="mx-3 mt-1 rounded bg-amber-50 px-2 py-1 text-[12px] text-amber-800">📝 {t.nota}</div>}
      <div className="flex-1 px-1 py-1">
        {t.items.map((i) => (
          <button
            key={i.id}
            disabled={i.anulado}
            onClick={() => onMover([i.id], SIGUIENTE[i.estado] ?? "preparando")}
            className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left active:bg-brand-50 ${
              i.anulado ? "bg-red-50" : i.estado === "listo" ? "bg-emerald-50" : i.estado === "preparando" ? "bg-amber-50" : ""
            }`}
          >
            <span className={`w-8 text-[18px] font-bold ${i.anulado ? "text-red-600 line-through" : ""}`}>{i.cantidad}</span>
            <span className="flex-1">
              <span className={`block text-[16px] font-semibold leading-tight ${i.anulado ? "text-red-600 line-through" : ""}`}>{i.nombre}</span>
              {i.opciones.map((o) => (
                <span key={o} className="block text-[13px] text-ink-soft">
                  + {o}
                </span>
              ))}
              {i.nota && <span className="block text-[13px] font-semibold text-red-700">» {i.nota}</span>}
              {i.anulado && <span className="block text-[12px] font-bold text-red-600">ANULADO</span>}
            </span>
            {!i.anulado && (
              <span
                className={`mt-1 shrink-0 rounded px-1.5 text-[10.5px] font-bold uppercase ${
                  i.estado === "listo" ? "bg-emerald-600 text-white" : i.estado === "preparando" ? "bg-amber-500 text-white" : "bg-line text-muted"
                }`}
              >
                {i.estado === "pendiente" ? "Nuevo" : i.estado}
              </span>
            )}
          </button>
        ))}
      </div>
      {vivos.length > 0 && (
        <div className="flex gap-2 border-t border-line p-2">
          {t.estado === "pendiente" && (
            <Button block onClick={() => onMover(vivos.map((i) => i.id), "preparando")}>
              Empezar
            </Button>
          )}
          <Button block type="primary" icon={<TbCheck />} onClick={() => onMover(vivos.filter((i) => i.estado !== "listo").map((i) => i.id), "listo")}>
            Listo
          </Button>
        </div>
      )}
    </div>
  );
}
