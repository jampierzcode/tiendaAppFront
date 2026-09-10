import { useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Spin,
  Switch,
  Tabs,
  Tooltip,
  message,
} from "antd";
import QRCode from "qrcode";
import { motion } from "motion/react";
import { TbBrandWhatsapp, TbDownload, TbExternalLink, TbPalette } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import GalleryModal from "../../components/admin/GalleryModal";

interface Config {
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  whatsappPhone: string | null;
  whatsappMessageTemplate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  schedule: string | null;
  primaryColor: string;
  secondaryColor: string;
  bannerImageId: number | null;
  currencySymbol: string;
  shippingCost: number;
  freeShippingFrom: number | null;
  isPublic: boolean;
}

/** Lo que se puede intercalar en el mensaje, con lo que pone cada uno. */
const PLACEHOLDERS: [string, string][] = [
  ["{{tienda}}", "nombre de tu tienda"],
  ["{{codigo}}", "código del pedido"],
  ["{{cliente}}", "nombre del cliente"],
  ["{{productos}}", "lista de lo pedido"],
  ["{{subtotal}}", "antes del envío"],
  ["{{envio}}", "costo del envío"],
  ["{{total}}", "total a pagar"],
  ["{{entrega}}", "envío o recojo"],
  ["{{nota}}", "nota del cliente"],
];

