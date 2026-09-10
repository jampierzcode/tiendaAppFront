import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Table,
  Tabs,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { TbCheck, TbPlus, TbTrash, TbTruckLoading, TbX } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

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
  unitCost: number;
  lineTotal: number;
}

interface Compra {
  id: number;
  code: string;
  documentNumber: string | null;
  status: "borrador" | "recibida" | "cancelada";
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
  stock: number;
}

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

const estilosEstado: Record<string, string> = {
  borrador: "bg-warn-bg text-warn",
  recibida: "bg-ok-bg text-ok",
  cancelada: "bg-line-soft text-muted",
};

export default function PurchasesPage() {
  const [pestana, setPestana] = useState("compras");
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [variaciones, setVariaciones] = useState<VariacionCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [modalCompra, setModalCompra] = useState(false);
  const [modalProveedor, setModalProveedor] = useState(false);
  const [formCompra] = Form.useForm();
  const [formProveedor] = Form.useForm();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, p, prod] = await Promise.all([
        apiTienda.get("/purchases"),
        apiTienda.get("/suppliers"),
        apiTienda.get("/products"),
      ]);
      setCompras(c.data.data ?? []);
      setProveedores(p.data.data ?? []);

      // Cada variación como opción de compra: se compra la talla, no el producto.
      const vars: VariacionCatalogo[] = [];
      for (const producto of prod.data.data ?? []) {
        for (const v of producto.variations ?? []) {
          const etiqueta = (v.attributes ?? [])
            .map((a: any) => a.value?.value)
            .filter(Boolean)
            .join(" · ");
          vars.push({
            id: v.id,
            producto: producto.name,
            label: etiqueta || "Único",
            stock: v.stock,
          });
        }
      }
      setVariaciones(vars);
    } catch {
      message.error("No se pudieron cargar las compras");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crearCompra = async (v: any) => {
    setGuardando(true);
    try {
      await apiTienda.post("/purchases", {
        supplierId: v.supplierId,
        documentNumber: v.documentNumber || null,
        note: v.note || null,
        items: (v.items ?? []).map((i: any) => ({
          variationId: i.variationId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      });
      message.success("Orden de compra creada");
      setModalCompra(false);
      formCompra.resetFields();
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const recibir = (compra: Compra) =>
    Modal.confirm({
      title: `¿Recibir la mercadería de ${compra.code}?`,
      content:
        "Las cantidades entrarán al inventario y el costo de esos productos se actualizará al de esta compra. No se puede deshacer.",
      okText: "Sí, recibir",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await apiTienda.post(`/purchases/${compra.id}/receive`);
          message.success("Mercadería ingresada al inventario");
          await cargar();
        } catch (e: any) {
          message.error(e?.response?.data?.message ?? "No se pudo recibir");
        }
      },
    });

  const cancelar = (compra: Compra) =>
    Modal.confirm({
      title: `¿Cancelar ${compra.code}?`,
      okText: "Cancelar orden",
      okButtonProps: { danger: true },
      cancelText: "Volver",
      onOk: async () => {
        try {
          await apiTienda.post(`/purchases/${compra.id}/cancel`);
          message.success("Orden cancelada");
          await cargar();
        } catch (e: any) {
          message.error(e?.response?.data?.message ?? "No se pudo cancelar");
        }
      },
    });

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
      title: "Artículos",
      dataIndex: "items",
      align: "center",
      responsive: ["md"],
      render: (items: ItemCompra[]) => (
        <span className="text-ink-soft">{items.reduce((t, i) => t + i.quantity, 0)}</span>
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
          <span className={`pill ${estilosEstado[s]}`}>{s}</span>
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
      render: (_, row) =>
        row.status === "borrador" ? (
          <div className="flex justify-end gap-1.5">
            <Button size="small" type="primary" icon={<TbCheck />} onClick={() => recibir(row)}>
              Recibir
            </Button>
            <Button size="small" danger icon={<TbX />} onClick={() => cancelar(row)} />
          </div>
        ) : null,
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
        descripcion="Lo que le pides a tus proveedores. La mercadería entra al inventario solo cuando marcas la orden como recibida."
        acciones={
          pestana === "compras" ? (
            <Button
              type="primary"
              icon={<TbPlus />}
              disabled={proveedores.length === 0}
              onClick={() => setModalCompra(true)}
            >
              Nueva orden
            </Button>
          ) : (
            <Button type="primary" icon={<TbPlus />} onClick={() => setModalProveedor(true)}>
              Nuevo proveedor
            </Button>
          )
        }
      />

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
        title="Nueva orden de compra"
        okText="Crear orden"
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
          </div>

          <p className="eyebrow mb-2">Productos</p>
          <Form.List name="items">
            {(campos, { add, remove }) => (
              <>
                {campos.map((campo) => (
                  <div key={campo.key} className="mb-2 flex items-end gap-2">
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
                      label="Costo unit."
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
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<TbPlus />}
                  onClick={() => add()}
                  className="mt-1"
                >
                  Agregar producto
                </Button>
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
