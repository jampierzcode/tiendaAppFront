import { useCallback, useEffect, useState } from "react";
import { Button, Empty, InputNumber, Modal, Segmented, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { TbAdjustments, TbAlertTriangle, TbArrowDown, TbArrowUp } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Movimiento {
  id: number;
  type: string;
  quantity: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  user?: { name: string } | null;
  variation?: {
    id: number;
    product?: { name: string; sku: string | null };
    attributes?: { value?: { value: string } }[];
  };
}

interface Variacion {
  id: number;
  stock: number;
  product: { name: string; lowStockThreshold: number };
  attributes: { value?: { value: string } }[];
}

const etiquetaTipo: Record<string, { texto: string; clase: string }> = {
  compra: { texto: "Compra", clase: "bg-ok-bg text-ok" },
  venta: { texto: "Venta", clase: "bg-info-bg text-info" },
  devolucion: { texto: "Devolución", clase: "bg-brand-50 text-brand-600" },
  ajuste: { texto: "Ajuste", clase: "bg-warn-bg text-warn" },
  inicial: { texto: "Inicial", clase: "bg-line-soft text-muted" },
  merma: { texto: "Merma", clase: "bg-danger-bg text-danger" },
};

const variacionTexto = (attrs?: { value?: { value: string } }[]) =>
  (attrs ?? []).map((a) => a.value?.value).filter(Boolean).join(" · ");

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function InventoryPage() {
  const [vista, setVista] = useState<"movimientos" | "alertas">("movimientos");
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [alertas, setAlertas] = useState<Variacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [m, a] = await Promise.all([
        apiTienda.get("/inventory/movements", { params: { perPage: 50 } }),
        apiTienda.get("/inventory/low-stock"),
      ]);
      setMovimientos(m.data.data ?? []);
      setAlertas(a.data.data ?? []);
    } catch {
      message.error("No se pudo cargar el inventario");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ajustar = (v: Variacion) => {
    let nuevo = v.stock;
    Modal.confirm({
      title: `Ajustar stock — ${v.product.name}`,
      icon: null,
      content: (
        <div className="pt-2">
          <p className="mb-2 text-[13px] text-muted">
            {variacionTexto(v.attributes) || "Sin variante"} · actual{" "}
            <strong className="text-ink">{v.stock}</strong>
          </p>
          <InputNumber
            autoFocus
            defaultValue={v.stock}
            min={0}
            className="w-full"
            onChange={(x) => (nuevo = Number(x))}
          />
          <p className="mt-2 text-[12px] text-muted">
            La diferencia queda registrada en el kardex como ajuste, con tu nombre.
          </p>
        </div>
      ),
      okText: "Ajustar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await apiTienda.post("/inventory/adjust", {
            variationId: v.id,
            newStock: nuevo,
            note: "Ajuste desde el panel",
          });
          message.success("Inventario ajustado");
          await cargar();
        } catch (e: any) {
          message.error(e?.response?.data?.message ?? "No se pudo ajustar");
        }
      },
    });
  };

  const columnasMovimientos: ColumnsType<Movimiento> = [
    {
      title: "Fecha",
      dataIndex: "createdAt",
      render: (v: string) => <span className="text-[12px] text-muted">{fecha(v)}</span>,
    },
    {
      title: "Producto",
      key: "producto",
      render: (_, m) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">
            {m.variation?.product?.name ?? "—"}
          </p>
          <p className="text-[11px] text-muted">{variacionTexto(m.variation?.attributes)}</p>
        </div>
      ),
    },
    {
      title: "Tipo",
      dataIndex: "type",
      render: (t: string) => {
        const e = etiquetaTipo[t] ?? etiquetaTipo.ajuste;
        return <span className={`pill ${e.clase}`}>{e.texto}</span>;
      },
    },
    {
      title: "Cantidad",
      dataIndex: "quantity",
      align: "right",
      render: (q: number) => (
        <span
          className={`inline-flex items-center gap-1 font-semibold ${
            q > 0 ? "text-ok" : "text-danger"
          }`}
        >
          {q > 0 ? <TbArrowUp /> : <TbArrowDown />}
          {Math.abs(q)}
        </span>
      ),
    },
    {
      title: "Saldo",
      dataIndex: "balanceAfter",
      align: "right",
      render: (b: number) => <span className="font-semibold text-ink">{b}</span>,
    },
    {
      title: "Motivo",
      dataIndex: "note",
      responsive: ["lg"],
      render: (n: string | null, m) => (
        <div className="max-w-xs">
          <p className="truncate text-[12px] text-ink-soft">{n ?? "—"}</p>
          {m.user?.name && <p className="text-[11px] text-muted">{m.user.name}</p>}
        </div>
      ),
    },
  ];

  const columnasAlertas: ColumnsType<Variacion> = [
    {
      title: "Producto",
      key: "producto",
      render: (_, v) => (
        <div>
          <p className="text-[13px] font-medium text-ink">{v.product?.name}</p>
          <p className="text-[11px] text-muted">{variacionTexto(v.attributes)}</p>
        </div>
      ),
    },
    {
      title: "Quedan",
      dataIndex: "stock",
      align: "right",
      render: (s: number) => (
        <span className={`pill ${s === 0 ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"}`}>
          {s === 0 ? "Agotado" : s}
        </span>
      ),
    },
    {
      title: "",
      key: "acciones",
      align: "right",
      render: (_, v) => (
        <Button size="small" icon={<TbAdjustments />} onClick={() => ajustar(v)}>
          Ajustar
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Inventario"
        descripcion="Cada entrada y salida queda escrita aquí, con su motivo y su autor. Para corregir un error se registra un ajuste, no se borra el historial."
      />

      <div className="card overflow-hidden">
        <div className="border-b border-line-soft p-4">
          <Segmented
            value={vista}
            onChange={(v) => setVista(v as typeof vista)}
            options={[
              { label: "Movimientos", value: "movimientos" },
              {
                label: `Stock bajo${alertas.length ? ` (${alertas.length})` : ""}`,
                value: "alertas",
              },
            ]}
          />
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : vista === "movimientos" ? (
          movimientos.length === 0 ? (
            <Empty className="py-16" description="Todavía no hay movimientos de inventario" />
          ) : (
            <Table
              rowKey="id"
              columns={columnasMovimientos}
              dataSource={movimientos}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
            />
          )
        ) : alertas.length === 0 ? (
          <div className="py-16">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Nada por debajo del mínimo. Todo en orden."
            />
          </div>
        ) : (
          <>
            <p className="flex items-center gap-2 border-b border-line-soft bg-warn-bg px-4 py-2.5 text-[13px] text-warn">
              <TbAlertTriangle className="text-base" />
              Estas tallas están en o por debajo del mínimo que definiste en cada producto.
            </p>
            <Table
              rowKey="id"
              columns={columnasAlertas}
              dataSource={alertas}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
            />
          </>
        )}
      </div>
    </>
  );
}
