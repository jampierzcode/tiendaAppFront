import { useCallback, useEffect, useState } from "react";
import {
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
import { TbPlus } from "react-icons/tb";
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
        ? { unit: "kg", minStock: 0, stock: 0 }
        : { name: i.name, unit: i.unit, minStock: i.minStock, isActive: i.isActive }
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

  const columnas: ColumnsType<Insumo> = [
    {
      title: "Insumo",
      dataIndex: "name",
      render: (n: string, r) => (
        <div>
          <strong className={r.isActive ? "" : "text-muted line-through"}>{n}</strong>
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
          <Button size="small" type="primary" ghost onClick={() => abrirMovimiento(r)}>
            Movimiento
          </Button>
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
        titulo="Insumos"
        descripcion="Lo que compras y se agota: carne, pan, queso, bebidas. Los platos los consumen según su receta cuando confirmas un pedido."
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
        <Table rowKey="id" loading={cargando} dataSource={insumos} columns={columnas} pagination={false} />
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
    </>
  );
}
