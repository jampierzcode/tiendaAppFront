import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Empty, Form, InputNumber, Modal, Select, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { TbPlus, TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Descuento {
  id: number;
  percentage: number;
  startDate: string;
  endDate: string;
  product?: { id: number; name: string; price: number };
}

interface Producto {
  id: number;
  name: string;
  price: number;
}

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;

/** ¿Está corriendo hoy? Es lo primero que se quiere saber de una promo. */
const vigencia = (d: Descuento) => {
  const hoy = dayjs().startOf("day");
  const inicio = dayjs(d.startDate).startOf("day");
  const fin = dayjs(d.endDate).endOf("day");
  if (hoy.isBefore(inicio)) return { texto: "Programado", clase: "bg-info-bg text-info" };
  if (hoy.isAfter(fin)) return { texto: "Vencido", clase: "bg-line-soft text-muted" };
  return { texto: "Activo", clase: "bg-ok-bg text-ok" };
};

export default function DiscountsPage() {
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [d, p] = await Promise.all([
        apiTienda.get("/discounts"),
        apiTienda.get("/products"),
      ]);
      setDescuentos(d.data.data ?? []);
      setProductos(p.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar los descuentos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async (v: { product_id: number; percentage: number; rango: [Dayjs, Dayjs] }) => {
    setGuardando(true);
    try {
      await apiTienda.post("/discounts", {
        product_id: v.product_id,
        percentage: v.percentage,
        start_date: v.rango[0].format("YYYY-MM-DD"),
        end_date: v.rango[1].format("YYYY-MM-DD"),
      });
      message.success("Descuento creado");
      setModalAbierto(false);
      form.resetFields();
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (d: Descuento) =>
    Modal.confirm({
      title: "¿Eliminar este descuento?",
      content: `${d.product?.name} volverá a venderse a ${soles(d.product?.price ?? 0)}.`,
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        await apiTienda.delete(`/discounts/${d.id}`);
        message.success("Descuento eliminado");
        await cargar();
      },
    });

  const columnas: ColumnsType<Descuento> = [
    {
      title: "Producto",
      key: "producto",
      render: (_, d) => (
        <p className="text-[13px] font-medium text-ink">{d.product?.name ?? "—"}</p>
      ),
    },
    {
      title: "Descuento",
      dataIndex: "percentage",
      align: "right",
      render: (p: number) => <span className="pill bg-danger-bg text-danger">−{p}%</span>,
    },
    {
      title: "Queda en",
      key: "final",
      align: "right",
      render: (_, d) =>
        d.product ? (
          <div>
            <span className="font-semibold text-ink">
              {soles(d.product.price * (1 - d.percentage / 100))}
            </span>
            <p className="text-[11px] text-muted line-through">{soles(d.product.price)}</p>
          </div>
        ) : (
          "—"
        ),
    },
    {
      title: "Vigencia",
      key: "vigencia",
      render: (_, d) => (
        <div>
          <span className={`pill ${vigencia(d).clase}`}>{vigencia(d).texto}</span>
          <p className="mt-1 text-[11px] text-muted">
            {dayjs(d.startDate).format("DD MMM")} — {dayjs(d.endDate).format("DD MMM YYYY")}
          </p>
        </div>
      ),
    },
    {
      title: "",
      key: "acciones",
      align: "right",
      render: (_, d) => (
        <Button size="small" danger icon={<TbTrash />} onClick={() => eliminar(d)} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Descuentos"
        descripcion="Promociones por producto con fecha de inicio y fin. Si dos se solapan, el cliente paga la mejor."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => setModalAbierto(true)}>
            Nuevo descuento
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : descuentos.length === 0 ? (
          <Empty
            className="py-16"
            description="Sin descuentos activos. Crea uno para que aparezca en tu tienda."
          />
        ) : (
          <Table
            rowKey="id"
            columns={columnas}
            dataSource={descuentos}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
          />
        )}
      </div>

      <Modal
        open={modalAbierto}
        onCancel={() => setModalAbierto(false)}
        onOk={() => form.submit()}
        confirmLoading={guardando}
        title="Nuevo descuento"
        okText="Crear"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={crear} className="pt-2">
          <Form.Item
            name="product_id"
            label="Producto"
            rules={[{ required: true, message: "Elige un producto" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Buscar producto…"
              options={productos.map((p) => ({
                value: p.id,
                label: `${p.name} — ${soles(p.price)}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="percentage"
            label="Porcentaje de descuento"
            rules={[{ required: true, message: "Indica el porcentaje" }]}
          >
            <InputNumber min={1} max={90} suffix="%" className="w-full" />
          </Form.Item>

          <Form.Item
            name="rango"
            label="Vigencia"
            rules={[{ required: true, message: "Indica desde y hasta cuándo" }]}
          >
            <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
