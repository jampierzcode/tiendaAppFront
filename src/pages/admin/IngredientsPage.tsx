import { useCallback, useEffect, useState } from "react";
import {
  AutoComplete,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { TbPlus, TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Insumo {
  id: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  avgCost: number;
  value: number;
  low: boolean;
  isActive: boolean;
  recipesCount: number;
  category: string | null;
  kind: "insumo" | "preparacion";
  purchaseUnit: string | null;
  purchaseFactor: number;
  yieldQty: number | null;
}

interface Movimiento {
  id: number;
  type: string;
  quantity: number;
  unitCost: number | null;
  stockAfter: number;
  note: string | null;
  createdAt: string;
}

const UNIDADES = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "l", label: "Litros (l)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "und", label: "Unidades (und)" },
  { value: "porcion", label: "Porciones" },
];

const TIPOS: Record<string, string> = {
  inicial: "Stock inicial",
  compra: "Compra",
  ajuste: "Ajuste",
  merma: "Merma",
  consumo: "Consumo",
  devolucion: "Reposición",
};

const num = (v: number, d = 3) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: d });

/**
 * Insumos del restaurante: lo que se compra y se agota. Los platos los
 * consumen a través de su receta; aquí se ve el saldo, el costo promedio y
 * el historial de cada uno.
 */
