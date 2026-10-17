import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Form, Input, Select, Steps, message } from "antd";
import axios from "axios";
import {
  TbBuildingStore,
  TbCheck,
  TbShirt,
  TbSettings,
  TbToolsKitchen2,
} from "react-icons/tb";
import { apiTienda } from "../api/apiTienda";
import { useAuth } from "../hooks/useAuth";
import PhoneInput from "../components/ui/PhoneInput";
import { errorWhatsapp, opcionesPais } from "../utilities/paises";

type Plantilla = {
  key: string;
  business_type: "retail" | "restaurant";
  label: string;
  description: string;
  categories: number;
  products: number;
  sample: string[];
};

const PALETAS = [
  { nombre: "Violeta", primary: "#5b2be8", secondary: "#f97316" },
  { nombre: "Noche", primary: "#0f172a", secondary: "#f97316" },
  { nombre: "Bosque", primary: "#14532d", secondary: "#eab308" },
  { nombre: "Rojo", primary: "#b91c1c", secondary: "#0ea5e9" },
];

/**
 * Suscripción en 4 pasos: cuenta → rubro → datos de la tienda → listo.
 *
 * Sin sesión crea dueño + negocio de una vez (POST /subscribe). Con sesión
 * salta el paso de cuenta y agrega otro negocio a la misma cuenta
 * (POST /account/businesses): así un dueño puede tener varios negocios.
 */