export default function StoreSettingsPage() {
  const [form] = Form.useForm();
  const [config, setConfig] = useState<Config | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);
  const [banner, setBanner] = useState<{ id: number; url: string } | null>(null);

  const urlTienda = config ? `${window.location.origin}/t/${config.slug}` : "";

  useEffect(() => {
    apiTienda
      .get("/store-settings")
      .then((r) => {
        const d = r.data.data as Config;
        setConfig(d);
        form.setFieldsValue({
          ...d,
          whatsapp_phone: d.whatsappPhone,
          whatsapp_message_template: d.whatsappMessageTemplate,
          primary_color: d.primaryColor,
          secondary_color: d.secondaryColor,
          shipping_cost: d.shippingCost,
          free_shipping_from: d.freeShippingFrom,
          is_public: d.isPublic,
          logo_url: d.logoUrl,
        });
      })
      .catch(() => message.error("No se pudo cargar la configuración"))
      .finally(() => setCargando(false));
  }, [form]);

  // El QR se genera en el navegador: no hace falta pedirlo a ningún servicio.
  useEffect(() => {
    if (!urlTienda) return;
    QRCode.toDataURL(urlTienda, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#151243", light: "#FFFFFF" },
    })
      .then(setQr)
      .catch(() => undefined);
  }, [urlTienda]);

  const guardar = async (valores: any) => {
    setGuardando(true);
    try {
      const r = await apiTienda.put("/store-settings", {
        ...valores,
        banner_image_id: banner?.id ?? config?.bannerImageId ?? null,
      });
      setConfig(r.data.data);
      message.success("Configuración guardada");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const descargarQr = () => {
    if (!qr || !config) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `qr-${config.slug}.png`;
    a.click();
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Mi tienda"
        descripcion="Cómo se ve tu tienda para el cliente y a qué WhatsApp llegan los pedidos."
        acciones={
          <a href={urlTienda} target="_blank" rel="noopener noreferrer">
            <Button icon={<TbExternalLink />}>Ver tienda</Button>
          </a>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Form
          form={form}
          layout="vertical"
          onFinish={guardar}
          className="card overflow-hidden"
        >
          <Tabs
            // El padding va en la barra, no en la tarjeta: así el borde
            // inferior de las pestañas cruza la tarjeta entera.
            tabBarStyle={{ paddingInline: 20, marginBottom: 0 }}
            items={[
              {
                key: "general",
                label: "General",
                children: (
                  <div className="banda-form space-y-1 p-5">
                    <Form.Item
                      name="name"
                      label="Nombre de la tienda"
                      rules={[{ required: true, message: "Ponle un nombre" }]}
                    >
                      <Input placeholder="VISULL BOUTIQUE" />
                    </Form.Item>

                    <Form.Item
                      name="slug"
                      label="Dirección pública"
                      extra={`Tu tienda vivirá en ${window.location.origin}/t/…`}
                    >
                      <Input addonBefore="/t/" placeholder="visull-boutique" />
                    </Form.Item>

                    <Form.Item name="description" label="Descripción">
                      <Input.TextArea
                        rows={2}
                        placeholder="Moda femenina con estilo. Envíos a todo el Perú."
                      />
                    </Form.Item>

                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Form.Item name="city" label="Ciudad">
                        <Input placeholder="Lima" />
                      </Form.Item>
                      <Form.Item name="address" label="Dirección">
                        <Input placeholder="Jr. Gamarra 1234" />
                      </Form.Item>
                    </div>

                    <Form.Item name="schedule" label="Horario de atención">
                      <Input placeholder="Lun a Sáb 10:00 - 20:00" />
                    </Form.Item>

                    <div className="grid gap-x-4 sm:grid-cols-3">
                      <Form.Item name="instagram" label="Instagram">
                        <Input addonBefore="@" placeholder="visullboutique" />
                      </Form.Item>
                      <Form.Item name="facebook" label="Facebook">
                        <Input placeholder="visullboutique" />
                      </Form.Item>
                      <Form.Item name="tiktok" label="TikTok">
                        <Input addonBefore="@" placeholder="visullboutique" />
                      </Form.Item>
                    </div>
                  </div>
                ),
              },
              {
                key: "whatsapp",
                label: (
                  <span className="flex items-center gap-1.5">
                    <TbBrandWhatsapp /> WhatsApp
                  </span>
                ),
                children: (
                  <div className="banda-form space-y-1 p-5">
                    <Form.Item
                      name="whatsapp_phone"
                      label="Número que recibe los pedidos"
                      extra="Con código de país y sin signos. Perú: 51 + tu número, por ejemplo 51987654321."
                      rules={[
                        {
                          pattern: /^\d{9,15}$/,
                          message: "Solo dígitos, incluyendo el código de país",
                        },
                      ]}
                    >
                      <Input placeholder="51987654321" />
                    </Form.Item>

                    <Form.Item
                      name="whatsapp_message_template"
                      label="Mensaje que te llega"
                      extra={
                        <div className="mt-2">
                          <p className="mb-1.5 text-[12px]">
                            Puedes intercalar estas piezas, se reemplazan solas:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {PLACEHOLDERS.map(([clave, que]) => (
                              <Tooltip key={clave} title={que}>
                                <code className="cursor-help rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700">
                                  {clave}
                                </code>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      }
                    >
                      <Input.TextArea
                        rows={8}
                        placeholder={
                          "Hola {{tienda}} 👋\nQuiero hacer este pedido:\n\n{{productos}}\n\nTotal: {{total}}\nEntrega: {{entrega}}\nMi nombre: {{cliente}}\nPedido: {{codigo}}"
                        }
                      />
                    </Form.Item>
                  </div>
                ),
              },
              {
                key: "apariencia",
                label: (
                  <span className="flex items-center gap-1.5">
                    <TbPalette /> Apariencia
                  </span>
                ),
                children: (
                  <div className="banda-form space-y-1 p-5">
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Form.Item
                        name="primary_color"
                        label="Color principal"
                        extra="Cabecera, botones y portada."
                      >
                        <Input type="color" className="h-10 w-full" />
                      </Form.Item>
                      <Form.Item
                        name="secondary_color"
                        label="Color de acento"
                        extra="Insignias y avisos destacados."
                      >
                        <Input type="color" className="h-10 w-full" />
                      </Form.Item>
                    </div>

                    <Form.Item label="Imagen de portada">
                      <div className="flex items-center gap-3">
                        <div className="h-20 w-32 overflow-hidden rounded-lg border border-line bg-canvas">
                          {banner?.url ? (
                            <img src={banner.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-[11px] text-muted">
                              Sin portada
                            </div>
                          )}
                        </div>
                        <Button onClick={() => setGaleriaAbierta(true)}>
                          Elegir de la galería
                        </Button>
                      </div>
                    </Form.Item>

                    <Form.Item name="logo_url" label="URL del logo">
                      <Input placeholder="https://…" />
                    </Form.Item>
                  </div>
                ),
              },
              {
                key: "envios",
                label: "Envíos",
                children: (
                  <div className="banda-form grid gap-x-4 p-5 sm:grid-cols-2">
                    <Form.Item
                      name="shipping_cost"
                      label="Costo de envío"
                      extra="Se suma al total cuando el cliente pide envío a domicilio."
                    >
                      <InputNumber prefix="S/" min={0} step={1} precision={2} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name="free_shipping_from"
                      label="Envío gratis desde"
                      extra="Déjalo vacío si nunca regalas el envío."
                    >
                      <InputNumber prefix="S/" min={0} step={10} precision={2} className="w-full" />
                    </Form.Item>
                  </div>
                ),
              },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-canvas/40 p-5">
            <div className="flex items-center gap-2.5">
              {/* El Switch va dentro del Form.Item, no un div: si no, Antd
                  intenta pasarle `checked` al div y el valor nunca se envía. */}
              <Form.Item name="is_public" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <div>
                <p className="text-[13px] font-semibold text-ink">Tienda publicada</p>
                <p className="text-[12px] text-muted">
                  Apagada, el enlace deja de responder para tus clientes.
                </p>
              </div>
            </div>

            <Button type="primary" htmlType="submit" loading={guardando} size="large">
              Guardar cambios
            </Button>
          </div>
        </Form>

        {/* QR */}
        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card h-fit p-5"
        >
          <p className="eyebrow mb-3">Tu catálogo en un escaneo</p>

          <div className="rounded-xl bg-white p-3 ring-1 ring-line">
            {qr ? (
              <img src={qr} alt="Código QR de la tienda" className="w-full" />
            ) : (
              <div className="grid aspect-square place-items-center">
                <Spin />
              </div>
            )}
          </div>

          <p className="mt-3 break-all font-mono text-[11px] text-muted">{urlTienda}</p>

          <Button
            icon={<TbDownload />}
            onClick={descargarQr}
            block
            className="mt-3"
            disabled={!qr}
          >
            Descargar QR
          </Button>

          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Imprímelo y pégalo en tu tienda, o súbelo a tu estado de WhatsApp e
            Instagram. Lleva directo a tu catálogo, siempre actualizado.
          </p>

          {!config?.whatsappPhone && (
            <Tooltip title="Sin número de WhatsApp la tienda no puede recibir pedidos">
              <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-[12px] font-medium text-warn">
                Configura tu WhatsApp antes de compartir este QR.
              </p>
            </Tooltip>
          )}

        </motion.aside>
      </div>

      <GalleryModal
        open={galeriaAbierta}
        onClose={() => setGaleriaAbierta(false)}
        onSelect={(img) => setBanner(img)}
      />
    </>
  );
}
