import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Modal, Segmented, Select, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { TbAdjustments, TbAlertTriangle, TbArrowDown, TbArrowUp, TbPlus } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import MovementModal from "../../components/admin/MovementModal";

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
  pendiente?: number;
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
  entrada_manual: { texto: "Aumento manual", clase: "bg-ok-bg text-ok" },
  salida_manual: { texto: "Disminución manual", clase: "bg-danger-bg text-danger" },
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
  const [elegirOpen, setElegirOpen] = useState(false);
  const [catalogo, setCatalogo] = useState<{ value: number; label: string; stock: number }[]>([]);
  const [item, setItem] = useState<{ id: number; nombre: string; stock: number } | null>(null);
  const [movOpen, setMovOpen] = useState(false);

  /** Productos simples y variaciones, listos para elegir a cuál moverle el stock. */
  const abrirElegir = async () => {
    setElegirOpen(true);
    if (catalogo.length) return;
    try {
      const r = await apiTienda.get("/products");
      const opciones: { value: number; label: string; stock: number }[] = [];
      for (const p of r.data.data ?? []) {
        const todas = p.variations ?? [];
        const conTallas = todas.some((v: any) => !v.isDefault && (v.attributes ?? []).length > 0);
        for (const v of conTallas ? todas.filter((x: any) => !x.isDefault) : todas) {
          const texto = variacionTexto(v.attributes);
          opciones.push({
            value: v.id,
            label: `${p.name}${texto ? ` — ${texto}` : ""}`,
            stock: Number(v.stock),
          });
        }
      }
      setCatalogo(opciones);
    } catch {
      message.error("No se pudieron cargar los productos");
    }
  };

  const mover = (id: number, nombre: string, stock: number) => {
    setItem({ id, nombre, stock });
    setElegirOpen(false);
    setMovOpen(true);
  };

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

  const ajustar = (v: Variacion) =>
    mover(
      v.id,
      `${v.product.name}${variacionTexto(v.attributes) ? ` — ${variacionTexto(v.attributes)}` : ""}`,
      v.stock
    );

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
      render: (s: number, v) => (
        <div className="flex items-center justify-end gap-2">
          <span className={`pill ${s === 0 ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"}`}>
            {s === 0 ? "Agotado" : s}
          </span>
          {(v.pendiente ?? 0) > 0 && (
            <span className="text-[11px] text-info">+{v.pendiente} por llegar</span>
          )}
        </div>
      ),
    },
    {
      title: "",
      key: "acciones",
      align: "right",
      render: (_, v) => (
        <Button size="small" icon={<TbAdjustments />} onClick={() => ajustar(v)}>
          Movimiento
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Inventario"
        descripcion="Cada entrada y salida queda escrita aquí, con su motivo y su autor. Las compras suben el stock desde Compras; aquí registras aumentos, disminuciones y ajustes manuales."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={abrirElegir}>
            Registrar movimiento
          </Button>
        }
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
              Estas tallas quedarían en o por debajo del mínimo aun contando lo que viene en camino (compras pendientes).
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

      <Modal
        open={elegirOpen}
        title="¿A qué producto?"
        footer={null}
        onCancel={() => setElegirOpen(false)}
        destroyOnClose
      >
        <Select
          showSearch
          autoFocus
          optionFilterProp="label"
          placeholder="Busca un producto o variación…"
          style={{ width: "100%" }}
          options={catalogo.map((c) => ({ value: c.value, label: `${c.label} (stock ${c.stock})` }))}
          onChange={(id: number) => {
            const c = catalogo.find((x) => x.value === id);
            if (c) mover(c.value, c.label, c.stock);
          }}
        />
      </Modal>

      <MovementModal
        open={movOpen}
        item={item}
        onClose={() => setMovOpen(false)}
        onDone={() => {
          setCatalogo([]); // el stock cambió: se vuelve a pedir al abrir
          cargar();
        }}
      />
    </>
  );
}
