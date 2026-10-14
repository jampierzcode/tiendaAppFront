import { useCallback, useEffect, useState } from "react";
import { Button, Input, Spin, Tag, message } from "antd";
import QRCode from "qrcode";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Estado {
  desired: "connected" | "disconnected";
  status: "disconnected" | "connecting" | "qr" | "connected";
  qr: string | null;
  connectedPhone: string | null;
  pendingMessages: number;
  templates: Record<string, string>;
  defaults: Record<string, string>;
}

const EVENTOS: [string, string][] = [
  ["recibido", "Pedido recibido"],
  ["confirmado", "Pedido confirmado"],
  ["preparando", "En preparación"],
  ["listo", "Listo para recoger / servir"],
  ["enviado", "En camino"],
  ["entregado", "Entregado"],
  ["cancelado", "Cancelado"],
];

const VARIABLES = ["{{cliente}}", "{{codigo}}", "{{tienda}}", "{{total}}", "{{entrega}}", "{{seguimiento}}"];

const ETIQUETA: Record<Estado["status"], { texto: string; color: string }> = {
  disconnected: { texto: "Desconectado", color: "default" },
  connecting: { texto: "Conectando…", color: "processing" },
  qr: { texto: "Esperando escaneo", color: "warning" },
  connected: { texto: "Conectado", color: "success" },
};

/**
 * Conexión del número de WhatsApp del negocio y plantillas de aviso.
 * El panel solo pide el estado y muestra el QR; quien conecta es el bot.
 */
export default function WhatsappPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [editado, setEditado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/whatsapp");
      const d = r.data.data as Estado;
      setEstado(d);
      setPlantillas((actual) => (Object.keys(actual).length ? actual : d.templates));
    } catch {
      message.error("No se pudo consultar WhatsApp");
    }
  }, []);

  useEffect(() => {
    cargar();
    // Mientras se conecta, el QR rota cada ~20 s: se consulta seguido.
    const t = setInterval(cargar, 2000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!estado?.qr) {
      setQrImg(null);
      return;
    }
    QRCode.toDataURL(estado.qr, { width: 320, margin: 1 })
      .then(setQrImg)
      .catch(() => setQrImg(null));
  }, [estado?.qr]);

  const accion = async (ruta: "connect" | "disconnect") => {
    try {
      await apiTienda.post(`/whatsapp/${ruta}`);
      cargar();
    } catch {
      message.error("No se pudo completar la acción");
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await apiTienda.put("/whatsapp/templates", { templates: plantillas });
      message.success("Plantillas guardadas");
      setEditado(false);
    } catch {
      message.error("No se pudieron guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (!estado) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const et = ETIQUETA[estado.status];
  const activo = estado.desired === "connected";

  return (
    <>
      <PageHeader
        titulo="WhatsApp"
        descripcion="Conecta el número del negocio para avisar a tus clientes en cada paso del pedido y responder «menú» o «mi pedido» automáticamente."
      />

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <section className="card h-fit p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Conexión</p>
            <Tag color={et.color}>{et.texto}</Tag>
          </div>

          {estado.status === "connected" && (
            <p className="mt-3 text-[13px] text-ink-soft">
              Número vinculado: <b>{estado.connectedPhone ?? "—"}</b>
              <br />
              Mensajes en cola: <b>{estado.pendingMessages}</b>
            </p>
          )}

          {estado.status === "qr" && (
            <div className="mt-4">
              {qrImg ? (
                <img src={qrImg} alt="QR de WhatsApp" className="mx-auto w-full max-w-[280px]" />
              ) : (
                <Spin />
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                En el celular: WhatsApp → Dispositivos vinculados → Vincular un dispositivo, y
                escanea este código.
              </p>
            </div>
          )}

          {estado.status === "connecting" && (
            <p className="mt-4 text-[13px] text-muted">
              Iniciando la sesión… si no avanza en un minuto, revisa que el servicio del bot esté
              encendido.
            </p>
          )}

          <div className="mt-5">
            {activo ? (
              <Button danger block onClick={() => accion("disconnect")}>
                Desconectar
              </Button>
            ) : (
              <Button type="primary" block onClick={() => accion("connect")}>
                Conectar WhatsApp
              </Button>
            )}
          </div>

          <p className="mt-4 rounded-lg bg-warn-bg px-3 py-2 text-[12px] leading-relaxed text-warn">
            Usa un número dedicado al negocio y escribe solo a clientes que hicieron un pedido.
            WhatsApp puede bloquear números con envíos masivos.
          </p>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Mensajes por estado</p>
            <Button type="primary" disabled={!editado} loading={guardando} onClick={guardar}>
              Guardar
            </Button>
          </div>

          <p className="mt-2 text-[12px] text-muted">
            Variables:{" "}
            {VARIABLES.map((v) => (
              <code key={v} className="mr-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">
                {v}
              </code>
            ))}
          </p>

          <div className="mt-4 space-y-4">
            {EVENTOS.map(([clave, titulo]) => (
              <div key={clave}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-ink">{titulo}</label>
                  {plantillas[clave] !== estado.defaults[clave] && (
                    <button
                      className="text-[12px] text-brand-600"
                      onClick={() => {
                        setPlantillas((p) => ({ ...p, [clave]: estado.defaults[clave] }));
                        setEditado(true);
                      }}
                    >
                      Restablecer
                    </button>
                  )}
                </div>
                <Input.TextArea
                  rows={2}
                  value={plantillas[clave] ?? ""}
                  maxLength={1000}
                  onChange={(e) => {
                    setPlantillas((p) => ({ ...p, [clave]: e.target.value }));
                    setEditado(true);
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
