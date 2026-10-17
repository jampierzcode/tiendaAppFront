import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Table,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { TbPlus } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import { useBusiness } from "../../context/BusinessContext";

interface Promo {
  id: number;
  name: string;
  kind: "percent" | "fixed" | "bundle";
  value: number;
  buyQty: number | null;
  payQty: number | null;
  scope: "all" | "selection";
  targets: { kind: "product" | "variation" | "category"; id: number; name: string | null }[];
  weekdays: number[];
  diasTexto: string | null;
  code: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  label: string;
  vigente: boolean;
}

const RAPIDOS_PORCENTAJE = [10, 20, 30, 50];
const RAPIDOS_BUNDLE: [number, number][] = [
  [2, 1],
  [3, 2],
  [3, 1],
];

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

/** Texto corto de a qué aplica la promoción. */
const alcance = (p: Promo) => {
  if (p.scope === "all") return "Toda la tienda";
  const nombres = p.targets.map((t) => t.name).filter(Boolean) as string[];
  if (!nombres.length) return "—";
  return nombres.length <= 2 ? nombres.join(" y ") : `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;
};

const estado = (p: Promo) => {
  if (!p.isActive) return { texto: "Pausada", clase: "bg-line-soft text-muted" };
  const hoy = dayjs().startOf("day");
  if (p.startDate && hoy.isBefore(dayjs(p.startDate))) return { texto: "Programada", clase: "bg-info-bg text-info" };
  if (p.endDate && hoy.isAfter(dayjs(p.endDate).endOf("day"))) return { texto: "Vencida", clase: "bg-line-soft text-muted" };
  return { texto: "Activa", clase: "bg-ok-bg text-ok" };
};

const generarCodigo = () => {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join("");
};

/**
 * Promociones: descuentos por % o monto, «lleva N paga M» y cupones con
 * código, para toda la tienda, una categoría o un producto. Las automáticas
 * se ven en la tienda pública; los cupones los escribe el cliente en su carrito.
 */
export default function DiscountsPage() {
  const { business } = useBusiness();
  const simbolo = (business as any)?.currencySymbol ?? "S/";
  const [promos, setPromos] = useState<Promo[]>([]);
  const [productos, setProductos] = useState<{ id: number; name: string }[]>([]);
  const [variaciones, setVariaciones] = useState<{ id: number; label: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; name: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Promo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();

  const kind = Form.useWatch("kind", form) as Promo["kind"] | undefined;
  const scope = Form.useWatch("scope", form) as Promo["scope"] | undefined;
  const aplicacion = Form.useWatch("aplicacion", form) as "auto" | "codigo" | undefined;
  const vigenciaModo = Form.useWatch("vigenciaModo", form) as "siempre" | "rango" | undefined;
  const diasModo = Form.useWatch("diasModo", form) as "todos" | "algunos" | undefined;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [d, p, c] = await Promise.all([
        apiTienda.get("/discounts"),
        apiTienda.get("/products"),
        apiTienda.get("/categories"),
      ]);
      setPromos(d.data.data ?? []);
      setProductos((p.data.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
      // Variaciones reales (con talla, color…) para promociones sobre una en particular.
      setVariaciones(
        (p.data.data ?? []).flatMap((x: any) =>
          (x.variations ?? [])
            .filter((v: any) => !v.isDefault && (v.attributes ?? []).length > 0)
            .map((v: any) => ({
              id: v.id,
              label: `${x.name} — ${v.attributes.map((a: any) => a.value?.value).filter(Boolean).join(" · ")}`,
            }))
        )
      );
      setCategorias((c.data.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    } catch {
      message.error("No se pudieron cargar las promociones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (p?: Promo) => {
    setEditando(p ?? null);
    form.resetFields();
    form.setFieldsValue(
      p
        ? {
            name: p.name,
            kind: p.kind,
            value: Number(p.value) || undefined,
            buyQty: p.buyQty ?? 2,
            payQty: p.payQty ?? 1,
            scope: p.scope,
            categoryIds: p.targets.filter((t) => t.kind === "category").map((t) => t.id),
            productIds: p.targets.filter((t) => t.kind === "product").map((t) => t.id),
            variationIds: p.targets.filter((t) => t.kind === "variation").map((t) => t.id),
            diasModo: p.weekdays.length ? "algunos" : "todos",
            weekdays: p.weekdays,
            aplicacion: p.code ? "codigo" : "auto",
            code: p.code ?? undefined,
            vigenciaModo: p.startDate || p.endDate ? "rango" : "siempre",
            rango: p.startDate || p.endDate ? [p.startDate ? dayjs(p.startDate) : null, p.endDate ? dayjs(p.endDate) : null] : undefined,
            isActive: p.isActive,
          }
        : {
            kind: "percent",
            scope: "all",
            diasModo: "todos",
            weekdays: [],
            aplicacion: "auto",
            vigenciaModo: "siempre",
            buyQty: 2,
            payQty: 1,
            isActive: true,
          }
    );
    setAbierto(true);
  };

  const guardar = async (v: any) => {
    setGuardando(true);
    try {
      const rango = v.vigenciaModo === "rango" ? v.rango : null;
      const cuerpo = {
        name: v.name,
        kind: v.kind,
        value: v.kind === "bundle" ? undefined : v.value,
        buy_qty: v.kind === "bundle" ? v.buyQty : undefined,
        pay_qty: v.kind === "bundle" ? v.payQty : undefined,
        scope: v.scope,
        targets:
          v.scope === "selection"
            ? [
                ...(v.categoryIds ?? []).map((id: number) => ({ kind: "category", id })),
                ...(v.productIds ?? []).map((id: number) => ({ kind: "product", id })),
                ...(v.variationIds ?? []).map((id: number) => ({ kind: "variation", id })),
              ]
            : [],
        weekdays: v.diasModo === "algunos" ? v.weekdays ?? [] : [],
        code: v.aplicacion === "codigo" ? v.code : null,
        is_active: v.isActive ?? true,
        start_date: rango?.[0] ? rango[0].format("YYYY-MM-DD") : null,
        end_date: rango?.[1] ? rango[1].format("YYYY-MM-DD") : null,
      };
      if (editando) await apiTienda.put(`/discounts/${editando.id}`, cuerpo);
      else await apiTienda.post("/discounts", cuerpo);
      message.success(editando ? "Promoción actualizada" : "Promoción creada");
      setAbierto(false);
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (p: Promo, activa: boolean) => {
    try {
      await apiTienda.put(`/discounts/${p.id}/toggle`, { is_active: activa });
      await cargar();
    } catch {
      message.error("No se pudo cambiar el estado");
    }
  };

  const eliminar = (p: Promo) =>
    Modal.confirm({
      title: `¿Eliminar «${p.name}»?`,
      content: "Los pedidos que ya usaron esta promoción no cambian.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await apiTienda.delete(`/discounts/${p.id}`);
          message.success("Promoción eliminada");
          await cargar();
        } catch {
          message.error("No se pudo eliminar");
        }
      },
    });

  const columnas: ColumnsType<Promo> = useMemo(
    () => [
      {
        title: "Promoción",
        key: "name",
        render: (_, p) => (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
            <p className="text-[11px] text-muted">{alcance(p)}</p>
          </div>
        ),
      },
      {
        title: "Oferta",
        key: "label",
        render: (_, p) => (
          <span className="pill bg-brand-50 text-brand-600">
            {p.kind === "fixed" ? `${simbolo} ${Number(p.value).toFixed(2)} menos` : p.label}
          </span>
        ),
      },
      {
        title: "Cómo se aplica",
        key: "code",
        responsive: ["md"],
        render: (_, p) =>
          p.code ? (
            <span className="font-mono text-[12px] font-semibold text-ink">🎟 {p.code}</span>
          ) : (
            <span className="text-[12px] text-ink-soft">Automática</span>
          ),
      },
      {
        title: "Vigencia",
        key: "vigencia",
        responsive: ["lg"],
        render: (_, p) => (
          <span className="text-[12px] text-ink-soft">
            {p.startDate || p.endDate
              ? `${p.startDate ? dayjs(p.startDate).format("DD/MM/YY") : "…"} → ${p.endDate ? dayjs(p.endDate).format("DD/MM/YY") : "…"}`
              : "Sin vigencia"}
            {p.diasTexto && <span className="block text-[11px] text-muted">Solo {p.diasTexto}</span>}
          </span>
        ),
      },
      {
        title: "Estado",
        key: "estado",
        render: (_, p) => {
          const e = estado(p);
          return <span className={`pill ${e.clase}`}>{e.texto}</span>;
        },
      },
      {
        title: "Activa",
        key: "activa",
        render: (_, p) => <Switch size="small" checked={p.isActive} onChange={(v) => alternar(p, v)} />,
      },
      {
        title: "",
        key: "acciones",
        align: "right",
        render: (_, p) => (
          <div className="flex justify-end gap-1.5">
            <Button size="small" onClick={() => abrir(p)}>
              Editar
            </Button>
            <Button size="small" danger onClick={() => eliminar(p)}>
              Eliminar
            </Button>
          </div>
        ),
      },
    ],
    [simbolo]
  );

  return (
    <>
      <PageHeader
        titulo="Promociones"
        descripcion="Descuentos, 2x1 y cupones para toda la tienda, una categoría o un producto. Las automáticas se ven en tu tienda; los cupones los escribe el cliente en su carrito."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => abrir()}>
            Nueva promoción
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : promos.length === 0 ? (
          <Empty className="py-16" description="Aún no tienes promociones. Crea la primera: un 10% de descuento, un 2x1 o un cupón." />
        ) : (
          <Table rowKey="id" columns={columnas} dataSource={promos} pagination={{ pageSize: 15, hideOnSinglePage: true }} />
        )}
      </div>

      <Modal
        open={abierto}
        title={editando ? "Editar promoción" : "Nueva promoción"}
        onCancel={() => setAbierto(false)}
        onOk={() => form.submit()}
        confirmLoading={guardando}
        okText={editando ? "Guardar cambios" : "Crear promoción"}
        cancelText="Cancelar"
        width={600}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={guardar} className="pt-2">
          <Form.Item name="name" label="Nombre" rules={[{ required: true, min: 2, message: "Ponle un nombre" }]}>
            <Input placeholder="Promoción de verano" />
          </Form.Item>

          <Form.Item name="kind" label="Tipo de oferta">
            <Segmented
              block
              options={[
                { label: "Porcentaje (%)", value: "percent" },
                { label: `Monto fijo (${simbolo})`, value: "fixed" },
                { label: "Lleva N, paga M", value: "bundle" },
              ]}
            />
          </Form.Item>

          {kind === "percent" && (
            <Form.Item label="Valor" required>
              <div className="flex flex-wrap items-center gap-2">
                {RAPIDOS_PORCENTAJE.map((n) => (
                  <Button key={n} size="small" onClick={() => form.setFieldsValue({ value: n })}>
                    {n}%
                  </Button>
                ))}
                <Form.Item name="value" noStyle rules={[{ required: true, message: "Escribe el porcentaje" }]}>
                  <InputNumber min={1} max={100} addonAfter="%" style={{ width: 130 }} />
                </Form.Item>
              </div>
            </Form.Item>
          )}

          {kind === "fixed" && (
            <Form.Item
              name="value"
              label={`Cuánto se descuenta por unidad`}
              rules={[{ required: true, message: "Escribe el monto" }]}
              extra="Se descuenta de cada unidad, sin dejarla bajo cero."
            >
              <InputNumber min={0.1} precision={2} prefix={simbolo} style={{ width: 160 }} />
            </Form.Item>
          )}

          {kind === "bundle" && (
            <Form.Item label="Cuántas lleva y cuántas paga" required extra="Ejemplo: lleva 2, paga 1 es un 2x1. El cliente debe comprar al menos esa cantidad.">
              <div className="flex flex-wrap items-center gap-2">
                {RAPIDOS_BUNDLE.map(([n, m]) => (
                  <Button key={`${n}${m}`} size="small" onClick={() => form.setFieldsValue({ buyQty: n, payQty: m })}>
                    {n}x{m}
                  </Button>
                ))}
                <Form.Item name="buyQty" noStyle rules={[{ required: true }]}>
                  <InputNumber min={2} precision={0} addonBefore="Lleva" style={{ width: 130 }} />
                </Form.Item>
                <Form.Item name="payQty" noStyle rules={[{ required: true }]}>
                  <InputNumber min={1} precision={0} addonBefore="Paga" style={{ width: 130 }} />
                </Form.Item>
              </div>
            </Form.Item>
          )}

          <Form.Item name="scope" label="¿A qué aplica?">
            <Segmented
              block
              options={[
                { label: "Toda la tienda", value: "all" },
                { label: "Productos, variaciones o categorías", value: "selection" },
              ]}
            />
          </Form.Item>
          {scope === "selection" && (
            <div className="mb-4 space-y-3 rounded-lg border border-line-soft p-3">
              <p className="text-[12px] text-muted">
                Elige lo que quieras: una categoría entera, varios productos, o solo ciertas tallas y colores.
              </p>
              <Form.Item name="categoryIds" label="Categorías" className="!mb-0">
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Ninguna"
                  options={categorias.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
              <Form.Item name="productIds" label="Productos" className="!mb-0">
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Ninguno"
                  options={productos.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Form.Item>
              {variaciones.length > 0 && (
                <Form.Item name="variationIds" label="Variaciones (talla, color…)" className="!mb-0">
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Ninguna"
                    options={variaciones.map((v) => ({ value: v.id, label: v.label }))}
                  />
                </Form.Item>
              )}
            </div>
          )}

          <Form.Item name="aplicacion" label="¿Cómo se aplica?">
            <Segmented
              block
              options={[
                { label: "Automática (la ven todos)", value: "auto" },
                { label: "Con código (cupón)", value: "codigo" },
              ]}
            />
          </Form.Item>
          {aplicacion === "codigo" && (
            <Form.Item
              name="code"
              rules={[{ required: true, message: "Escribe o genera el código" }]}
              extra="El cliente lo escribe en su carrito. Solo letras y números."
              getValueFromEvent={(e) => String(e.target.value).toUpperCase().replace(/[^A-Z0-9_-]/g, "")}
            >
              <Input
                placeholder="VERANO20"
                maxLength={40}
                addonAfter={<a onClick={() => form.setFieldsValue({ code: generarCodigo() })}>Generar</a>}
              />
            </Form.Item>
          )}

          <Form.Item name="vigenciaModo" label="Vigencia">
            <Segmented
              block
              options={[
                { label: "Sin vigencia", value: "siempre" },
                { label: "En un rango de fechas", value: "rango" },
              ]}
            />
          </Form.Item>
          {vigenciaModo === "rango" && (
            <Form.Item name="rango" rules={[{ required: true, message: "Elige las fechas" }]}>
              <DatePicker.RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
          )}

          <Form.Item name="diasModo" label="¿Qué días?">
            <Segmented
              block
              options={[
                { label: "Todos los días", value: "todos" },
                { label: "Solo ciertos días (ej. viernes y sábado)", value: "algunos" },
              ]}
            />
          </Form.Item>
          {diasModo === "algunos" && (
            <Form.Item
              name="weekdays"
              rules={[{ required: true, type: "array", min: 1, message: "Elige al menos un día" }]}
              extra="Combínalo con las fechas: por ejemplo, todos los viernes y sábados de este mes."
            >
              <Checkbox.Group options={DIAS} />
            </Form.Item>
          )}

          <Form.Item name="isActive" label="Activa" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