export default function IngredientsPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busca, setBusca] = useState("");

  const [editando, setEditando] = useState<Insumo | "nuevo" | null>(null);
  const [form] = Form.useForm();
  const [guardando, setGuardando] = useState(false);

  const [movInsumo, setMovInsumo] = useState<Insumo | null>(null);
  const [movForm] = Form.useForm();
  const [tipoMov, setTipoMov] = useState<"compra" | "ajuste" | "merma">("compra");
  const [registrando, setRegistrando] = useState(false);

  const [kardex, setKardex] = useState<{ insumo: Insumo; filas: Movimiento[] } | null>(null);
  const [categoria, setCategoria] = useState<string>("");
  const [preparar, setPreparar] = useState<Insumo | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await apiTienda.get("/ingredients", { params: { search: busca || undefined } });
      setInsumos(r.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar los insumos");
    } finally {
      setCargando(false);
    }
  }, [busca]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirEdicion = (i: Insumo | "nuevo") => {
    setEditando(i);
    form.resetFields();
    form.setFieldsValue(
      i === "nuevo"
        ? { unit: "kg", minStock: 0, stock: 0, kind: "insumo", purchaseFactor: 1 }
        : {
            name: i.name,
            unit: i.unit,
            minStock: i.minStock,
            isActive: i.isActive,
            category: i.category,
            kind: i.kind,
            purchaseUnit: i.purchaseUnit,
            purchaseFactor: i.purchaseFactor,
          }
    );
  };

  const guardar = async (v: any) => {
    setGuardando(true);
    try {
      if (editando === "nuevo") await apiTienda.post("/ingredients", v);
      else if (editando) await apiTienda.put(`/ingredients/${editando.id}`, v);
      message.success("Insumo guardado");
      setEditando(null);
      cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (i: Insumo) => {
    try {
      await apiTienda.delete(`/ingredients/${i.id}`);
      message.success("Insumo eliminado");
      cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo eliminar");
    }
  };

  const abrirMovimiento = (i: Insumo) => {
    setMovInsumo(i);
    setTipoMov("compra");
    movForm.resetFields();
  };

  const registrar = async (v: any) => {
    if (!movInsumo) return;
    setRegistrando(true);
    try {
      await apiTienda.post(`/ingredients/${movInsumo.id}/movements`, { type: tipoMov, ...v });
      message.success("Movimiento registrado");
      setMovInsumo(null);
      cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo registrar");
    } finally {
      setRegistrando(false);
    }
  };

  const verKardex = async (i: Insumo) => {
    try {
      const r = await apiTienda.get(`/ingredients/${i.id}/movements`);
      setKardex({ insumo: i, filas: r.data.data ?? [] });
    } catch {
      message.error("No se pudo cargar el historial");
    }
  };

  const bajos = insumos.filter((i) => i.low).length;
  const categorias = [...new Set(insumos.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort();
  const visibles = insumos.filter((i) => !categoria || (i.category ?? "") === categoria);

  const columnas: ColumnsType<Insumo> = [
    {
      title: "Insumo",
      dataIndex: "name",
      render: (n: string, r) => (
        <div>
          <strong className={r.isActive ? "" : "text-muted line-through"}>{n}</strong>
          {r.kind === "preparacion" && <Tag color="purple" className="ml-2">Preparación</Tag>}
          <div className="text-[12px] text-muted">
            {r.category ?? "Sin categoría"}
            {r.purchaseUnit ? ` · se compra por ${r.purchaseUnit} (${num(r.purchaseFactor)} ${r.unit})` : ""}
          </div>
          {r.recipesCount > 0 && (
            <div className="text-[12px] text-muted">
              En {r.recipesCount} receta{r.recipesCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Stock",
      align: "right",
      render: (_, r) => (
        <Tag color={r.stock < 0 ? "red" : r.low ? "orange" : "green"}>
          {num(r.stock)} {r.unit}
        </Tag>
      ),
    },
    {
      title: "Mínimo",
      align: "right",
      render: (_, r) => `${num(r.minStock)} ${r.unit}`,
    },
    {
      title: "Costo prom.",
      align: "right",
      render: (_, r) => `S/ ${num(r.avgCost, 4)} / ${r.unit}`,
    },
    {
      title: "Valor",
      align: "right",
      render: (_, r) => `S/ ${num(r.value, 2)}`,
    },
    {
      title: "",
      key: "acc",
      align: "right",
      render: (_, r) => (
        <div className="flex justify-end gap-1">
          {r.kind === "preparacion" ? (
            <Button size="small" type="primary" ghost onClick={() => setPreparar(r)}>
              Receta y producir
            </Button>
          ) : (
            <Button size="small" type="primary" ghost onClick={() => abrirMovimiento(r)}>
              Merma / ajuste
            </Button>
          )}
          <Button size="small" onClick={() => verKardex(r)}>
            Historial
          </Button>
          <Button size="small" onClick={() => abrirEdicion(r)}>
            Editar
          </Button>
          <Popconfirm
            title="¿Eliminar este insumo?"
            okText="Eliminar"
            okButtonProps={{ danger: true }}
            onConfirm={() => eliminar(r)}
          >
            <Button size="small" danger>
              Eliminar
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Existencias"
        descripcion="Lo que tienes en almacén: insumos que compras (carne, arroz, gaseosas) y preparaciones que haces (salsas, masas). Los platos los descuentan según su receta al cobrar; las compras se registran en Inventario → Compras."
        acciones={
          <>
            <Input.Search
              placeholder="Buscar insumo…"
              allowClear
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ width: 240 }}
            />
            <Button type="primary" icon={<TbPlus />} onClick={() => abrirEdicion("nuevo")}>
              Nuevo insumo
            </Button>
          </>
        }
      />

      {bajos > 0 && (
        <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-[13px] font-medium text-warn">
          {bajos} insumo{bajos === 1 ? "" : "s"} en o por debajo del mínimo. Un stock en rojo está
          negativo: el conteo está atrasado y conviene hacer un ajuste.
        </p>
      )}

      <div className="card overflow-hidden">
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-line-soft p-3">
            {["", ...categorias].map((c) => (
              <Button key={c || "todas"} size="small" type={categoria === c ? "primary" : "default"} shape="round" onClick={() => setCategoria(c)}>
                {c || "Todas"}
              </Button>
            ))}
          </div>
        )}
        <Table rowKey="id" loading={cargando} dataSource={visibles} columns={columnas} pagination={false} />
      </div>

      {/* Crear / editar */}
      <Modal
        open={editando !== null}
        title={editando === "nuevo" ? "Nuevo insumo" : "Editar insumo"}
        onCancel={() => setEditando(null)}
        onOk={() => form.submit()}
        okText="Guardar"
        confirmLoading={guardando}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={guardar}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "Pon un nombre" }]}>
            <Input placeholder="Carne molida" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="unit"
              label="Unidad"
              extra="Las recetas se escriben en esta unidad."
            >
              <Select options={UNIDADES} disabled={editando !== "nuevo"} />
            </Form.Item>
            <Form.Item name="minStock" label="Avisar con menos de">
              <InputNumber min={0} className="!w-full" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="category" label="Categoría" extra="Carnes, Verduras, Bebidas… para contar por partes.">
              <AutoComplete options={categorias.map((c) => ({ value: c }))} placeholder="Abarrotes" />
            </Form.Item>
            <Form.Item name="kind" label="Tipo">
              <Select
                options={[
                  { value: "insumo", label: "Insumo (se compra)" },
                  { value: "preparacion", label: "Preparación (se produce)" },
                ]}
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="purchaseUnit" label="Se compra por (opcional)" extra="Saco, caja, botella…">
              <Input placeholder="saco" />
            </Form.Item>
            <Form.Item name="purchaseFactor" label="¿Cuánto trae?" extra="En la unidad de uso: 1 saco = 50 kg.">
              <InputNumber min={0.0001} className="!w-full" />
            </Form.Item>
          </div>
          {editando === "nuevo" && (
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item name="stock" label="Stock inicial">
                <InputNumber min={0} className="!w-full" />
              </Form.Item>
              <Form.Item name="unitCost" label="Costo por unidad" extra="Base del costo promedio.">
                <InputNumber min={0} prefix="S/" className="!w-full" />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

      {/* Compra / ajuste / merma */}
      <Modal
        open={movInsumo !== null}
        title={movInsumo ? `Movimiento · ${movInsumo.name}` : ""}
        onCancel={() => setMovInsumo(null)}
        onOk={() => movForm.submit()}
        okText="Registrar"
        confirmLoading={registrando}
        destroyOnHidden
      >
        {movInsumo && (
          <>
            <p className="mb-3 text-[13px] text-muted">
              Stock actual:{" "}
              <b>
                {num(movInsumo.stock)} {movInsumo.unit}
              </b>
            </p>
            <Radio.Group
              value={tipoMov}
              onChange={(e) => setTipoMov(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              className="mb-4"
              options={[
                { value: "compra", label: "Compra" },
                { value: "ajuste", label: "Conteo / ajuste" },
                { value: "merma", label: "Merma" },
              ]}
            />
            <Form form={movForm} layout="vertical" onFinish={registrar}>
              <Form.Item
                name="quantity"
                label={
                  tipoMov === "compra"
                    ? `Cantidad comprada (${movInsumo.unit})`
                    : tipoMov === "ajuste"
                      ? `Cantidad real que hay (${movInsumo.unit})`
                      : `Cantidad perdida (${movInsumo.unit})`
                }
                rules={[{ required: true, message: "Indica la cantidad" }]}
              >
                <InputNumber min={0} className="!w-full" />
              </Form.Item>
              {tipoMov === "compra" && (
                <Form.Item
                  name="unitCost"
                  label={`Costo por ${movInsumo.unit}`}
                  extra="Actualiza el costo promedio del insumo."
                >
                  <InputNumber min={0} prefix="S/" className="!w-full" />
                </Form.Item>
              )}
              <Form.Item name="note" label="Nota (opcional)">
                <Input
                  placeholder={
                    tipoMov === "merma" ? "Vencido, se cayó…" : tipoMov === "ajuste" ? "Conteo físico" : "Proveedor, factura…"
                  }
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Historial */}
      <Modal
        open={kardex !== null}
        title={kardex ? `Historial · ${kardex.insumo.name}` : ""}
        onCancel={() => setKardex(null)}
        footer={null}
        width={720}
      >
        {kardex && (
          <Table
            size="small"
            rowKey="id"
            dataSource={kardex.filas}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: "Fecha", render: (_, m: Movimiento) => dayjs(m.createdAt).format("DD/MM HH:mm") },
              { title: "Tipo", render: (_, m: Movimiento) => TIPOS[m.type] ?? m.type },
              {
                title: "Cantidad",
                align: "right",
                render: (_, m: Movimiento) => (
                  <span className={Number(m.quantity) < 0 ? "text-danger" : "text-ok"}>
                    {Number(m.quantity) > 0 ? "+" : ""}
                    {num(m.quantity)} {kardex.insumo.unit}
                  </span>
                ),
              },
              {
                title: "Saldo",
                align: "right",
                render: (_, m: Movimiento) => num(m.stockAfter),
              },
              { title: "Nota", dataIndex: "note" },
            ]}
          />
        )}
      </Modal>
      <PreparacionModal
        insumo={preparar}
        insumos={insumos}
        onClose={() => setPreparar(null)}
        onHecho={() => {
          setPreparar(null);
          cargar();
        }}
      />
    </>
  );
}

/** Receta de una preparación (qué lleva por tanda y cuánto rinde) y producir tandas. */
function PreparacionModal({
  insumo,
  insumos,
  onClose,
  onHecho,
}: {
  insumo: Insumo | null;
  insumos: Insumo[];
  onClose: () => void;
  onHecho: () => void;
}) {
  const [rinde, setRinde] = useState<number | null>(null);
  const [lineas, setLineas] = useState<{ ingredientId: number | null; quantity: number | null }[]>([]);
  const [tandas, setTandas] = useState<number | null>(1);
  useEffect(() => {
    if (!insumo) return;
    setRinde(insumo.yieldQty);
    setTandas(1);
    apiTienda
      .get(`/stock/preparations/${insumo.id}`)
      .then((r) => {
        const l = (r.data.data ?? []).map((c: { ingredientId: number; quantity: number }) => ({ ingredientId: c.ingredientId, quantity: c.quantity }));
        setLineas(l.length ? l : [{ ingredientId: null, quantity: null }]);
      })
      .catch(() => setLineas([{ ingredientId: null, quantity: null }]));
  }, [insumo]);
  if (!insumo) return null;
  const opciones = insumos.filter((i) => i.id !== insumo.id).map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const costoTanda = lineas.reduce((t, l) => t + Number(l.quantity ?? 0) * Number(insumos.find((i) => i.id === l.ingredientId)?.avgCost ?? 0), 0);
  const guardar = async () => {
    try {
      await apiTienda.put(`/stock/preparations/${insumo.id}`, {
        yieldQty: rinde,
        components: lineas.filter((l) => l.ingredientId && l.quantity),
      });
      message.success("Receta de la preparación guardada");
      return true;
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo guardar");
      return false;
    }
  };
  return (
    <Modal open title={`Preparación · ${insumo.name}`} onCancel={onClose} footer={null} width={620}>
      <p className="mb-3 text-[13px] text-muted">
        Lo que lleva <b>una tanda</b> y cuánto rinde. Los platos la usan como cualquier insumo; al producir se descuentan sus componentes.
      </p>
      {lineas.map((l, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <Select
            showSearch
            optionFilterProp="label"
            className="flex-1"
            placeholder="Insumo"
            value={l.ingredientId ?? undefined}
            options={opciones}
            onChange={(v) => setLineas(lineas.map((x, j) => (j === i ? { ...x, ingredientId: v } : x)))}
          />
          <InputNumber min={0} placeholder="Cantidad" value={l.quantity} onChange={(v) => setLineas(lineas.map((x, j) => (j === i ? { ...x, quantity: v === null ? null : Number(v) } : x)))} />
          <Button icon={<TbTrash />} onClick={() => setLineas(lineas.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button type="dashed" block icon={<TbPlus />} onClick={() => setLineas([...lineas, { ingredientId: null, quantity: null }])}>
        Agregar insumo
      </Button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px]">Rinde por tanda</span>
        <InputNumber min={0} value={rinde} onChange={(v) => setRinde(v === null ? null : Number(v))} addonAfter={insumo.unit} />
        <span className="text-[12.5px] text-muted">
          Costo por tanda S/ {costoTanda.toFixed(2)}
          {rinde ? ` · S/ ${(costoTanda / rinde).toFixed(2)} por ${insumo.unit}` : ""}
        </span>
        <Button className="ml-auto" onClick={guardar}>
          Guardar receta
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-canvas p-3">
        <span className="font-semibold">Producir</span>
        <InputNumber min={0.5} step={0.5} value={tandas} onChange={(v) => setTandas(v === null ? null : Number(v))} addonAfter="tandas" />
        <span className="text-[12.5px] text-muted">= {((tandas ?? 0) * (rinde ?? 0)).toLocaleString("es-PE")} {insumo.unit}</span>
        <Button
          type="primary"
          className="ml-auto"
          disabled={!tandas || !rinde}
          onClick={async () => {
            if (!(await guardar())) return;
            try {
              const r = await apiTienda.post(`/stock/preparations/${insumo.id}/produce`, { batches: tandas });
              message.success(`Producido: ${r.data.data.producido} ${insumo.unit} (costo S/ ${r.data.data.costo})`);
              onHecho();
            } catch (e) {
              message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo producir");
            }
          }}
        >
          Producir
        </Button>
      </div>
    </Modal>
  );
}
