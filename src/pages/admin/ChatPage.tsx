import { useCallback, useEffect, useState } from "react";
import { Empty, Spin, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../context/BusinessContext";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import ChatThread from "../../components/admin/ChatThread";

interface Conversacion {
  contact: string;
  phone: string;
  name: string | null;
  lastMessage: string;
  lastDirection: "in" | "out";
  lastAt: string;
  unread: number;
}

/** Bandeja de conversaciones por WhatsApp: lo que escribe el cliente llega aquí. */
export default function ChatPage() {
  const [lista, setLista] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState<Conversacion | null>(null);
  const navigate = useNavigate();
  const { business } = useBusiness();

  // Sin WhatsApp conectado esta bandeja no sirve: se manda a conectarlo.
  useEffect(() => {
    if (!business?.uuid) return;
    apiTienda
      .get("/whatsapp")
      .then((r) => {
        if (r.data?.data?.status !== "connected") {
          message.info("Conecta tu WhatsApp para recibir y responder mensajes");
          navigate(`/b/${business.uuid}/whatsapp`, { replace: true });
        }
      })
      .catch(() => undefined);
  }, [business?.uuid, navigate]);

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/whatsapp/conversations");
      setLista(r.data.data);
    } catch {
      // se reintenta
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [cargar]);

  return (
    <>
      <PageHeader
        titulo="Mensajes"
        descripcion="Conversaciones con tus clientes. Lo que escriben por WhatsApp aparece aquí y tus respuestas les llegan al mismo chat. Requiere el WhatsApp conectado."
      />

      <div className="card grid h-[70vh] overflow-hidden md:grid-cols-[320px_1fr]">
        <div className="overflow-y-auto border-r border-line-soft">
          {cargando ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : lista.length === 0 ? (
            <Empty className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin conversaciones" />
          ) : (
            lista.map((c) => (
              <button
                key={c.contact}
                onClick={() => setActiva(c)}
                className={`block w-full border-b border-line-soft px-4 py-3 text-left transition hover:bg-canvas ${
                  activa?.contact === c.contact ? "bg-canvas" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-bold text-ink">{c.name ?? `+${c.phone}`}</span>
                  <span className="shrink-0 text-[11px] text-muted">{dayjs(c.lastAt).format("HH:mm")}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-muted">
                    {c.lastDirection === "out" ? "Tú: " : ""}
                    {c.lastMessage}
                  </span>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="min-h-0">
          {activa ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-line-soft px-4 py-3">
                <p className="text-[14px] font-bold text-ink">{activa.name ?? `+${activa.phone}`}</p>
                <p className="text-[11px] text-muted">+{activa.phone}</p>
              </div>
              <div className="min-h-0 flex-1">
                <ChatThread key={activa.contact} contact={activa.contact} phone={activa.phone} onLeido={cargar} />
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-[13px] text-muted">
              Elige una conversación
            </div>
          )}
        </div>
      </div>
    </>
  );
}
