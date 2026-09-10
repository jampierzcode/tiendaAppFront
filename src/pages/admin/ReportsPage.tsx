import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Empty, Segmented, Spin, Table, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { motion } from "motion/react";
import {
  TbAlertTriangle,
  TbArrowBackUp,
  TbCash,
  TbDownload,
  TbReceipt,
  TbTrendingUp,
} from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import SalesChart, { type PuntoSerie } from "../../components/admin/SalesChart";

interface ProductoTop {
  productId: number;
  nombre: string;
  unidades: number;
  devueltas: number;
  ingresos: number;
  margen: number;
  margenPorcentaje: number;
}

interface Overview {
  rango: { desde: string; hasta: string };
  granularidad: "day" | "week" | "month";
  resumen: {
    vendido: number;
    devuelto: number;
    neto: number;
    costo: number;
    margen: number;
    margenPorcentaje: number;
    pedidos: number;
    unidades: number;
    ticketPromedio: number;
  };
  serie: PuntoSerie[];
  productos: ProductoTop[];
  clientes: { nombre: string; telefono: string | null; pedidos: number; gastado: number }[];
  pagos: { metodo: string; total: number; cobros: number }[];
  alertasStock: { id: number; producto: string; variacion: string; stock: number }[];
  totalAlertas: number;
}

const SIMBOLO = "S/";
const soles = (v: number) => `${SIMBOLO} ${Number(v ?? 0).toFixed(2)}`;

const nombreMetodo: Record<string, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

const atajos: { label: string; rango: [Dayjs, Dayjs] }[] = [
  { label: "Hoy", rango: [dayjs(), dayjs()] },
  { label: "7 días", rango: [dayjs().subtract(6, "day"), dayjs()] },
  { label: "Este mes", rango: [dayjs().startOf("month"), dayjs()] },
  { label: "Mes pasado", rango: [
    dayjs().subtract(1, "month").startOf("month"),
    dayjs().subtract(1, "month").endOf("month"),
  ] },
];

