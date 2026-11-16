import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Segmented,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  message,
} from "antd";
import { TbEdit, TbPlus, TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import { useBusiness } from "../../context/BusinessContext";
import PageHeader from "../../components/ui/PageHeader";
import ShippingZonesEditor from "../../components/admin/seller/ShippingZonesEditor";
import SedesEditor from "../../components/admin/seller/SedesEditor";
import {
  nuevoId,
  type ConfigVendedor,
  type PreguntaFrecuente,
  type ZonaEnvio,
} from "../../components/admin/seller/tipos";

interface Datos {
  enabled: boolean;
  available: boolean;
  instructions: string;
  config: ConfigVendedor;
  zonas: ZonaEnvio[];
  datosSugeridos: string[];
  currencySymbol: string;
  businessName: string;
  isRestaurant: boolean;
}

const CATEGORIAS_FAQ = ["Productos", "Horarios", "Envíos", "Pagos", "Devoluciones", "Otros"];

const SITUACIONES = [
  "Problema con el pago",
  "Devolución o cambio",
  "Queja grave",
  "Producto no encontrado",
  "Sin stock",
  "Pedido al por mayor",
  "Pide hablar con una persona",
];

const EJEMPLO = `Cliente: Hola, ¿precio del conjunto rojo?
Vendedor: ¡Hola! 😊 El conjunto rojo está a S/129. ¿Qué talla buscas?
Cliente: Talla S. Soy de Jaén, ¿hacen envíos?
Vendedor: La tienda física está en Lima, San Martín de Porres. Sí hacemos envíos a Jaén mediante Shalom 📦 El envío cuesta S/12 y demora de 1 a 3 días hábiles según la ruta. Para reservar el conjunto rojo talla S se solicita un adelanto de S/20; el saldo lo pagas cuando llegue a la agencia.
Vendedor: La agencia disponible en Jaén está en Av. Pakamuros cuadra 6 s/n. ¿Deseas recibirlo allí?
Cliente: Lo reservo
Vendedor: Para reservar el *conjunto rojo talla S*:
*Producto:* S/129
*Envío a la agencia Shalom de Jaén:* S/12
*Total:* S/141
Se requiere un adelanto de S/20. Realiza el pago y envíame la captura del comprobante junto con el método utilizado para continuar con tus datos de entrega.`;

function Campo({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[13px] font-semibold text-ink">{titulo}</label>
      {ayuda && <p className="mb-1.5 text-[12px] text-muted">{ayuda}</p>}
      <div className={ayuda ? "" : "mt-1.5"}>{children}</div>
    </div>
  );
}

/**
 * Vendedor IA: cómo habla, cómo saluda, qué responde y cómo entrega.
 * Todo se guarda junto con «Guardar cambios»; el vendedor lo usa en el
 * siguiente mensaje que reciba.
 */
export default function SellerAgentPage() {
  const { business } = useBusiness();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [config, setConfig] = useState<ConfigVendedor | null>(null);
  const [zonas, setZonas] = useState<ZonaEnvio[]>([]);
  const [instrucciones, setInstrucciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [faq, setFaq] = useState<PreguntaFrecuente | null>(null);
  const [tab, setTab] = useState("personalidad");

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/seller-config");
      const d = r.data.data as Datos;
      setDatos(d);
      setConfig(d.config);
      setZonas(d.zonas);
      setInstrucciones(d.instructions ?? "");
    } catch {
      message.error("No se pudo cargar la configuración del vendedor");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambios = useMemo(() => {
    if (!datos || !config) return false;
    return (
      JSON.stringify(config) !== JSON.stringify(datos.config) ||
      JSON.stringify(zonas) !== JSON.stringify(datos.zonas) ||
      instrucciones !== (datos.instructions ?? "")
    );
  }, [datos, config, zonas, instrucciones]);

  // Avisa antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!cambios) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [cambios]);

  const guardar = async () => {
    if (!config) return;
    setGuardando(true);
    try {
      const r = await apiTienda.put("/seller-config", { config, zonas });
      if (instrucciones !== (datos?.instructions ?? "")) {
        await apiTienda.put("/whatsapp/agent", { instructions: instrucciones });
      }
      const d = r.data.data as { config: ConfigVendedor; zonas: ZonaEnvio[] };
      setDatos((x) => (x ? { ...x, config: d.config, zonas: d.zonas, instructions: instrucciones } : x));
      setConfig(d.config);
      setZonas(d.zonas);
      message.success("Vendedor actualizado");
    } catch {
      message.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const encender = async (v: boolean) => {
    try {
      await apiTienda.put("/whatsapp/agent", { enabled: v });
      setDatos((x) => (x ? { ...x, enabled: v } : x));
      message.success(v ? "Vendedor IA encendido" : "Vendedor IA apagado");
    } catch {
      message.error("No se pudo cambiar");
    }
  };

  if (!datos || !config) {
    return (
      <div className="grid place-items-center py-20">
        <Spin />
      </div>
    );
  }

  const set = (c: Partial<ConfigVendedor>) => setConfig({ ...config, ...c });
  const s = datos.currencySymbol;

  const guardarFaq = () => {
    if (!faq) return;
    if (!faq.pregunta.trim() || !faq.respuesta.trim()) {
      message.warning("Escribe la pregunta y la respuesta");
      return;
    }
    const existe = config.faqs.some((f) => f.id === faq.id);
    set({ faqs: existe ? config.faqs.map((f) => (f.id === faq.id ? faq : f)) : [...config.faqs, faq] });
    setFaq(null);
  };

  const categoriasFaq = [...new Set([...CATEGORIAS_FAQ, ...config.faqs.map((f) => f.categoria)])];

  const personalidad = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <p className="eyebrow">Personalidad</p>
        <Campo titulo="Nombre del vendedor" ayuda="Opcional. Así se presentará si le preguntan.">
          <Input
            maxLength={60}
            value={config.nombre}
            onChange={(e) => set({ nombre: e.target.value })}
            placeholder="Ej.: Sofía"
          />
        </Campo>
        <Campo titulo="¿A quién le vendes?" ayuda="Define el tono con el que habla.">
          <Input.TextArea
            rows={2}
            maxLength={400}
            value={config.publico}
            onChange={(e) => set({ publico: e.target.value })}
            placeholder="Ej.: Mujeres de 18 a 35 años que buscan lencería y ropa a la moda"
          />
        </Campo>
        <Campo titulo="Tono">
          <Segmented
            value={config.tono}
            onChange={(v) => set({ tono: v as ConfigVendedor["tono"] })}
            options={[
              { value: "amigable", label: "Amigable" },
              { value: "profesional", label: "Profesional" },
              { value: "divertido", label: "Divertido" },
              { value: "formal", label: "Formal" },
            ]}
          />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo titulo="Trato">
            <Segmented
              value={config.trato}
              onChange={(v) => set({ trato: v as ConfigVendedor["trato"] })}
              options={[
                { value: "tu", label: "De tú" },
                { value: "usted", label: "De usted" },
              ]}
            />
          </Campo>
          <Campo titulo="Largo de respuestas">
            <Segmented
              value={config.largo}
              onChange={(v) => set({ largo: v as ConfigVendedor["largo"] })}
              options={[
                { value: "corto", label: "Cortas" },
                { value: "medio", label: "Medias" },
              ]}
            />
          </Campo>
        </div>
        <Campo titulo="Emojis">
          <Segmented
            value={config.emojis}
            onChange={(v) => set({ emojis: v as ConfigVendedor["emojis"] })}
            options={[
              { value: "ninguno", label: "Ninguno" },
              { value: "pocos", label: "Pocos 🙂" },
              { value: "muchos", label: "Muchos 🥰✨" },
            ]}
          />
        </Campo>
        <Campo titulo="Palabras a evitar">
          <Input
            maxLength={400}
            value={config.palabrasEvitar}
            onChange={(e) => set({ palabrasEvitar: e.target.value })}
            placeholder="Ej.: barato, oferta, amigo"
          />
        </Campo>
        <Campo titulo="Fotos de productos" ayuda="La respuesta va como texto de la foto, en un solo mensaje.">
          <Radio.Group
            value={config.fotos}
            onChange={(e) => set({ fotos: e.target.value })}
            options={[
              { value: "siempre", label: "Enviar siempre que hable de un producto" },
              { value: "cuando_ayude", label: "Solo cuando ayude a vender" },
              { value: "nunca", label: "Solo si el cliente las pide" },
            ]}
          />
        </Campo>
      </section>

      <div className="space-y-5">
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Saludo de bienvenida</p>
            <Switch
              checked={config.saludo.activo}
              onChange={(v) => set({ saludo: { ...config.saludo, activo: v } })}
            />
          </div>
          <p className="text-[12px] text-muted">
            Se envía cuando un cliente escribe por primera vez, diga lo que diga. Puedes usar{" "}
            <code className="rounded bg-brand-50 px-1 text-brand-700">{"{{tienda}}"}</code> y{" "}
            <code className="rounded bg-brand-50 px-1 text-brand-700">{"{{catalogo}}"}</code> (enlace a tu
            tienda).
          </p>
          <Input.TextArea
            rows={4}
            maxLength={1500}
            showCount
            disabled={!config.saludo.activo}
            value={config.saludo.texto}
            onChange={(e) => set({ saludo: { ...config.saludo, texto: e.target.value } })}
            placeholder={"¡Hola! 👋 Bienvenida a {{tienda}} 💖\nMira todo nuestro catálogo aquí: {{catalogo}}\n¿Qué estás buscando hoy?"}
          />
          <Campo titulo="Cómo se envía">
            <Radio.Group
              disabled={!config.saludo.activo}
              value={config.saludo.modo}
              onChange={(e) => set({ saludo: { ...config.saludo, modo: e.target.value } })}
              className="flex flex-col gap-1"
              options={[
                { value: "adaptado", label: "Adaptado por tu vendedor (lo dice con sus palabras y responde)" },
                { value: "exacto_responde", label: "Exacto y responde la pregunta" },
                { value: "exacto", label: "Exacto, sin responder (responde en el siguiente mensaje)" },
              ]}
            />
          </Campo>
        </section>

        <section className="card space-y-3 p-5">
          <p className="eyebrow">Indicaciones adicionales</p>
          <p className="text-[12px] text-muted">
            Lo demás que el vendedor debe saber o hacer: cambios y devoluciones, garantías, promociones del
            día, cómo cerrar…
          </p>
          <Input.TextArea
            rows={5}
            maxLength={4000}
            showCount
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            placeholder={"Ej.: Los cambios de talla se aceptan hasta 7 días con boleta.\nOfrece siempre el set completo cuando pidan una sola prenda."}
          />
        </section>
      </div>
    </div>
  );

  const faqs = (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Preguntas frecuentes</p>
          <p className="mt-1 text-[12px] text-muted">
            El vendedor las busca por contexto (no por palabras exactas) antes de decir que no sabe algo.
            Solo las activas llegan al cliente.
          </p>
        </div>
        <Button
          type="primary"
          icon={<TbPlus />}
          onClick={() => setFaq({ id: nuevoId(), categoria: "Otros", pregunta: "", respuesta: "", activa: true })}
        >
          Agregar pregunta
        </Button>
      </div>
      {config.faqs.length === 0 ? (
        <Empty description="Aún no agregaste preguntas frecuentes" />
      ) : (
        <div className="divide-y divide-line">
          {config.faqs.map((f) => (
            <div key={f.id} className={`flex items-start justify-between gap-3 py-3 ${f.activa ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <Tag>{f.categoria}</Tag>
                <p className="mt-1 text-[14px] font-semibold text-ink">{f.pregunta}</p>
                <p className="whitespace-pre-line text-[13px] text-ink-soft">{f.respuesta}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  size="small"
                  checked={f.activa}
                  onChange={(v) => set({ faqs: config.faqs.map((x) => (x.id === f.id ? { ...x, activa: v } : x)) })}
                />
                <Button type="text" icon={<TbEdit />} onClick={() => setFaq({ ...f })} />
                <Popconfirm
                  title="¿Eliminar esta pregunta?"
                  okText="Eliminar"
                  cancelText="No"
                  onConfirm={() => set({ faqs: config.faqs.filter((x) => x.id !== f.id) })}
                >
                  <Button type="text" icon={<TbTrash />} />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const reglas = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">Conversación de ejemplo</p>
          {!config.ejemplo && !datos.isRestaurant && (
            <Button size="small" onClick={() => set({ ejemplo: EJEMPLO })}>
              Cargar ejemplo
            </Button>
          )}
        </div>
        <p className="text-[12px] text-muted">
          Pega una conversación real de cómo vendes tú. El vendedor imita el estilo, el orden y la forma de
          cerrar (los precios y datos los saca siempre de tu catálogo y tu configuración).
        </p>
        <Input.TextArea
          rows={14}
          maxLength={4000}
          showCount
          value={config.ejemplo}
          onChange={(e) => set({ ejemplo: e.target.value })}
          placeholder={"Cliente: Hola, ¿precio?\nVendedor: ¡Hola! 😊 …"}
        />
      </section>

      <div className="space-y-5">
        <section className="card space-y-3 p-5">
          <p className="eyebrow">Derivar a una persona</p>
          <p className="text-[12px] text-muted">
            En estas situaciones el vendedor avisa que te pasa la conversación, se calla con ese cliente y te
            llega una notificación. Escribe una propia y presiona Enter.
          </p>
          <Select
            mode="tags"
            className="w-full"
            value={config.derivarCuando}
            onChange={(v) => set({ derivarCuando: v })}
            options={SITUACIONES.map((x) => ({ value: x, label: x }))}
          />
        </section>
        <section className="card space-y-3 p-5">
          <p className="eyebrow">Descuentos permitidos</p>
          <p className="text-[12px] text-muted">
            Por defecto el vendedor nunca rebaja precios. Si quieres que pueda negociar, dile hasta dónde.
          </p>
          <Input.TextArea
            rows={3}
            maxLength={600}
            value={config.descuentos}
            onChange={(e) => set({ descuentos: e.target.value })}
            placeholder="Ej.: Si lleva 3 prendas o más puede dejarle S/10 menos. Nunca más del 10%."
          />
        </section>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        titulo="Vendedor IA"
        descripcion="Cómo atiende, saluda, responde y entrega tu vendedor de WhatsApp. Ya conoce tu catálogo, precios, stock y promociones."
        acciones={
          <>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3">
              <span className="text-[13px] font-semibold text-ink">{datos.enabled ? "Encendido" : "Apagado"}</span>
              <Switch size="small" checked={datos.enabled} onChange={encender} />
            </div>
            <Button type="primary" disabled={!cambios} loading={guardando} onClick={guardar}>
              Guardar cambios
            </Button>
          </>
        }
      />

      {!datos.available && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="El vendedor con IA aún no está activado en el servidor"
          description="Puedes dejarlo configurado; empezará a responder cuando soporte lo active."
        />
      )}

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: "personalidad", label: "Personalidad y saludo", children: personalidad },
          {
            key: "envios",
            label: "Envíos y plazos",
            children: (
              <>
                <p className="mb-3 text-[13px] text-muted">
                  Define las zonas de entrega, los tipos de envío y los plazos que maneja tu vendedor.
                </p>
                <ShippingZonesEditor
                  zonas={zonas}
                  onChange={setZonas}
                  simbolo={s}
                  datosSugeridos={datos.datosSugeridos}
                  mostrarPeru={(business?.country ?? "PE") === "PE"}
                />
              </>
            ),
          },
          ...(datos.isRestaurant
            ? []
            : [
                {
                  key: "sedes",
                  label: `Sedes de agencias${config.sedes?.length ? ` (${config.sedes.length})` : ""}`,
                  children: (
                    <SedesEditor
                      sedes={config.sedes ?? []}
                      onChange={(sedes) => set({ sedes })}
                      empresasSugeridas={[
                        ...new Set(
                          zonas.flatMap((z) => z.tipos.filter((t) => t.clase === "agencia").map((t) => t.nombre))
                        ),
                      ]}
                    />
                  ),
                },
              ]),
          {
            key: "faq",
            label: `Preguntas frecuentes${config.faqs.length ? ` (${config.faqs.length})` : ""}`,
            children: faqs,
          },
          { key: "reglas", label: "Ejemplo y reglas", children: reglas },
        ]}
      />

      {cambios && (
        <div className="sticky bottom-4 z-10 mt-5 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-2 shadow-lg">
            <span className="text-[13px] text-ink-soft">Tienes cambios sin guardar</span>
            <Button type="primary" loading={guardando} onClick={guardar}>
              Guardar cambios
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(faq)}
        title="Pregunta frecuente"
        okText="Listo"
        cancelText="Cancelar"
        onCancel={() => setFaq(null)}
        onOk={guardarFaq}
        destroyOnHidden
      >
        {faq && (
          <div className="space-y-3">
            <Campo titulo="Categoría">
              <AutoComplete
                className="w-full"
                value={faq.categoria}
                maxLength={60}
                onChange={(v) => setFaq({ ...faq, categoria: v })}
                options={categoriasFaq.map((c) => ({ value: c }))}
                placeholder="Productos, Envíos o una propia"
              />
            </Campo>
            <Campo titulo="Pregunta">
              <Input
                maxLength={300}
                value={faq.pregunta}
                onChange={(e) => setFaq({ ...faq, pregunta: e.target.value })}
                placeholder="Ej.: ¿Hacen cambios de talla?"
              />
            </Campo>
            <Campo titulo="Respuesta">
              <Input.TextArea
                rows={4}
                maxLength={1500}
                showCount
                value={faq.respuesta}
                onChange={(e) => setFaq({ ...faq, respuesta: e.target.value })}
                placeholder="Ej.: Sí, dentro de los 7 días con la prenda sin usar y con etiqueta."
              />
            </Campo>
            <div className="flex items-center gap-2">
              <Switch size="small" checked={faq.activa} onChange={(v) => setFaq({ ...faq, activa: v })} />
              <span className="text-[13px] text-ink-soft">Activa</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
