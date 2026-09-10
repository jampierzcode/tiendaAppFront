import { useCallback, useEffect, useState } from "react";
import { Drawer, Empty, Input, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { motion } from "motion/react";
import { TbBrandWhatsapp, TbUsers } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import BadgeEstado, { type EstadoPedido } from "../../components/ui/EstadoPedido";

interface Cliente {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  pedidos: number;
  gastado: number;
  createdAt: string;
}

interface ClienteDetalle extends Cliente {
  orders: {
    id: number;
    code: string;
    status: EstadoPedido;
    total: number;
    createdAt: string;
    items: { id: number; productName: string; quantity: number }[];
  }[];
}

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

export default function CustomersPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<ClienteDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await apiTienda.get("/customers", {
        params: { search: busqueda || undefined, perPage: 50 },
      });
      setClientes(r.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar los clientes");
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    const t = setTimeout(cargar, busqueda ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, busqueda]);

  const abrir = async (id: number) => {
    setCargandoDetalle(true);
    setDetalle({ id } as ClienteDetalle);
    try {
      const r = await apiTienda.get(`/customers/${id}`);
      setDetalle(r.data.data);
    } catch {
      message.error("No se pudo cargar el cliente");
      setDetalle(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const columnas: ColumnsType<Cliente> = [
    {
      title: "Cliente",
      dataIndex: "name",
      render: (nombre: string, row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{nombre}</p>
          <p className="font-mono text-[11px] text-muted">{row.phone}</p>
        </div>
      ),
    },
    {
      title: "Ciudad",
      dataIndex: "city",
      responsive: ["md"],
      render: (c: string | null) => <span className="text-[13px] text-ink-soft">{c ?? "—"}</span>,
    },
    {
      title: "Pedidos",
      dataIndex: "pedidos",
      align: "center",
      render: (n: number) => <span className="font-semibold text-ink">{n}</span>,
    },
    {
      title: "Ha gastado",
      dataIndex: "gastado",
      align: "right",
      render: (v: number) => <span className="font-semibold text-ink">{soles(v)}</span>,
    },
    {
      title: "Desde",
      dataIndex: "createdAt",
      align: "right",
      responsive: ["lg"],
      render: (v: string) => <span className="text-[12px] text-muted">{fecha(v)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descripcion="Se crean solos con el primer pedido. Aquí ves quién te compra y cuánto."
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-4">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <TbUsers className="text-base" />
            {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
          </p>
          <Input.Search
            placeholder="Nombre o teléfono…"
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
        ) : clientes.length === 0 ? (
          <Empty
            className="py-16"
            description={
              busqueda
                ? "Ningún cliente coincide"
                : "Todavía no tienes clientes. Aparecerán con el primer pedido."
            }
          />
        ) : (
          <Table
            rowKey="id"
            columns={columnas}
            dataSource={clientes}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            onRow={(row) => ({ onClick: () => abrir(row.id), className: "cursor-pointer" })}
          />
        )}
      </div>

      <Drawer
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        width={480}
        title={detalle?.name ?? "Cliente"}
      >
        {cargandoDetalle || !detalle?.orders ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <section>
              <a
                href={`https://wa.me/${detalle.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-brand-600 hover:underline"
              >
                <TbBrandWhatsapp className="text-base" />
                {detalle.phone}
              </a>
              {(detalle.address || detalle.city) && (
                <p className="mt-1.5 text-[13px] text-ink-soft">
                  {[detalle.address, detalle.city].filter(Boolean).join(", ")}
                </p>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-canvas p-3">
                <p className="eyebrow">Pedidos</p>
                <p className="tabular mt-1 text-[22px] font-extrabold text-ink">
                  {detalle.orders.length}
                </p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="eyebrow">Ha gastado</p>
                <p className="tabular mt-1 text-[22px] font-extrabold text-ink">
                  {soles(
                    detalle.orders
                      .filter((o) => !["cancelado", "devuelto"].includes(o.status))
                      .reduce((t, o) => t + Number(o.total), 0)
                  )}
                </p>
              </div>
            </section>

            <section>
              <p className="eyebrow mb-2">Historial</p>
              <ul className="divide-y divide-line-soft">
                {detalle.orders.map((o) => (
                  <li key={o.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[13px] font-semibold text-ink">
                        {o.code}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{soles(o.total)}</span>
                        <BadgeEstado estado={o.status} />
                      </div>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {fecha(o.createdAt)} ·{" "}
                      {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>
        )}
      </Drawer>
    </>
  );
}