export default function ReportsPage() {
  const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().startOf("month"), dayjs()]);
  const [granularidad, setGranularidad] = useState<"day" | "week" | "month">("day");
  const [datos, setDatos] = useState<Overview | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await apiTienda.get("/reports/overview", {
        params: {
          from: rango[0].format("YYYY-MM-DD"),
          to: rango[1].format("YYYY-MM-DD"),
          granularity: granularidad,
        },
      });
      setDatos(r.data.data);
    } catch {
      message.error("No se pudieron cargar los reportes");
    } finally {
      setCargando(false);
    }
  }, [rango, granularidad]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Exporta lo que se ve en pantalla, para abrirlo en Excel. */
  const exportar = () => {
    if (!datos) return;

    const filas = [
      ["Reporte de ventas", `${datos.rango.desde} a ${datos.rango.hasta}`],
      [],
      ["Periodo", "Vendido", "Devuelto", "Neto", "Margen", "Pedidos"],
      ...datos.serie.map((p) => [
        p.periodo,
        p.neto.toFixed(2),
        "",
        p.neto.toFixed(2),
        p.margen.toFixed(2),
        String(p.pedidos),
      ]),
      [],
      ["Producto", "Unidades", "Devueltas", "Ingresos", "Margen", "Margen %"],
      ...datos.productos.map((p) => [
        p.nombre,
        String(p.unidades),
        String(p.devueltas),
        p.ingresos.toFixed(2),
        p.margen.toFixed(2),
        p.margenPorcentaje.toFixed(1),
      ]),
    ];

    // BOM al inicio para que Excel abra las tildes bien.
    const csv = "﻿" + filas.map((f) => f.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${datos.rango.desde}-a-${datos.rango.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const r = datos?.resumen;
  const maxUnidades = Math.max(...(datos?.productos ?? []).map((p) => p.unidades), 1);

  return (
    <>
      <PageHeader
        titulo="Reportes"
        descripcion="Cuánto vendes, qué te deja más margen y qué se te está acabando. Los días se agrupan en hora de Lima."
        acciones={
          <Button icon={<TbDownload />} onClick={exportar} disabled={!datos}>
            Exportar CSV
          </Button>
        }
      />

      {/* Filtros */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-1.5">
          {atajos.map((a) => {
            const activo =
              rango[0].isSame(a.rango[0], "day") && rango[1].isSame(a.rango[1], "day");
            return (
              <button
                key={a.label}
                onClick={() => setRango(a.rango)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                  activo
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line text-ink-soft hover:border-brand-300"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        <DatePicker.RangePicker
          value={rango}
          onChange={(v) => v && setRango(v as [Dayjs, Dayjs])}
          format="DD/MM/YYYY"
          allowClear={false}
        />

        <div className="ml-auto">
          <Segmented
            value={granularidad}
            onChange={(v) => setGranularidad(v as typeof granularidad)}
            options={[
              { label: "Día", value: "day" },
              { label: "Semana", value: "week" },
              { label: "Mes", value: "month" },
            ]}
          />
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-24">
          <Spin size="large" />
        </div>
      ) : !datos || !r ? (
        <Empty className="py-20" description="Sin datos para este periodo" />
      ) : (
        <div className="space-y-5">
          {/* Cifras de cabecera */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              etiqueta="Ventas netas"
              valor={soles(r.neto)}
              icono={<TbCash />}
              detalle={r.devuelto > 0 ? `Ya sin ${soles(r.devuelto)} devueltos` : undefined}
              indice={0}
            />
            <StatCard
              etiqueta="Ganancia"
              valor={soles(r.margen)}
              icono={<TbTrendingUp />}
              tono={r.margen >= 0 ? "ok" : "danger"}
              detalle={`${r.margenPorcentaje.toFixed(1)}% de margen · costo ${soles(r.costo)}`}
              indice={1}
            />
            <StatCard
              etiqueta="Pedidos"
              valor={r.pedidos}
              icono={<TbReceipt />}
              detalle={`${r.unidades} prendas vendidas`}
              indice={2}
            />
            <StatCard
              etiqueta="Ticket promedio"
              valor={soles(r.ticketPromedio)}
              icono={<TbArrowBackUp />}
              detalle="Neto por pedido"
              indice={3}
            />
          </div>

          {/* Serie de ventas */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="card p-5"
          >
            <h2 className="mb-1 text-[15px] font-bold text-ink">Ventas netas en el tiempo</h2>
            <p className="mb-4 text-[12px] text-muted">
              Descontando devoluciones. Pasa el cursor por un punto para ver el detalle.
            </p>
            <SalesChart serie={datos.serie} simbolo={SIMBOLO} granularidad={datos.granularidad} />
          </motion.section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Productos más vendidos */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.16 }}
              className="card p-5"
            >
              <h2 className="mb-4 text-[15px] font-bold text-ink">Lo que más se vende</h2>

              {datos.productos.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin ventas" className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {datos.productos.map((p, i) => (
                    <li key={p.productId}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13px] font-medium text-ink">
                          {p.nombre}
                        </span>
                        <span className="tabular shrink-0 text-[12px] text-muted">
                          {p.unidades} uds · {soles(p.ingresos)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(p.unidades / maxUnidades) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.2 + i * 0.05 }}
                            className="h-full rounded-full bg-brand-500"
                          />
                        </div>
                        <span
                          className={`tabular w-14 shrink-0 text-right text-[12px] font-semibold ${
                            p.margenPorcentaje >= 30
                              ? "text-ok"
                              : p.margenPorcentaje >= 0
                                ? "text-warn"
                                : "text-danger"
                          }`}
                        >
                          {p.margenPorcentaje.toFixed(0)}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-muted">
                La barra es el volumen; el porcentaje de la derecha, el margen.
              </p>
            </motion.section>

            {/* Cómo cobra */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.22 }}
              className="card p-5"
            >
              <h2 className="mb-4 text-[15px] font-bold text-ink">Cómo te pagan</h2>

              {datos.pagos.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin cobros" className="py-6" />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {datos.pagos.map((p) => (
                    <li key={p.metodo} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-[13px] font-medium text-ink">
                          {nombreMetodo[p.metodo] ?? p.metodo}
                        </p>
                        <p className="text-[11px] text-muted">
                          {p.cobros} {p.cobros === 1 ? "cobro" : "cobros"}
                        </p>
                      </div>
                      <span className="tabular text-[14px] font-semibold text-ink">
                        {soles(p.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Clientes */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.28 }}
              className="card p-5"
            >
              <h2 className="mb-3 text-[15px] font-bold text-ink">Quién compra más</h2>
              {datos.clientes.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin clientes" className="py-6" />
              ) : (
                <Table
                  rowKey={(row) => `${row.nombre}-${row.telefono ?? ""}`}
                  size="small"
                  pagination={false}
                  dataSource={datos.clientes}
                  columns={[
                    {
                      title: "Cliente",
                      dataIndex: "nombre",
                      render: (n: string, row: any) => (
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-ink">{n}</p>
                          {row.telefono && (
                            <p className="font-mono text-[11px] text-muted">{row.telefono}</p>
                          )}
                        </div>
                      ),
                    },
                    { title: "Pedidos", dataIndex: "pedidos", align: "center" as const },
                    {
                      title: "Gastado",
                      dataIndex: "gastado",
                      align: "right" as const,
                      render: (v: number) => (
                        <span className="font-semibold text-ink">{soles(v)}</span>
                      ),
                    },
                  ]}
                />
              )}
            </motion.section>

            {/* Alertas de stock */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.34 }}
              className="card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink">Se está acabando</h2>
                {datos.totalAlertas > 0 && (
                  <span className="pill bg-warn-bg text-warn">
                    <TbAlertTriangle /> {datos.totalAlertas}
                  </span>
                )}
              </div>

              {datos.alertasStock.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Nada por debajo del mínimo"
                  className="py-6"
                />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {datos.alertasStock.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{a.producto}</p>
                        <p className="text-[11px] text-muted">{a.variacion}</p>
                      </div>
                      <span
                        className={`pill ${a.stock === 0 ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"}`}
                      >
                        {a.stock === 0 ? "Agotado" : `Quedan ${a.stock}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          </div>
        </div>
      )}
    </>
  );
}
