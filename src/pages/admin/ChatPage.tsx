import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Spin, Tag, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../context/BusinessContext";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import { usePolling } from "../../hooks/usePolling";
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
  /** El dueño tomó la conversación: el asistente de IA no responde por ahora. */
  agentPaused?: boolean;
  /** Por qué se pausó (respondiste a mano, el asistente derivó, etc.). */
  agentPauseReason?: string | null;
  agentPausedUntil?: string | null;
}

/** Bandeja de conversaciones por WhatsApp: lo que escribe el cliente llega aquí. */
export default function ChatPage() {
  const [lista, setLista] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState<Conversacion | null>(null);
  const navigate = useNavigate();
  const { business } = useBusiness();
  // ¿Responde el asistente de IA en este negocio? (encendido y con clave en el servidor)
  const [asistente, setAsistente] = useState(false);

  // Sin WhatsApp conectado esta bandeja no sirve: se manda a conectarlo.
  useEffect(() => {
    if (!business?.uuid) return;
    apiTienda
      .get("/whatsapp")
      .then((r) => {
        const agente = r.data?.data?.agent;
        setAsistente(Boolean(agente?.enabled && agente?.available));
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

  usePolling(cargar, 8000);

  // La conversación abierta con sus datos frescos (la pausa cambia sola).
  const actual = activa ? lista.find((c) => c.contact === activa.contact) ?? activa : null;

  const devolverAlAsistente = async (contact: string) => {
    try {
      await apiTienda.post(`/whatsapp/conversations/${contact}/resume-agent`);
      message.success("El asistente vuelve a responder a este cliente");
      cargar();
    } catch {
      message.error("No se pudo reactivar el asistente");
    }
  };

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
                  <span className="truncate text-[13px] font-bold text-ink">
                    {c.name ?? `+${c.phone}`}
                    {c.agentPaused && (
                      <span
                        className="ml-1.5 rounded bg-warn-bg px-1 text-[10px] font-semibold text-warn"
                        title={c.agentPauseReason ?? undefined}
                      >
                        Tú atiendes
                      </span>
                    )}
                  </span>
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
          {actual ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-ink">{actual.name ?? `+${actual.phone}`}</p>
                  <p className="text-[11px] text-muted">+{actual.phone}</p>
                </div>
                {!asistente ? null : actual.agentPaused ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Tag
                      color="warning"
                      className="m-0"
                      title={[
                        actual.agentPauseReason,
                        actual.agentPausedUntil ? `Vuelve solo a las ${dayjs(actual.agentPausedUntil).format("HH:mm")}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      Asistente en pausa
                    </Tag>
                    <Button size="small" onClick={() => devolverAlAsistente(actual.contact)}>
                      Devolver al asistente
                    </Button>
                  </div>
                ) : (
                  <Tag color="success" className="m-0 shrink-0">Asistente activo</Tag>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <ChatThread key={actual.contact} contact={actual.contact} phone={actual.phone} onLeido={cargar} />
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
