import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Table, Tag, message } from "antd";
import { TbPlus } from "react-icons/tb";
import dayjs, { type Dayjs } from "dayjs";
import { apiTienda } from "../api/apiTienda";
import PageHeader from "../components/ui/PageHeader";
import { TIPO_MOVIMIENTO, errorDe, num, type Insumo } from "./comun";

interface Mov {
  id: number;
  fecha: string;
  insumo: string;
  unidad: string;
  tipo: string;
  cantidad: number;
  saldo: number;
  costo: number | null;
  nota: string | null;
  usuario: string | null;
}

/**
 * Movimientos (kardex): todo lo que entró y salió del almacén, con filtros.
 * Desde aquí también se registran mermas y ajustes sueltos.
 */
export default function MovimientosPage() {
  const [filas, setFilas] = useState<Mov[] | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumo, setInsumo] = useState<number | undefined>();
  const [tipo, setTipo] = useState<string | undefined>();
  const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, "day"), dayjs()]);
  const [registrar, setRegistrar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await apiTienda.get("/stock/movements", {
        params: { ingredientId: insumo, type: tipo, desde: rango[0].format("YYYY-MM-DD"), hasta: rango[1].format("YYYY-MM-DD") },
      });
      setFilas(data.data);
    } catch (e) {
      message.error(errorDe(e));
    }
  }, [insumo, tipo, rango]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useEffect(() => {
    apiTienda.get("/ingredients").then((r) => setInsumos(r.data.data ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        titulo="Movimientos"
        descripcion="El kardex del almacén: compras, ventas por receta, producción, mermas, ajustes y conteos, con el saldo después de cada uno."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => setRegistrar(true)}>
            Merma o ajuste
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          className="w-60"
          placeholder="Todos los insumos"
          value={insumo}
          onChange={setInsumo}
          options={insumos.map((i) => ({ value: i.id, label: i.name }))}
        />
        <Select
          allowClear
          className="w-48"
          placeholder="Todos los tipos"
          value={tipo}
          onChange={setTipo}
          options={Object.entries(TIPO_MOVIMIENTO).map(([value, t]) => ({ value, label: t.texto }))}
        />
        <DatePicker.RangePicker value={rango} format="DD/MM/YYYY" onChange={(v) => v?.[0] && v[1] && setRango([v[0], v[1]])} />
      </div>
      <div className="card overflow-hidden">
        <Table
          rowKey="id"
          size="small"
          loading={!filas}
          dataSource={filas ?? []}
          pagination={{ pageSize: 50 }}
          columns={[
            { title: "Fecha", dataIndex: "fecha", render: (v: string) => dayjs(v).format("DD/MM HH:mm") },
            { title: "Insumo", dataIndex: "insumo" },
            { title: "Tipo", dataIndex: "tipo", render: (v: string) => <Tag color={TIPO_MOVIMIENTO[v]?.color}>{TIPO_MOVIMIENTO[v]?.texto ?? v}</Tag> },
            {
              title: "Cantidad",
              align: "right",
              render: (_, m: Mov) => (
                <span className={`font-mono ${m.cantidad < 0 ? "text-danger" : "text-ok"}`}>
                  {m.cantidad > 0 ? "+" : ""}
                  {num(m.cantidad)} {m.unidad}
                </span>
              ),
            },
            { title: "Saldo", align: "right", render: (_, m: Mov) => <span className="font-mono">{num(m.saldo)}</span> },
            { title: "Nota", dataIndex: "nota" },
            { title: "Por", dataIndex: "usuario" },
          ]}
        />
      </div>
      {registrar && (
        <MermaAjuste
          insumos={insumos}
          onClose={() => setRegistrar(false)}
          onHecho={() => {
            setRegistrar(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function MermaAjuste({ insumos, onClose, onHecho }: { insumos: Insumo[]; onClose: () => void; onHecho: () => void }) {
  const [form] = Form.useForm();
  const [tipo, setTipo] = useState<"merma" | "ajuste">("merma");
  const id = Form.useWatch("ingredientId", form);
  const ins = insumos.find((i) => i.id === id);
  return (
    <Modal
      open
      title="Merma o ajuste"
      okText="Registrar"
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Radio.Group
        className="mb-4"
        optionType="button"
        buttonStyle="solid"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        options={[
          { value: "merma", label: "Merma (se perdió)" },
          { value: "ajuste", label: "Ajuste (lo que hay de verdad)" },
        ]}
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={async (v) => {
          try {
            await apiTienda.post(`/ingredients/${v.ingredientId}/movements`, { type: tipo, quantity: v.quantity, note: v.note });
            message.success("Registrado");
            onHecho();
          } catch (e) {
            message.error(errorDe(e));
          }
        }}
      >
        <Form.Item name="ingredientId" label="Insumo" rules={[{ required: true, message: "Elige el insumo" }]}>
          <Select showSearch optionFilterProp="label" options={insumos.map((i) => ({ value: i.id, label: `${i.name} (${num(i.stock)} ${i.unit})` }))} />
        </Form.Item>
        <Form.Item
          name="quantity"
          label={tipo === "merma" ? `Cantidad perdida${ins ? ` (${ins.unit})` : ""}` : `Cantidad real que hay${ins ? ` (${ins.unit})` : ""}`}
          rules={[{ required: true, message: "Escribe la cantidad" }]}
        >
          <InputNumber min={0} className="!w-full" />
        </Form.Item>
        <Form.Item name="note" label="Motivo">
          <Input placeholder={tipo === "merma" ? "Se malogró, se cayó, vencido…" : "Recuento"} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
