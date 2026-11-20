import { useCallback, useEffect, useState } from "react";
import { DatePicker, Spin, Table, Tabs, Tag, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { apiTienda } from "../api/apiTienda";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { errorDe, num, soles } from "./comun";

interface Reporte {
  valorizado: { total: number; categorias: { categoria: string; valor: number }[] };
  bajoStock: { insumo: string; unidad: string; stock: number; minimo: number }[];
  consumo: {
    insumo: string;
    unidad: string;
    teorico: number;
    perdida: number;
    real: number;
    costoTeorico: number;
    costoPerdida: number;
    perdidaPct: number | null;
  }[];
  costoVentas: {
    ventas: number;
    pedidos: number;
    costoTeorico: number;
    costoPerdidas: number;
    costoPct: number | null;
    costoRealPct: number | null;
  };
  platos: { plato: string; precio: number; costo: number; margen: number; margenPct: number | null; costoPct: number | null }[];
}

/**
 * Reportes de inventario: cuánto vale el almacén, cuánto se consumió según
 * las recetas contra lo que se perdió (mermas y faltantes de conteo), el
 * costo de lo vendido y el margen de cada plato.
 */
export default function ReportesInventarioPage() {
  const [r, setR] = useState<Reporte | null>(null);
  const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, "day"), dayjs()]);

  const cargar = useCallback(async () => {
    try {
      const { data } = await apiTienda.get("/stock/reports", {
        params: { desde: rango[0].format("YYYY-MM-DD"), hasta: rango[1].format("YYYY-MM-DD") },
      });
      setR(data.data);
    } catch (e) {
      message.error(errorDe(e));
    }
  }, [rango]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        titulo="Reportes de inventario"
        descripcion="Valor del almacén, consumo según recetas contra pérdidas reales, costo de lo vendido y margen por plato."
        acciones={<DatePicker.RangePicker value={rango} format="DD/MM/YYYY" onChange={(v) => v?.[0] && v[1] && setRango([v[0], v[1]])} />}
      />
      {!r ? (
        <Spin />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard etiqueta="Valor del almacén" valor={soles(r.valorizado.total)} />
            <StatCard etiqueta="Ventas del periodo" valor={soles(r.costoVentas.ventas)} />
            <StatCard etiqueta="Costo de lo vendido" valor={r.costoVentas.costoPct === null ? "—" : `${r.costoVentas.costoPct}%`} />
            <StatCard etiqueta="Pérdidas (mermas y faltantes)" valor={soles(r.costoVentas.costoPerdidas)} />
          </div>
          <Tabs
            items={[
              {
                key: "consumo",
                label: "Consumo y pérdidas",
                children: (
                  <div className="card overflow-hidden">
                    <Table
                      rowKey="insumo"
                      size="small"
                      dataSource={r.consumo}
                      pagination={false}
                      columns={[
                        { title: "Insumo", dataIndex: "insumo" },
                        { title: "Según recetas", align: "right", render: (_, f) => `${num(f.teorico)} ${f.unidad}` },
                        { title: "Perdido", align: "right", render: (_, f) => <span className="text-danger">{num(f.perdida)} {f.unidad}</span> },
                        { title: "Real", align: "right", render: (_, f) => `${num(f.real)} ${f.unidad}` },
                        { title: "Costo", align: "right", render: (_, f) => soles(f.costoTeorico + f.costoPerdida) },
                        {
                          title: "% pérdida",
                          align: "right",
                          render: (_, f) =>
                            f.perdidaPct === null ? "—" : <Tag color={f.perdidaPct > 10 ? "red" : f.perdidaPct > 5 ? "orange" : "green"}>{f.perdidaPct}%</Tag>,
                        },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: "platos",
                label: "Costo por plato",
                children: (
                  <div className="card overflow-hidden">
                    <Table
                      rowKey="plato"
                      size="small"
                      dataSource={r.platos}
                      pagination={false}
                      columns={[
                        { title: "Plato", dataIndex: "plato" },
                        { title: "Precio", align: "right", render: (_, p) => soles(p.precio) },
                        { title: "Costo receta", align: "right", render: (_, p) => soles(p.costo) },
                        { title: "Margen", align: "right", render: (_, p) => soles(p.margen) },
                        {
                          title: "% costo",
                          align: "right",
                          render: (_, p) =>
                            p.costoPct === null ? "—" : <Tag color={p.costoPct > 40 ? "red" : p.costoPct > 32 ? "orange" : "green"}>{p.costoPct}%</Tag>,
                        },
                      ]}
                    />
                    <p className="p-3 text-[12px] text-muted">Referencia común en restaurantes: el costo del plato no debería pasar de 30–35% del precio.</p>
                  </div>
                ),
              },
              {
                key: "valorizado",
                label: "Valor por categoría",
                children: (
                  <div className="card overflow-hidden">
                    <Table
                      rowKey="categoria"
                      size="small"
                      dataSource={r.valorizado.categorias}
                      pagination={false}
                      columns={[
                        { title: "Categoría", dataIndex: "categoria" },
                        { title: "Valor", align: "right", render: (_, c) => soles(c.valor) },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: "bajo",
                label: `Stock bajo (${r.bajoStock.length})`,
                children: (
                  <div className="card overflow-hidden">
                    <Table
                      rowKey="insumo"
                      size="small"
                      dataSource={r.bajoStock}
                      pagination={false}
                      columns={[
                        { title: "Insumo", dataIndex: "insumo" },
                        { title: "Hay", align: "right", render: (_, b) => <span className="text-danger">{num(b.stock)} {b.unidad}</span> },
                        { title: "Mínimo", align: "right", render: (_, b) => `${num(b.minimo)} ${b.unidad}` },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
