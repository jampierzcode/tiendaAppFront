import { useCallback, useEffect, useState } from "react";
import { Button, Input, Table, Tag, message } from "antd";
import { TbEdit } from "react-icons/tb";
import { apiTienda } from "../api/apiTienda";
import PageHeader from "../components/ui/PageHeader";
import RecipeModal from "../components/admin/RecipeModal";
import { errorDe, soles } from "./comun";

interface Plato {
  id: number;
  name: string;
  price: number;
  status: string;
}

interface Costo {
  productId: number;
  plato: string;
  costo: number;
  margen: number;
  costoPct: number | null;
}

/**
 * Recetas: qué insumos (o preparaciones) lleva cada plato. Con eso se
 * descuenta el inventario al cobrar y se calcula el costo y el margen. Las
 * preparaciones (salsas, masas) se arman en Existencias.
 */
export default function RecetasPage() {
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [costos, setCostos] = useState<Map<number, Costo>>(new Map());
  const [buscar, setBuscar] = useState("");
  const [editar, setEditar] = useState<Plato | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([apiTienda.get("/products", { params: { status: "activo" } }), apiTienda.get("/stock/reports")]);
      setPlatos((p.data.data ?? []).map((x: Plato) => ({ ...x, price: Number(x.price) })));
      setCostos(new Map((r.data.data.platos as Costo[]).map((c) => [c.productId, c])));
    } catch (e) {
      message.error(errorDe(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = platos.filter((p) => !buscar || p.name.toLowerCase().includes(buscar.toLowerCase()));
  const sinReceta = platos.filter((p) => !costos.has(p.id)).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        titulo="Recetas"
        descripcion="Lo que lleva cada plato. Así el inventario se descuenta solo al cobrar y ves el costo y el margen. Las preparaciones (salsas, masas) se arman en Existencias."
        acciones={<Input.Search allowClear placeholder="Buscar plato" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ width: 240 }} />}
      />
      {sinReceta > 0 && (
        <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-[13px] text-warn">
          {sinReceta} plato{sinReceta === 1 ? "" : "s"} sin receta: al venderlos no se descuenta inventario. Para productos que se venden tal cual (una gaseosa),
          la receta es 1 unidad de ese insumo.
        </p>
      )}
      <div className="card overflow-hidden">
        <Table
          rowKey="id"
          size="small"
          dataSource={visibles}
          pagination={{ pageSize: 50 }}
          columns={[
            { title: "Plato", dataIndex: "name" },
            { title: "Precio", align: "right", render: (_, p: Plato) => soles(p.price) },
            {
              title: "Costo",
              align: "right",
              render: (_, p: Plato) => (costos.has(p.id) ? soles(costos.get(p.id)!.costo) : <Tag>Sin receta</Tag>),
            },
            {
              title: "% costo",
              align: "right",
              render: (_, p: Plato) => {
                const c = costos.get(p.id);
                if (!c || c.costoPct === null) return "—";
                return <Tag color={c.costoPct > 40 ? "red" : c.costoPct > 32 ? "orange" : "green"}>{c.costoPct}%</Tag>;
              },
            },
            {
              title: "",
              align: "right",
              render: (_, p: Plato) => (
                <Button size="small" icon={<TbEdit />} onClick={() => setEditar(p)}>
                  {costos.has(p.id) ? "Editar receta" : "Crear receta"}
                </Button>
              ),
            },
          ]}
        />
      </div>
      <RecipeModal
        open={Boolean(editar)}
        producto={editar ? { id: editar.id, name: editar.name, price: editar.price } : null}
        onClose={() => setEditar(null)}
        onSaved={() => {
          setEditar(null);
          void cargar();
        }}
      />
    </div>
  );
}
