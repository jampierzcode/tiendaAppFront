import { useCallback, useEffect, useState } from "react";
import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Spin,
  Table,
  Tabs,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { TbPlus, TbTrash, TbTruckLoading } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import QuickProductModal from "../../components/admin/QuickProductModal";
import PurchaseDetailDrawer, { estadoCompra } from "../../components/admin/PurchaseDetailDrawer";
import PriceReviews from "../../components/admin/PriceReviews";

interface Proveedor {
  id: number;
  name: string;
  ruc: string | null;
  contactName: string | null;
  phone: string | null;
  status: string;
}

interface ItemCompra {
  id: number;
  quantity: number;
  receivedQuantity?: number;
  unitCost: number;
  lineTotal: number;
}

interface Compra {
  id: number;
  code: string;
  documentNumber: string | null;
  status: "cotizacion" | "borrador" | "parcial" | "recibida" | "cancelada";
  total: number;
  receivedAt: string | null;
  createdAt: string;
  supplier?: { name: string };
  items: ItemCompra[];
}

interface VariacionCatalogo {
  id: number;
  label: string;
  producto: string;
  productoId: number;
  /** Precio de venta (referencia; no se edita aquí). */
  precio: number;
  /** Último costo de compra de esta variación (o del producto). */
  costo: number | null;
  stock: number;
}

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });


