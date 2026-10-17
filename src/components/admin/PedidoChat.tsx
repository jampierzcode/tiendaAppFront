import { useEffect, useState } from "react";
import { Alert, Button, Drawer, Segmented, Spin, message } from "antd";
import { useNavigate } from "react-router-dom";
import { TbBrandWhatsapp, TbCopy, TbMail } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import { useBusiness } from "../../context/BusinessContext";
import { dialDePais, errorTelefono, separarTelefono } from "../../utilities/paises";
import ChatThread from "./ChatThread";
import ChatPlataforma from "./ChatPlataforma";

export interface PedidoParaChat {
  id: number;
  code: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail?: string | null;
}

interface Props {
  pedido: PedidoParaChat | null;
  onCerrar: () => void;
}

type Canal = "whatsapp" | "plataforma";

/**
 * Conversación con el cliente de un pedido, con dos canales:
 *  - WhatsApp, si el del negocio está conectado y el número del cliente parece
 *    completo;
 *  - la plataforma, siempre disponible: el cliente lo lee desde «Mi cuenta» si
 *    tiene cuenta, o desde el enlace de su pedido si no.
 * Se elige solo el mejor canal disponible y se puede cambiar a mano.
 */
export default function PedidoChat({ pedido, onCerrar }: Props) {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [tieneCuenta, setTieneCuenta] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { business } = useBusiness();

  const digitos = pedido?.customerPhone?.replace(/\D/g, "") ?? "";
  const tel = separarTelefono(digitos);
  const problemaNumero = digitos
    ? errorTelefono(tel.dial ?? dialDePais(business?.country), tel.nacional)
    : "Este pedido no tiene teléfono";
  const waListo = conectado === true && !problemaNumero;

  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    setConectado(null);
    setTieneCuenta(null);
    apiTienda
      .get("/whatsapp")
      .then((r) => vivo && setConectado(r.data?.data?.status === "connected"))
      .catch(() => vivo && setConectado(false));
    return () => {
      vivo = false;
    };
  }, [pedido?.id]);

  // El mejor canal disponible arranca seleccionado.
  useEffect(() => {
    if (conectado !== null) setCanal(waListo ? "whatsapp" : "plataforma");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, pedido?.id]);

  const enlace = business?.slug && pedido ? `${window.location.origin}/t/${business.slug}/pedido/${pedido.code}` : "";

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      message.success("Enlace copiado");
    } catch {
      message.error("No se pudo copiar");
    }
  };

  const correo = pedido?.customerEmail
    ? `mailto:${pedido.customerEmail}?subject=${encodeURIComponent(`Tu pedido ${pedido.code}`)}&body=${encodeURIComponent(
        `Hola ${pedido.customerName}, te escribimos por tu pedido ${pedido.code}. Puedes verlo y respondernos aquí: ${enlace}`
      )}`
    : null;

  return (
    <Drawer
      open={!!pedido}
      onClose={onCerrar}
      width={440}
      title={pedido ? `${pedido.customerName} · ${pedido.code}` : ""}
      styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
    >
      {!pedido || conectado === null ? (
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      ) : (
        <>
          <div className="space-y-2 border-b border-line p-3">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-ink-soft">
              <span>{pedido.customerPhone ? `📞 ${pedido.customerPhone}` : "Sin teléfono"}</span>
              <span>{pedido.customerEmail ? `✉️ ${pedido.customerEmail}` : "Sin correo"}</span>
            </div>
            <Segmented
              block
              value={canal}
              onChange={(v) => setCanal(v as Canal)}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "plataforma", label: "En la plataforma" },
              ]}
            />
          </div>

          <div className="min-h-0 flex-1">
            {canal === "whatsapp" ? (
              conectado === false ? (
                <div className="p-6 text-center">
                  <TbBrandWhatsapp className="mx-auto text-4xl text-muted" />
                  <p className="mt-3 font-semibold text-ink">Conecta tu WhatsApp primero</p>
                  <p className="mt-1 text-[13px] text-muted">
                    Para escribir por WhatsApp, vincula el WhatsApp de tu negocio escaneando un QR. Mientras tanto
                    puedes escribirle «En la plataforma».
                  </p>
                  <Button
                    type="primary"
                    className="mt-4"
                    onClick={() => business?.uuid && navigate(`/b/${business.uuid}/whatsapp`)}
                  >
                    Conectar WhatsApp
                  </Button>
                </div>
              ) : problemaNumero ? (
                <div className="p-5">
                  <Alert
                    type="warning"
                    showIcon
                    message="El número del cliente no parece válido"
                    description={`${problemaNumero}. Si le escribes por WhatsApp, el mensaje no le llegará. Usa «En la plataforma» o su correo.`}
                  />
                  <Button className="mt-3" onClick={() => setCanal("plataforma")}>
                    Escribirle en la plataforma
                  </Button>
                </div>
              ) : (
                <ChatThread contact={digitos.slice(-9)} phone={digitos} />
              )
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="space-y-2 border-b border-line bg-white p-3 text-[12px] text-ink-soft">
                  {tieneCuenta === null ? null : tieneCuenta ? (
                    <p>✅ El cliente tiene cuenta: verá tu mensaje en «Mi cuenta» y desde el enlace de su pedido.</p>
                  ) : (
                    <p>
                      ℹ️ El cliente no tiene cuenta. Solo verá tu mensaje si abre el enlace de su pedido: envíaselo por
                      WhatsApp o correo.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="small" icon={<TbCopy />} onClick={copiarEnlace} disabled={!enlace}>
                      Copiar enlace del pedido
                    </Button>
                    {correo && (
                      <Button size="small" icon={<TbMail />} href={correo}>
                        Escribir por correo
                      </Button>
                    )}
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <ChatPlataforma pedidoId={pedido.id} onMeta={(m) => setTieneCuenta(m.hasAccount)} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
