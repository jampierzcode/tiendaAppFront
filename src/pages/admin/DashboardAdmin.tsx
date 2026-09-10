import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, Spin } from "antd";
import { motion } from "motion/react";
import {
  TbAlertTriangle,
  TbCash,
  TbClock,
  TbPackage,
} from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import BadgeEstado, { type EstadoPedido } from "../../components/ui/EstadoPedido";
import { useAuth } from "../../context/AuthContext";

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;

interface PedidoResumen {
  id: number;
  code: string;
  customerName: string;
  total: number;
  status: EstadoPedido;
  createdAt: string;
}

interface BajoStock {
  id: number;
  stock: number;
  product: { name: string };
  attributes: { value: { value: string } }[];
}

export default function DashboardAdmin() {
  const { uuid_business } = useParams();
  const { auth } = useAuth();

  const [resumen, setResumen] = useState<any>(null);
  const [ultimos, setUltimos] = useState<PedidoResumen[]>([]);
  const [bajoStock, setBajoStock] = useState<BajoStock[]>([]);
  const [productos, setProductos] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      apiTienda.get("/orders/summary").then((r) => r.data.data),
      apiTienda.get("/orders", { params: { perPage: 6 } }).then((r) => r.data.data),
      apiTienda.get("/inventory/low-stock").then((r) => r.data.data),
      apiTienda.get("/products").then((r) => r.data.data),
    ])
      .then(([s, o, l, p]) => {
        setResumen(s);
        setUltimos(o ?? []);
        setBajoStock(l ?? []);
        setProductos((p ?? []).length);
      })
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, [uuid_business]);

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        titulo={`Hola, ${auth.user?.name?.split(" ")[0] ?? ""}`}
        descripcion="Así va tu tienda hoy."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          etiqueta="Ventas acumuladas"
          valor={soles(resumen?.ventasAcumuladas ?? 0)}
          icono={<TbCash />}
          detalle="Sin contar cancelados"
          indice={0}
        />
        <StatCard
          etiqueta="Pedidos por atender"
          valor={resumen?.porEstado?.pendiente ?? 0}
          icono={<TbClock />}
          tono="warn"
          indice={1}
        />
        <StatCard
          etiqueta="Productos activos"
          valor={productos}
          icono={<TbPackage />}
          indice={2}
        />
        <StatCard
          etiqueta="Stock bajo"
          valor={bajoStock.length}
          icono={<TbAlertTriangle />}
          tono={bajoStock.length ? "danger" : "ok"}
          detalle={bajoStock.length ? "Necesitan reposición" : "Todo en orden"}
          indice={3}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="card p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-ink">Últimos pedidos</h2>
            <Link
              to={`/b/${uuid_business}/orders`}
              className="text-[13px] font-medium text-brand-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {ultimos.length === 0 ? (
            <Empty
              className="py-8"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Todavía no hay pedidos"
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {ultimos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {p.customerName}
                    </p>
                    <p className="font-mono text-[11px] text-muted">{p.code}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] font-semibold">{soles(p.total)}</span>
                    <BadgeEstado estado={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.22 }}
          className="card p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-ink">Se está acabando</h2>
            <Link
              to={`/b/${uuid_business}/inventory`}
              className="text-[13px] font-medium text-brand-600 hover:underline"
            >
              Ver inventario
            </Link>
          </div>

          {bajoStock.length === 0 ? (
            <Empty
              className="py-8"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Ninguna talla por debajo del mínimo"
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {bajoStock.slice(0, 6).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {v.product?.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {v.attributes?.map((a) => a.value?.value).filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`pill ${v.stock === 0 ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"}`}
                  >
                    {v.stock === 0 ? "Agotado" : `Quedan ${v.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </>
  );
}
