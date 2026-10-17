import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Popover } from "antd";
import { TbBell, TbShoppingBag, TbChecks, TbMessageCircle } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import { usePolling } from "../../hooks/usePolling";
import { avisar } from "../../hooks/useAvisos";

interface Aviso {
  id: number;
  type: "pedido" | "mensaje";
  title: string;
  body: string | null;
  orderId: number | null;
  readAt: string | null;
  createdAt: string;
}

const hace = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};

/**
 * Campana del panel: avisos con leído / no leído. Un aviso de pedido lleva
 * directo a ese pedido. Se consulta cada pocos segundos y suena solo cuando
 * llega algo nuevo (no en la primera carga).
 */
export default function NotificationBell() {
  const { uuid_business } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Aviso[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const ultimoId = useRef<number | null>(null);

  const cargar = async () => {
    if (!uuid_business) return;
    const r = await apiTienda.get(`/b/${uuid_business}/notifications`);
    const lista: Aviso[] = r.data.data.items;
    const maxId = lista[0]?.id ?? 0;
    if (ultimoId.current !== null && maxId > ultimoId.current) {
      const nuevo = lista.find((n) => n.id > (ultimoId.current as number));
      if (nuevo) avisar(nuevo.title, nuevo.body ?? "", `aviso-${nuevo.id}`);
    }
    ultimoId.current = maxId;
    setItems(lista);
    setSinLeer(r.data.data.unread);
  };

  const refrescar = usePolling(cargar, 20000, Boolean(uuid_business));

  const abrir = async (n: Aviso) => {
    setAbierto(false);
    if (!n.readAt) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setSinLeer((c) => Math.max(0, c - 1));
      apiTienda.put(`/b/${uuid_business}/notifications/${n.id}/read`).catch(() => undefined);
    }
    if (n.orderId) {
      navigate(`/b/${uuid_business}/orders?pedido=${n.orderId}`);
    }
  };

  const marcarTodas = async () => {
    await apiTienda.put(`/b/${uuid_business}/notifications/read-all`).catch(() => undefined);
    refrescar();
  };

  const contenido = (
    <div className="w-[min(340px,calc(100vw-48px))]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="text-[13px] font-semibold text-ink">Notificaciones</p>
        <button
          onClick={marcarTodas}
          disabled={sinLeer === 0}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 disabled:text-muted"
        >
          <TbChecks /> Marcar todas como leídas
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-muted">Aún no tienes avisos.</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => abrir(n)}
              className={`flex w-full items-start gap-3 border-b border-line px-3 py-2.5 text-left transition last:border-0 hover:bg-canvas ${
                n.readAt ? "" : "bg-brand-50/60"
              }`}
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
                {n.type === "mensaje" ? <TbMessageCircle /> : <TbShoppingBag />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[13px] ${n.readAt ? "text-ink-soft" : "font-semibold text-ink"}`}>
                  {n.title}
                </span>
                {n.body && <span className="block truncate text-[12px] text-muted">{n.body}</span>}
                <span className="block text-[11px] text-muted">{hace(n.createdAt)}</span>
              </span>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={contenido}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      open={abierto}
      onOpenChange={setAbierto}
      styles={{ body: { padding: 0 } }}
    >
      <button
        aria-label="Notificaciones"
        className="relative rounded-lg border border-line p-2 text-ink-soft transition hover:border-brand-300 hover:text-brand-600"
      >
        <TbBell className="text-base" />
        {sinLeer > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>
    </Popover>
  );
}
