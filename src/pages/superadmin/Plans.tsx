import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  message,
} from "antd";
import { TbCheck, TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import type { FuncionCatalogo, Plan } from "../../types/main";
import { soles } from "../../utilities/planes";

const TIPO = { restaurant: "Restaurante", retail: "Tienda" } as const;

const errorDe = (e: unknown, porDefecto: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto;

interface FormPlan {
  name: string;
  tagline?: string;
  description?: string;
  businessType?: "restaurant" | "retail" | "";
  features: string[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  precioMes?: number | null;
  mesActivo: boolean;
  precioAnio?: number | null;
  anioActivo: boolean;
}

/** Planes comerciales: funciones que incluye cada uno y sus precios mensual y anual. */
export default function PlansPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [catalogo, setCatalogo] = useState<FuncionCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Plan | "nuevo" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm<FormPlan>();

  const cargar = async () => {
    setCargando(true);
    try {
      const [p, f] = await Promise.all([apiTienda.get("/plans"), apiTienda.get("/plans/features")]);
      setPlanes(p.data.data);
      setCatalogo(f.data.data);
    } catch {
      message.error("No se pudieron cargar los planes");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrir = (p: Plan | "nuevo") => {
    setEditando(p);
    const mes = p !== "nuevo" ? p.prices?.find((x) => x.interval === "month") : undefined;
    const anio = p !== "nuevo" ? p.prices?.find((x) => x.interval === "year") : undefined;
    form.setFieldsValue(
      p === "nuevo"
        ? {
            name: "",
            businessType: "restaurant",
            features: ["carta", "qr"],
            isFeatured: false,
            isActive: true,
            sortOrder: planes.length + 1,
            precioMes: null,
            mesActivo: true,
            precioAnio: null,
            anioActivo: true,
          }
        : {
            name: p.name,
            tagline: p.tagline ?? "",
            description: p.description ?? "",
            businessType: p.businessType ?? "",
            features: p.features,
            isFeatured: p.isFeatured,
            isActive: p.isActive,
            sortOrder: p.sortOrder,
            precioMes: mes?.price ?? null,
            mesActivo: mes?.isActive ?? true,
            precioAnio: anio?.price ?? null,
            anioActivo: anio?.isActive ?? true,
          }
    );
  };

  const guardar = async () => {
    const v = await form.validateFields();
    const prices = [
      v.precioMes != null && { interval: "month", price: v.precioMes, isActive: v.mesActivo },
      v.precioAnio != null && { interval: "year", price: v.precioAnio, isActive: v.anioActivo },
    ].filter(Boolean);
    const body = {
      name: v.name,
      tagline: v.tagline || null,
      description: v.description || null,
      businessType: v.businessType || null,
      features: v.features,
      isFeatured: v.isFeatured,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
      prices,
    };
    setGuardando(true);
    try {
      if (editando === "nuevo") await apiTienda.post("/plans", body);
      else if (editando) await apiTienda.put(`/plans/${editando.id}`, body);
      message.success("Plan guardado");
      setEditando(null);
      cargar();
    } catch (e) {
      message.error(errorDe(e, "No se pudo guardar"));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (p: Plan) => {
    try {
      await apiTienda.delete(`/plans/${p.id}`);
      message.success("Plan eliminado");
      cargar();
    } catch (e) {
      message.error(errorDe(e, "No se pudo eliminar"));
    }
  };

  return (
    <>
      <PageHeader
        titulo="Planes"
        descripcion="Qué incluye cada plan y cuánto cuesta. Cambiar un precio no altera lo ya cobrado; cambiar las funciones sí afecta a los negocios que lo tienen."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => abrir("nuevo")}>
            Nuevo plan
          </Button>
        }
      />

      {cargando ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planes.map((p) => (
            <div key={p.id} className={`card flex flex-col p-5 ${p.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[17px] font-bold text-ink">{p.name}</h3>
                  <p className="text-[12px] text-muted">
                    {p.businessType ? TIPO[p.businessType] : "Cualquier rubro"} · {p.businessesCount ?? 0}{" "}
                    {p.businessesCount === 1 ? "negocio" : "negocios"}
                  </p>
                </div>
                <Space size={4}>
                  {p.isFeatured && <Tag color="purple">Más elegido</Tag>}
                  {!p.isActive && <Tag>Inactivo</Tag>}
                </Space>
              </div>
              {p.tagline && <p className="mt-2 text-[13px] text-ink-soft">{p.tagline}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {p.prices?.map((x) => (
                  <span key={x.id} className={`pill ${x.isActive ? "bg-brand-50 text-brand-700" : "bg-canvas text-muted line-through"}`}>
                    {soles(x.price)} {x.interval === "month" ? "/ mes" : "/ año"}
                  </span>
                ))}
              </div>
              <ul className="mt-4 flex-1 space-y-1">
                {catalogo
                  .filter((f) => p.features.includes(f.key))
                  .map((f) => (
                    <li key={f.key} className="flex items-center gap-2 text-[12.5px] text-ink">
                      <TbCheck className="text-ok" /> {f.label}
                    </li>
                  ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button icon={<TbPencil />} onClick={() => abrir(p)}>
                  Editar
                </Button>
                <Popconfirm
                  title="¿Eliminar este plan?"
                  description="Solo se puede si nunca se vendió; si no, desactívalo."
                  okText="Eliminar"
                  cancelText="No"
                  onConfirm={() => borrar(p)}
                >
                  <Button danger icon={<TbTrash />} />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editando !== null}
        title={editando === "nuevo" ? "Nuevo plan" : `Editar «${editando?.name ?? ""}»`}
        okText="Guardar"
        cancelText="Cancelar"
        onOk={guardar}
        confirmLoading={guardando}
        onCancel={() => setEditando(null)}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "Ponle un nombre" }]}>
              <Input placeholder="Pedidos" />
            </Form.Item>
            <Form.Item name="businessType" label="Rubro">
              <Select
                options={[
                  { value: "restaurant", label: "Restaurante" },
                  { value: "retail", label: "Tienda" },
                  { value: "", label: "Cualquier rubro" },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="tagline" label="Frase corta">
            <Input placeholder="Recibe pedidos en línea y organiza tu cocina." />
          </Form.Item>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item label="Precio mensual (S/)">
              <Space>
                <Form.Item name="precioMes" noStyle>
                  <InputNumber min={0} precision={2} style={{ width: 140 }} placeholder="39.90" />
                </Form.Item>
                <Form.Item name="mesActivo" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Visible" unCheckedChildren="Oculto" />
                </Form.Item>
              </Space>
            </Form.Item>
            <Form.Item label="Precio anual (S/)" extra="Ej.: 10 × el mensual = 2 meses gratis.">
              <Space>
                <Form.Item name="precioAnio" noStyle>
                  <InputNumber min={0} precision={2} style={{ width: 140 }} placeholder="399.00" />
                </Form.Item>
                <Form.Item name="anioActivo" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Visible" unCheckedChildren="Oculto" />
                </Form.Item>
              </Space>
            </Form.Item>
          </div>

          <Form.Item name="features" label="Funciones incluidas">
            <Checkbox.Group className="grid w-full gap-1 sm:grid-cols-2">
              {catalogo.map((f) => (
                <Checkbox key={f.key} value={f.key}>
                  <span className="text-[13px] font-semibold">{f.label}</span>
                  <span className="block text-[11.5px] text-muted">{f.detalle}</span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>

          <div className="grid gap-x-4 sm:grid-cols-3">
            <Form.Item name="isFeatured" label="Destacar" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isActive" label="Activo" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="sortOrder" label="Orden">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}
