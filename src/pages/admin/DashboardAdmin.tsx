import { useEsRestaurante, useFunciones } from "../../context/BusinessContext";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, Spin } from "antd";
import { motion } from "motion/react";
import {
  TbAlertTriangle,
  TbCash,
  TbChefHat,
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

interface InsumoBajo {
  id: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

interface BajoStock {
  id: number;
  stock: number;
  pendiente?: number;
  product: { name: string };
  attributes: { value: { value: string } }[];
}

export default function DashboardAdmin() {
  const { uuid_business } = useParams();
  const { auth } = useAuth();
  const esRestaurante = useEsRestaurante();
  const { tiene, planLabel } = useFunciones();

  const [resumen, setResumen] = useState<any>(null);
  const [ultimos, setUltimos] = useState<PedidoResumen[]>([]);
  const [bajoStock, setBajoStock] = useState<BajoStock[]>([]);
  const [insumosBajos, setInsumosBajos] = useState<InsumoBajo[]>([]);
  const [productos, setProductos] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Cada bloque por su lado: si el plan no incluye pedidos o insumos (403),
    // el resto del resumen se pinta igual.
    const datos = (p: Promise<any>) => p.then((r) => r.data.data).catch(() => null);
    Promise.all([
      datos(apiTienda.get("/orders/summary")),
      datos(apiTienda.get("/orders", { params: { perPage: 6 } })),
      // En restaurantes lo que se acaba son los insumos, no los platos.
      esRestaurante
        ? datos(apiTienda.get("/ingredients"))
        : datos(apiTienda.get("/inventory/low-stock")),
      datos(apiTienda.get("/products")),
    ])
      .then(([s, o, l, p]) => {
        setResumen(s);
        setUltimos(o ?? []);
        if (esRestaurante) {
          setInsumosBajos(
            ((l ?? []) as (InsumoBajo & { low: boolean })[])
              .filter((i) => i.low)
              .sort((a, b) => a.stock - b.stock)
          );
        } else {
          setBajoStock(l ?? []);
        }
        setProductos((p ?? []).length);
      })
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, [uuid_business, esRestaurante]);

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
        descripcion={esRestaurante ? "Así va tu restaurante hoy." : "Así va tu tienda hoy."}
      />

      {!tiene("pedidos_online") && (
        <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50/60 p-4">
          <div>
            <p className="text-[14px] font-bold text-ink">
              Tu plan {planLabel ? `«${planLabel}» ` : ""}recibe los pedidos por WhatsApp
            </p>
            <p className="text-[12.5px] text-muted">
              Con el plan Pedidos llegan a este panel, pasan a cocina y tu cliente sigue su pedido en vivo.
            </p>
          </div>
          <Link
            to={`/b/${uuid_business}/plan`}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
          >
            Ver planes
          </Link>
        </div>
      )}

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
        {esRestaurante ? (
          <>
            <StatCard
              etiqueta="En cocina"
              valor={(resumen?.porEstado?.preparando ?? 0) + (resumen?.porEstado?.listo ?? 0)}
              icono={<TbChefHat />}
              detalle="Preparando o listos"
              indice={2}
            />
            <StatCard
              etiqueta="Insumos por reponer"
              valor={insumosBajos.length}
              icono={<TbAlertTriangle />}
              tono={insumosBajos.length ? "danger" : "ok"}
              detalle={insumosBajos.length ? "Revisa tus insumos" : "Todo en orden"}
              indice={3}
            />
          </>
        ) : (
          <>
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
          </>
        )}
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

        {esRestaurante && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.22 }}
            className="card p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink">Insumos que se acaban</h2>
              <Link
                to={`/b/${uuid_business}/ingredients`}
                className="text-[13px] font-medium text-brand-600 hover:underline"
              >
                Ver insumos
              </Link>
            </div>

            {insumosBajos.length === 0 ? (
              <Empty
                className="py-8"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Ningún insumo por debajo del mínimo"
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {insumosBajos.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <Link
                      to={`/b/${uuid_business}/ingredients`}
                      className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{i.name}</p>
                        <p className="text-[11px] text-muted">
                          Mínimo {i.minStock} {i.unit}
                        </p>
                      </div>
                      <span
                        className={`pill ${i.stock <= 0 ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"}`}
                      >
                        {i.stock <= 0 ? "Agotado" : `Quedan ${i.stock} ${i.unit}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        )}

        {!esRestaurante && (
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
                    {(v.pendiente ?? 0) > 0 && ` · +${v.pendiente} por llegar`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
        )}
      </div>
    </>
  );
}