export default function PurchasesPage() {
  const [pestana, setPestana] = useState("compras");
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [variaciones, setVariaciones] = useState<VariacionCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [modalCompra, setModalCompra] = useState(false);
  const [modalProveedor, setModalProveedor] = useState(false);
  const [rapido, setRapido] = useState<{ producto: { id: number; name: string; price: number } | null } | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [tipoOrden, setTipoOrden] = useState<"orden" | "cotizacion">("orden");
  const [historial, setHistorial] = useState<Record<number, any>>({});
  const [formCompra] = Form.useForm();
  const [formProveedor] = Form.useForm();

  // Cada variación como opción de compra: se compra la talla, no el producto.
  const cargarCatalogo = useCallback(async () => {
    const prod = await apiTienda.get("/products");
    const vars: VariacionCatalogo[] = [];
    for (const producto of prod.data.data ?? []) {
      const todas = producto.variations ?? [];
      // Con tallas, la variación oculta del producto simple ya no se compra.
      const conTallas = todas.some((v: any) => !v.isDefault && (v.attributes ?? []).length > 0);
      for (const v of conTallas ? todas.filter((x: any) => !x.isDefault) : todas) {
        const etiqueta = (v.attributes ?? [])
          .map((a: any) => a.value?.value)
          .filter(Boolean)
          .join(" · ");
        const costo = v.cost ?? producto.cost;
        vars.push({
          id: v.id,
          producto: producto.name,
          productoId: producto.id,
          label: etiqueta || "Único",
          precio: Number(producto.price ?? v.price ?? 0),
          costo: costo == null ? null : Number(costo),
          stock: v.stock,
        });
      }
    }
    setVariaciones(vars);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, p] = await Promise.all([
        apiTienda.get("/purchases"),
        apiTienda.get("/suppliers"),
        cargarCatalogo(),
      ]);
      setCompras(c.data.data ?? []);
      setProveedores(p.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar las compras");
    } finally {
      setCargando(false);
    }
  }, [cargarCatalogo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Pone el último costo de la variación elegida, sin pisar lo que ya escribió. */
  const cargarHistorial = async (variationId: number) => {
    if (historial[variationId]) return;
    try {
      const r = await apiTienda.get("/purchases/cost-history", { params: { variationId } });
      setHistorial((h) => ({ ...h, [variationId]: r.data.data }));
    } catch {
      /* el historial es ayuda: si falla no frena la compra */
    }
  };

  const alElegir = (campo: number, variationId: number) => {
    cargarHistorial(variationId);
    const v = variaciones.find((x) => x.id === variationId);
    const items = formCompra.getFieldValue("items") ?? [];
    if (v?.costo != null && items[campo] && items[campo].unitCost == null) {
      items[campo] = { ...items[campo], unitCost: v.costo };
      formCompra.setFieldsValue({ items });
    }
  };

  /** Líneas que vienen del alta rápida: reemplazan las líneas vacías. */
  const agregarLineas = async (lineas: { variationId: number; quantity: number; unitCost: number }[]) => {
    await cargarCatalogo();
    const actuales = (formCompra.getFieldValue("items") ?? []).filter((i: any) => i?.variationId);
    formCompra.setFieldsValue({ items: [...actuales, ...lineas] });
  };

  const crearCompra = async (v: any) => {
    setGuardando(true);
    try {
      await apiTienda.post("/purchases", {
        supplierId: v.supplierId,
        documentNumber: v.documentNumber || null,
        note: v.note || null,
        tipo: tipoOrden,
        expectedAt: v.expectedAt ? v.expectedAt.format("YYYY-MM-DD") : null,
        items: (v.items ?? []).map((i: any) => ({
          variationId: i.variationId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      });
      message.success(tipoOrden === "cotizacion" ? "Cotización guardada" : "Orden de compra creada");
      setModalCompra(false);
      formCompra.resetFields();
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const crearProveedor = async (v: any) => {
    setGuardando(true);
    try {
      await apiTienda.post("/suppliers", v);
      message.success("Proveedor creado");
      setModalProveedor(false);
      formProveedor.resetFields();
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const columnasCompras: ColumnsType<Compra> = [
    {
      title: "Orden",
      dataIndex: "code",
      render: (code: string, row) => (
        <div>
          <span className="font-mono text-[13px] font-semibold text-ink">{code}</span>
          <p className="text-[11px] text-muted">{fecha(row.createdAt)}</p>
        </div>
      ),
    },
    {
      title: "Proveedor",
      key: "proveedor",
      render: (_, row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">
            {row.supplier?.name ?? "—"}
          </p>
          {row.documentNumber && (
            <p className="font-mono text-[11px] text-muted">{row.documentNumber}</p>
          )}
        </div>
      ),
    },
    {
      title: "Recibido / pedido",
      dataIndex: "items",
      align: "center",
      responsive: ["md"],
      render: (items: ItemCompra[]) => (
        <span className="text-ink-soft">
          {items.reduce((t, i) => t + (i.receivedQuantity ?? 0), 0)}/{items.reduce((t, i) => t + i.quantity, 0)}
        </span>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      align: "right",
      render: (v: number) => <span className="font-semibold text-ink">{soles(v)}</span>,
    },
    {
      title: "Estado",
      dataIndex: "status",
      render: (s: string, row) => (
        <div>
          <span className={`pill ${estadoCompra[s]?.clase}`}>{estadoCompra[s]?.texto ?? s}</span>
          {row.receivedAt && (
            <p className="mt-0.5 text-[11px] text-muted">{fecha(row.receivedAt)}</p>
          )}
        </div>
      ),
    },
    {
      title: "",
      key: "acciones",
      align: "right",
      render: (_, row) => (
        <Button size="small" type={["borrador", "parcial"].includes(row.status) ? "primary" : "default"} onClick={() => setDetalleId(row.id)}>
          {["borrador", "parcial"].includes(row.status) ? "Recibir" : "Ver"}
        </Button>
      ),
    },
  ];

  const columnasProveedores: ColumnsType<Proveedor> = [
    {
      title: "Proveedor",
      dataIndex: "name",
      render: (n: string, row) => (
        <div>
          <p className="text-[13px] font-medium text-ink">{n}</p>
          {row.ruc && <p className="font-mono text-[11px] text-muted">RUC {row.ruc}</p>}
        </div>
      ),
    },
    { title: "Contacto", dataIndex: "contactName", responsive: ["md"] },
    { title: "Teléfono", dataIndex: "phone", responsive: ["md"] },
    {
      title: "Estado",
      dataIndex: "status",
      align: "right",
      render: (s: string) => (
        <span className={`pill ${s === "activo" ? "bg-ok-bg text-ok" : "bg-line-soft text-muted"}`}>
          {s}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Compras"
        descripcion="Cotiza, pide y recibe por partes. El stock sube solo con lo que llega físicamente; una cotización no toca inventario ni costos."
        acciones={
          pestana === "compras" ? (
            <Button
              type="primary"
              icon={<TbPlus />}
              disabled={proveedores.length === 0}
              onClick={() => setModalCompra(true)}
            >
              Nueva cotización u orden
            </Button>
          ) : (
            <Button type="primary" icon={<TbPlus />} onClick={() => setModalProveedor(true)}>
              Nuevo proveedor
            </Button>
          )
        }
      />

      <PriceReviews onApplied={cargar} />

      <div className="card overflow-hidden">
        <div className="border-b border-line-soft px-4 pt-2">
          <Tabs
            activeKey={pestana}
            onChange={setPestana}
            items={[
              { key: "compras", label: `Órdenes (${compras.length})` },
              { key: "proveedores", label: `Proveedores (${proveedores.length})` },
            ]}
          />
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : pestana === "compras" ? (
          compras.length === 0 ? (
            <Empty
              className="py-16"
              description={
                proveedores.length === 0
                  ? "Primero registra un proveedor, luego podrás crear órdenes de compra."
                  : "Sin órdenes de compra todavía"
              }
            />
          ) : (
            <Table
              rowKey="id"
              columns={columnasCompras}
              dataSource={compras}
              pagination={{ pageSize: 15, hideOnSinglePage: true }}
            />
          )
        ) : proveedores.length === 0 ? (
          <Empty className="py-16" description="Sin proveedores todavía" />
        ) : (
          <Table
            rowKey="id"
            columns={columnasProveedores}
            dataSource={proveedores}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
          />
        )}
      </div>

      {/* Nueva orden de compra */}
      <Modal
        open={modalCompra}
        onCancel={() => setModalCompra(false)}
        onOk={() => formCompra.submit()}
        confirmLoading={guardando}
        title={tipoOrden === "cotizacion" ? "Nueva cotización" : "Nueva orden de compra"}
        okText={tipoOrden === "cotizacion" ? "Guardar cotización" : "Crear orden"}
        cancelText="Cancelar"
        width={720}
      >
        <Form
          form={formCompra}
          layout="vertical"
          onFinish={crearCompra}
          className="pt-2"
          initialValues={{ items: [{}] }}
        >
          <Segmented
            className="mb-4"
            value={tipoOrden}
            onChange={(v) => setTipoOrden(v as "orden" | "cotizacion")}
            options={[
              { label: "Pedido", value: "orden" },
              { label: "Cotización (sin stock ni costos)", value: "cotizacion" },
            ]}
          />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item
              name="supplierId"
              label="Proveedor"
              rules={[{ required: true, message: "Elige el proveedor" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Buscar proveedor…"
                options={proveedores
                  .filter((p) => p.status === "activo")
                  .map((p) => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
            <Form.Item name="documentNumber" label="Factura o guía del proveedor">
              <Input placeholder="F001-3344" />
            </Form.Item>
            <Form.Item name="expectedAt" label="Llegada estimada">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <p className="eyebrow mb-2">Productos</p>
          <Form.List name="items">
            {(campos, { add, remove }) => (
              <>
                {campos.map((campo) => (
                  <div key={campo.key} className="mb-3">
                  <div className="flex items-end gap-2">
                    <Form.Item
                      name={[campo.name, "variationId"]}
                      label="Producto y talla"
                      className="!mb-0 flex-1"
                      rules={[{ required: true, message: "Elige el producto" }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Buscar…"
                        onChange={(id: number) => alElegir(campo.name, id)}
                        options={variaciones.map((v) => ({
                          value: v.id,
                          label: `${v.producto} — ${v.label} (stock ${v.stock})`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[campo.name, "quantity"]}
                      label="Cantidad"
                      className="!mb-0"
                      rules={[{ required: true, message: "?" }]}
                    >
                      <InputNumber min={1} style={{ width: 90 }} />
                    </Form.Item>
                    <Form.Item
                      name={[campo.name, "unitCost"]}
                      label="Costo unit. (pagas)"
                      className="!mb-0"
                      rules={[{ required: true, message: "?" }]}
                    >
                      <InputNumber prefix="S/" min={0} precision={2} style={{ width: 120 }} />
                    </Form.Item>
                    <Button
                      icon={<TbTrash />}
                      danger
                      onClick={() => remove(campo.name)}
                      disabled={campos.length === 1}
                      aria-label="Quitar línea"
                    />
                  </div>
                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const linea = formCompra.getFieldValue(["items", campo.name]);
                      const v = variaciones.find((x) => x.id === linea?.variationId);
                      if (!v) return null;
                      const costo = Number(linea?.unitCost);
                      const margen =
                        v.precio > 0 && Number.isFinite(costo) && linea?.unitCost != null
                          ? Math.round(((v.precio - costo) / v.precio) * 100)
                          : null;
                      return (
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                          <span>Se vende a {soles(v.precio)} (no cambia)</span>
                          {v.costo != null && <span>Último costo {soles(v.costo)}</span>}
                          {(() => {
                            const h = historial[v.id]?.proveedores ?? [];
                            const compras = h.filter((p: any) => p.ultimoCosto != null);
                            if (!compras.length) return null;
                            const mejor = compras.reduce((a: any, b: any) => (b.ultimoCosto < a.ultimoCosto ? b : a));
                            const elegido = compras.find((p: any) => p.supplierId === formCompra.getFieldValue("supplierId"));
                            return (
                              <span>
                                Mejor costo: {mejor.supplier} {soles(mejor.ultimoCosto)}
                                {elegido && elegido.supplierId !== mejor.supplierId && ` · con este proveedor ${soles(elegido.ultimoCosto)}`}
                              </span>
                            );
                          })()}
                          {margen != null && (
                            <span className={margen < 0 ? "text-danger" : ""}>Margen {margen}%</span>
                          )}
                          <button
                            type="button"
                            className="font-medium text-brand-600 hover:underline"
                            onClick={() =>
                              setRapido({
                                producto: { id: v.productoId, name: v.producto, price: v.precio },
                              })
                            }
                          >
                            + Talla o color nuevo
                          </button>
                        </p>
                      );
                    }}
                  </Form.Item>
                  </div>
                ))}
                <div className="mt-1 flex gap-2">
                  <Button type="dashed" block icon={<TbPlus />} onClick={() => add()}>
                    Agregar producto
                  </Button>
                  <Button type="dashed" block icon={<TbPlus />} onClick={() => setRapido({ producto: null })}>
                    Producto nuevo
                  </Button>
                </div>
              </>
            )}
          </Form.List>

          <Form.Item name="note" label="Nota" className="mt-4">
            <Input.TextArea rows={2} placeholder="Condiciones, fecha de entrega…" />
          </Form.Item>

          <p className="flex items-center gap-2 rounded-lg bg-info-bg px-3 py-2 text-[12px] text-info">
            <TbTruckLoading className="shrink-0 text-base" />
            La orden nace en borrador. El stock entra cuando la marques como recibida.
          </p>
        </Form>
      </Modal>

      <PurchaseDetailDrawer
        ordenId={detalleId}
        proveedores={proveedores}
        onClose={() => setDetalleId(null)}
        onChanged={cargar}
      />

      <QuickProductModal
        open={rapido !== null}
        producto={rapido?.producto ?? null}
        onClose={() => setRapido(null)}
        onCreated={agregarLineas}
      />

      {/* Nuevo proveedor */}
      <Modal
        open={modalProveedor}
        onCancel={() => setModalProveedor(false)}
        onOk={() => formProveedor.submit()}
        confirmLoading={guardando}
        title="Nuevo proveedor"
        okText="Crear"
        cancelText="Cancelar"
      >
        <Form form={formProveedor} layout="vertical" onFinish={crearProveedor} className="pt-2">
          <Form.Item
            name="name"
            label="Nombre o razón social"
            rules={[{ required: true, message: "Escribe el nombre" }]}
          >
            <Input placeholder="Textiles Gamarra SAC" />
          </Form.Item>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="ruc" label="RUC">
              <Input placeholder="20501234567" />
            </Form.Item>
            <Form.Item name="phone" label="Teléfono">
              <Input placeholder="999 888 777" />
            </Form.Item>
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="contact_name" label="Persona de contacto">
              <Input placeholder="Sr. Huamán" />
            </Form.Item>
            <Form.Item name="email" label="Correo">
              <Input placeholder="ventas@proveedor.com" />
            </Form.Item>
          </div>
          <Form.Item name="address" label="Dirección">
            <Input placeholder="Jr. Gamarra 500, La Victoria" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
