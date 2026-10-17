import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, message } from "antd";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import { usePolling } from "../../hooks/usePolling";

interface Mensaje {
  id: number;
  direction: "in" | "out";
  body: string;
  createdAt: string;
}

interface Props {
  pedidoId: number;
  onMeta?: (meta: { hasAccount: boolean }) => void;
}

/** Hilo del pedido dentro de la plataforma: no depende de WhatsApp. */
export default function ChatPlataforma({ pedidoId, onMeta }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const cantidad = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get(`/orders/${pedidoId}/messages`);
      setMensajes(r.data.data);
      if (r.data.meta) onMeta?.(r.data.meta);
    } catch {
      // se reintenta en el siguiente ciclo
    }
  }, [pedidoId, onMeta]);

  const refrescar = usePolling(cargar, 6000);

  useEffect(() => {
    setMensajes([]);
    cantidad.current = 0;
    refrescar();
  }, [pedidoId, refrescar]);

  useEffect(() => {
    if (mensajes.length !== cantidad.current) {
      cantidad.current = mensajes.length;
      fin.current?.scrollIntoView({ block: "end" });
    }
  }, [mensajes]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      await apiTienda.post(`/orders/${pedidoId}/messages`, { body: t });
      setTexto("");
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-canvas p-4">
        {mensajes.length === 0 && (
          <p className="py-10 text-center text-[13px] text-muted">
            Aún no hay mensajes en este pedido. Escribe abajo para iniciar.
          </p>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] ${
                m.direction === "out" ? "bg-brand-600 text-white" : "bg-white text-ink ring-1 ring-line"
              }`}
            >
              {m.body}
              <span className="mt-1 block text-right text-[10px] opacity-60">
                {dayjs(m.createdAt).format("DD/MM HH:mm")}
              </span>
            </div>
          </div>
        ))}
        <div ref={fin} />
      </div>

      <div className="flex gap-2 border-t border-line bg-white p-3">
        <Input.TextArea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="Escribe un mensaje…"
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <Button type="primary" loading={enviando} onClick={enviar}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
