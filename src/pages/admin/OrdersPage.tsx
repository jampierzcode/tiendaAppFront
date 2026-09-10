import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Input, Segmented, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { TbCash, TbClock, TbReceipt, TbTruckDelivery } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import BadgeEstado, { type EstadoPedido } from "../../components/ui/EstadoPedido";
import OrderDetailDrawer from "../../components/admin/OrderDetailDrawer";

interface ItemPedido {
  id: number;
  productName: string;
  variationLabel: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sku: string | null;
}

interface Pedido {
  id: number;
  code: string;
  status: EstadoPedido;
  channel: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: string;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  note: string | null;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  paidTotal: number;
  createdAt: string;
  whatsappSentAt: string | null;
  items: ItemPedido[];
}

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function OrdersPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<{
    porEstado: Record<string, number>;
    totalPedidos: number;
    ventasAcumuladas: number;
  } | null>(null);

  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [p, r] = await Promise.all([
        apiTienda.get("/orders", {
          params: {
            status: filtro === "todos" ? undefined : filtro,
            search: busqueda || undefined,
            perPage: 50,
          },
        }),
        apiTienda.get("/orders/summary"),
      ]);
      setPedidos(p.data.data ?? []);
      setResumen(r.data.data);
    } catch {
      message.error("No se pudieron cargar los pedidos");
    } finally {
      setCargando(false);
    }
  }, [filtro, busqueda]);

  useEffect(() => {
    const t = setTimeout(cargar, busqueda ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, busqueda]);

  const columnas: ColumnsType<Pedido> = [
    {
      title: "Pedido",
      dataIndex: "code",
      render: (code: string, row) => (
        <div>
          <span className="font-mono text-[13px] font-semibold text-ink">{code}</span>
          <p className="text-[11px] text-muted">{fecha(row.createdAt)}</p>
        </div>
      ),
    },
    {
      title: "Cliente",
      dataIndex: "customerName",
      render: (nombre: string, row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{nombre}</p>
          <p className="font-mono text-[11px] text-muted">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      title: "Artículos",
      dataIndex: "items",
      align: "center",
      responsive: ["md"],
      render: (items: ItemPedido[]) => (
        <span className="text-ink-soft">
          {items.reduce((t, i) => t + i.quantity, 0)}
        </span>
      ),
    },
    {
      title: "Entrega",
      dataIndex: "deliveryMethod",
      responsive: ["lg"],
      render: (m: string, row) => (
        <span className="text-[12px] text-ink-soft">
          {m === "recojo" ? "Recojo en tienda" : row.deliveryCity || "Envío"}
        </span>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      align: "right",
      render: (total: number, row) => (
        <div>
          <span className="font-semibold text-ink">{soles(total)}</span>
          {row.paidTotal > 0 && row.paidTotal < row.total && (
            <p className="text-[11px] text-warn">Debe {soles(row.total - row.paidTotal)}</p>
          )}
        </div>
      ),
    },
    {
      title: "Estado",
      dataIndex: "status",
      render: (estado: EstadoPedido) => <BadgeEstado estado={estado} />,
    },
    {
      title: "",
      key: "acciones",
      align: "right",
      render: (_, row) => (
        <Button size="small" onClick={() => setDetalleId(row.id)}>
          Ver
        </Button>
      ),
    },
  ];

  const opcionesFiltro = [
    { label: `Todos${resumen ? ` (${resumen.totalPedidos})` : ""}`, value: "todos" },
    ...(["pendiente", "confirmado", "pagado", "enviado", "entregado", "cancelado"] as const).map(
      (e) => ({
        label: `${e[0].toUpperCase()}${e.slice(1)}${
          resumen?.porEstado?.[e] ? ` (${resumen.porEstado[e]})` : ""
        }`,
        value: e,
      })
    ),
  ];

  return (
    <>
      <PageHeader
        titulo="Pedidos"
        descripcion="Todo lo que entra por tu tienda online. Confirmar un pedido descuenta el stock; cancelarlo lo repone."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          etiqueta="Pedidos totales"
          valor={resumen?.totalPedidos ?? 0}
          icono={<TbReceipt />}
          indice={0}
        />
        <StatCard
          etiqueta="Por atender"
          valor={resumen?.porEstado?.pendiente ?? 0}
          icono={<TbClock />}
          tono="warn"
          detalle="Esperando que los confirmes"
          indice={1}
        />
        <StatCard
          etiqueta="En camino"
          valor={resumen?.porEstado?.enviado ?? 0}
          icono={<TbTruckDelivery />}
          tono="ok"
          indice={2}
        />
        <StatCard
          etiqueta="Ventas acumuladas"
          valor={soles(resumen?.ventasAcumuladas ?? 0)}
          icono={<TbCash />}
          detalle="Sin contar cancelados"
          indice={3}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-4">
          <div className="max-w-full overflow-x-auto">
            <Segmented
              options={opcionesFiltro}
              value={filtro}
              onChange={(v) => setFiltro(String(v))}
            />
          </div>
          <Input.Search
            placeholder="Código, nombre o teléfono…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            allowClear
            style={{ width: 260 }}
          />
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : pedidos.length === 0 ? (
          <Empty
            className="py-16"
            description={
              filtro === "todos" && !busqueda
                ? "Todavía no has recibido pedidos. Comparte el enlace de tu tienda para empezar."
                : "Ningún pedido coincide con ese filtro"
            }
          />
        ) : (
          <Table
            rowKey="id"
            columns={columnas}
            dataSource={pedidos}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            onRow={(row) => ({
              onClick: () => setDetalleId(row.id),
              className: "cursor-pointer",
            })}
          />
        )}
      </div>

      <OrderDetailDrawer
        pedidoId={detalleId}
        onCerrar={() => setDetalleId(null)}
        onCambio={cargar}
      />
    </>
  );
}