export default function Subscribe() {
  const navigate = useNavigate();
  const { auth, fetchMe } = useAuth();
  const conSesion = Boolean(auth.user);

  const [form] = Form.useForm();
  const [paso, setPaso] = useState(0);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [dias, setDias] = useState(7);
  const [tipo, setTipo] = useState<"restaurant" | "retail">("restaurant");
  const [plantilla, setPlantilla] = useState<string | null>("polleria");
  const [paleta, setPaleta] = useState(0);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiTienda
      .get("/subscribe/templates")
      .then((r) => {
        setPlantillas(r.data.data.templates);
        setDias(r.data.data.trial_days);
      })
      .catch(() => message.error("No se pudieron cargar las plantillas"));
  }, []);

  const delTipo = useMemo(
    () => plantillas.filter((p) => p.business_type === tipo),
    [plantillas, tipo]
  );

  const elegirTipo = (t: "restaurant" | "retail") => {
    setTipo(t);
    setPlantilla(plantillas.find((p) => p.business_type === t)?.key ?? null);
  };

  // Con sesión no hay paso de cuenta: los pasos se desplazan uno.
  const etiquetas = conSesion
    ? ["Tu negocio", "Tu tienda", "Listo"]
    : ["Tu cuenta", "Tu negocio", "Tu tienda", "Listo"];
  const indice = conSesion ? paso + 1 : paso; // 0 cuenta,1 negocio,2 tienda,3 listo

  const camposPaso: Record<number, string[]> = {
    0: ["owner_name", "owner_email", "owner_password", "owner_password2"],
    2: ["name", "whatsapp_phone", "city", "address", "schedule"],
  };

  const siguiente = async () => {
    const campos = camposPaso[indice];
    if (campos) {
      try {
        await form.validateFields(campos);
      } catch {
        return;
      }
    }
    setPaso((p) => p + 1);
  };

  const crear = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    const v = form.getFieldsValue(true);
    const pal = PALETAS[paleta];
    const business = {
      name: v.name,
      business_type: tipo,
      template: plantilla ?? undefined,
      whatsapp_phone: String(v.whatsapp_phone).replace(/\D/g, ""),
      country: v.country ?? "PE",
      city: v.city || undefined,
      address: v.address || undefined,
      schedule: v.schedule || undefined,
      primary_color: pal.primary,
      secondary_color: pal.secondary,
    };

    setEnviando(true);
    try {
      let uuid: string;
      if (conSesion) {
        const r = await apiTienda.post("/account/businesses", business);
        uuid = r.data.data.business.uuid;
        await fetchMe(auth.token!);
      } else {
        const r = await apiTienda.post("/subscribe", {
          owner: {
            name: v.owner_name,
            email: v.owner_email,
            password: v.owner_password,
          },
          business,
        });
        localStorage.setItem("token", r.data.data.token.token ?? r.data.data.token);
        uuid = r.data.data.business.uuid;
        // Recarga completa: el AuthProvider lee el token al arrancar.
        window.location.href = `/b/${uuid}/dashboard`;
        return;
      }
      message.success("¡Negocio listo! Tu prueba gratis ya corre.");
      navigate(`/b/${uuid}/dashboard`);
    } catch (e) {
      let msg = "No se pudo crear la cuenta. Intenta de nuevo.";
      if (axios.isAxiosError(e)) {
        const errores = e.response?.data?.errors as { message: string }[] | undefined;
        msg = errores?.[0]?.message ?? e.response?.data?.message ?? msg;
        // Un correo repetido se corrige en el primer paso, no al final.
        if (errores?.some((x) => (x as any).field === "owner.email")) setPaso(0);
      }
      message.error(msg);
    } finally {
      setEnviando(false);
    }
  };

  const vista = indice; // 0..3 semántico
  const resumenPlantilla = plantillas.find((p) => p.key === plantilla);

  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-white">
            T
          </div>
          <h1 className="text-[26px] font-extrabold text-ink">
            {conSesion ? "Agrega otro negocio" : `Prueba gratis ${dias} días`}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            Configúralo en 3 minutos y empieza a vender con productos de ejemplo.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <Steps
            size="small"
            current={paso}
            items={etiquetas.map((t) => ({ title: t }))}
            className="mb-7"
          />

          <Form form={form} layout="vertical" requiredMark={false} size="large" initialValues={{ country: "PE" }}>
            {/* 0 · Cuenta */}
            <div hidden={vista !== 0}>
              <Form.Item
                label="Tu nombre"
                name="owner_name"
                rules={[{ required: true, min: 3, message: "Escribe tu nombre (mín. 3 letras)" }]}
              >
                <Input placeholder="María Pérez" autoComplete="name" />
              </Form.Item>
              <Form.Item
                label="Correo electrónico"
                name="owner_email"
                rules={[
                  { required: true, message: "Escribe tu correo" },
                  { type: "email", message: "Ese correo no parece válido" },
                ]}
              >
                <Input placeholder="tu@correo.com" autoComplete="email" />
              </Form.Item>
              <Form.Item
                label="Contraseña"
                name="owner_password"
                rules={[{ required: true, min: 8, message: "Mínimo 8 caracteres" }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                label="Repite la contraseña"
                name="owner_password2"
                dependencies={["owner_password"]}
                rules={[
                  { required: true, message: "Repite la contraseña" },
                  ({ getFieldValue }) => ({
                    validator: (_, value) =>
                      !value || getFieldValue("owner_password") === value
                        ? Promise.resolve()
                        : Promise.reject(new Error("Las contraseñas no coinciden")),
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </div>

            {/* 1 · Rubro y plantilla */}
            <div hidden={vista !== 1}>
              <p className="mb-2 text-[13px] font-semibold text-ink">¿Qué tipo de negocio es?</p>
              <div className="mb-5 grid grid-cols-2 gap-3">
                {[
                  { k: "restaurant" as const, t: "Restaurante", i: <TbToolsKitchen2 /> },
                  { k: "retail" as const, t: "Tienda", i: <TbShirt /> },
                ].map((o) => (
                  <button
                    type="button"
                    key={o.k}
                    onClick={() => elegirTipo(o.k)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      tipo === o.k
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-line hover:border-brand-300"
                    }`}
                  >
                    <span className="text-2xl text-brand-600">{o.i}</span>
                    <span className="text-[14px] font-bold text-ink">{o.t}</span>
                  </button>
                ))}
              </div>

              <p className="mb-2 text-[13px] font-semibold text-ink">
                Empieza con productos de ejemplo
              </p>
              <div className="space-y-2.5">
                {delTipo.map((p) => (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setPlantilla(p.key)}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      plantilla === p.key
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-line hover:border-brand-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-ink">{p.label}</span>
                      <span className="text-[12px] text-muted">
                        {p.products} productos · {p.categories} categorías
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted">{p.sample.join(" · ")}…</p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPlantilla(null)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    plantilla === null
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                      : "border-line hover:border-brand-300"
                  }`}
                >
                  <span className="text-[14px] font-bold text-ink">Empezar vacío</span>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Subes tus propios productos desde cero.
                  </p>
                </button>
              </div>
            </div>

            {/* 2 · Tienda */}
            <div hidden={vista !== 2}>
              <Form.Item
                label="Nombre del negocio"
                name="name"
                rules={[{ required: true, min: 2, message: "Escribe el nombre de tu negocio" }]}
              >
                <Input placeholder="Pollería Don Pepe" />
              </Form.Item>
              <Form.Item
                label="País"
                name="country"
                extra="Define tu impuesto (IGV o IVA) y el formato de tu WhatsApp."
              >
                <Select options={opcionesPais} />
              </Form.Item>
              <Form.Item
                label="WhatsApp donde recibes pedidos"
                name="whatsapp_phone"
                extra="Solo se aceptan números de tu país."
                rules={[
                  { required: true, message: "Escribe tu WhatsApp" },
                  {
                    validator: (_, v) => {
                      const error = errorWhatsapp(form.getFieldValue("country") ?? "PE", v);
                      return error ? Promise.reject(new Error(error)) : Promise.resolve();
                    },
                  },
                ]}
              >
                <PhoneInput pais={form.getFieldValue("country") ?? "PE"} />
              </Form.Item>
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Form.Item label="Ciudad" name="city">
                  <Input placeholder="Lima" />
                </Form.Item>
                <Form.Item label="Horario" name="schedule">
                  <Input placeholder="Lun a Dom 12:00 - 23:00" />
                </Form.Item>
              </div>
              <Form.Item label="Dirección" name="address">
                <Input placeholder="Av. Principal 123" />
              </Form.Item>

              <p className="mb-2 text-[13px] font-semibold text-ink">Colores de tu tienda</p>
              <div className="flex flex-wrap gap-2.5">
                {PALETAS.map((p, i) => (
                  <button
                    type="button"
                    key={p.nombre}
                    onClick={() => setPaleta(i)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                      paleta === i ? "border-brand-500 ring-1 ring-brand-500" : "border-line"
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full" style={{ background: p.primary }} />
                    <span className="h-4 w-4 rounded-full" style={{ background: p.secondary }} />
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 · Resumen */}
            <div hidden={vista !== 3}>
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
                  <TbSettings className="text-brand-600" /> Todo listo para crear tu negocio
                </p>
                <ul className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                  <li className="flex gap-2">
                    <TbCheck className="mt-0.5 shrink-0 text-ok" />
                    {tipo === "restaurant" ? "Restaurante" : "Tienda"} · {form.getFieldValue("name") || "—"}
                  </li>
                  <li className="flex gap-2">
                    <TbCheck className="mt-0.5 shrink-0 text-ok" />
                    {resumenPlantilla
                      ? `${resumenPlantilla.products} productos de ejemplo (${resumenPlantilla.label})`
                      : "Catálogo vacío"}
                  </li>
                  <li className="flex gap-2">
                    <TbCheck className="mt-0.5 shrink-0 text-ok" />
                    Tienda online activa y lista para compartir
                  </li>
                  <li className="flex gap-2">
                    <TbCheck className="mt-0.5 shrink-0 text-ok" />
                    {dias} días de prueba gratis, sin tarjeta
                  </li>
                </ul>
              </div>
            </div>
          </Form>

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button disabled={paso === 0 || enviando} onClick={() => setPaso((p) => p - 1)}>
              Atrás
            </Button>
            {paso < etiquetas.length - 1 ? (
              <Button type="primary" onClick={siguiente} className="!font-semibold">
                Continuar
              </Button>
            ) : (
              <Button
                type="primary"
                loading={enviando}
                onClick={crear}
                icon={<TbBuildingStore />}
                className="!font-semibold"
              >
                Crear mi negocio
              </Button>
            )}
          </div>
        </div>

        {!conSesion && (
          <p className="mt-5 text-center text-[13px] text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link to="/" className="font-semibold text-brand-600">
              Ingresar
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
