import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Form, Input, Modal, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { TbPlus } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Etiqueta {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  productsCount: number;
}

/**
 * Etiquetas: palabras con las que agrupas productos (Nuevo, Oferta, Temporada…)
 * y con las que tus clientes filtran en la tienda.
 */
export default function TagsPage() {
  const [lista, setLista] = useState<Etiqueta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Etiqueta | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await apiTienda.get("/tags");
      setLista(r.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar las etiquetas");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (e?: Etiqueta) => {
    setEditando(e ?? null);
    form.resetFields();
    form.setFieldsValue({ name: e?.name, color: e?.color ?? "#059669" });
    setAbierto(true);
  };

  const guardar = async (v: any) => {
    setGuardando(true);
    try {
      if (editando) await apiTienda.put(`/tags/${editando.id}`, v);
      else await apiTienda.post("/tags", v);
      message.success(editando ? "Etiqueta actualizada" : "Etiqueta creada");
      setAbierto(false);
      await cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (e: Etiqueta) =>
    Modal.confirm({
      title: `¿Eliminar «${e.name}»?`,
      content: e.productsCount
        ? `Se quitará de ${e.productsCount} producto${e.productsCount === 1 ? "" : "s"}. Los productos no se borran.`
        : "No la usa ningún producto.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await apiTienda.delete(`/tags/${e.id}`);
          message.success("Etiqueta eliminada");
          await cargar();
        } catch {
          message.error("No se pudo eliminar");
        }
      },
    });

  const columnas: ColumnsType<Etiqueta> = [
    {
      title: "Etiqueta",
      key: "name",
      render: (_, e) => (
        <span className="inline-flex items-center gap-2 font-medium text-ink">
          <span
            className="inline-block h-3 w-3 rounded-full border border-line"
            style={{ backgroundColor: e.color ?? "#999" }}
          />
          {e.name}
        </span>
      ),
    },
    {
      title: "Productos",
      dataIndex: "productsCount",
      align: "center",
      render: (n: number) => <span className="text-ink-soft">{n}</span>,
    },
    {
      title: "",
      key: "acciones",
      align: "right",
      render: (_, e) => (
        <div className="flex justify-end gap-1.5">
          <Button size="small" onClick={() => abrir(e)}>
            Editar
          </Button>
          <Button size="small" danger onClick={() => eliminar(e)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Etiquetas"
        descripcion="Agrupa tus productos con palabras como Nuevo, Más vendido u Oferta. Tus clientes las usan para filtrar en la tienda. Las asignas desde cada producto."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => abrir()}>
            Nueva etiqueta
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : lista.length === 0 ? (
          <Empty className="py-16" description="Aún no tienes etiquetas. Crea la primera, por ejemplo «Nuevo»." />
        ) : (
          <Table rowKey="id" columns={columnas} dataSource={lista} pagination={{ pageSize: 20, hideOnSinglePage: true }} />
        )}
      </div>

      <Modal
        open={abierto}
        title={editando ? "Editar etiqueta" : "Nueva etiqueta"}
        onCancel={() => setAbierto(false)}
        onOk={() => form.submit()}
        confirmLoading={guardando}
        okText={editando ? "Guardar" : "Crear"}
        cancelText="Cancelar"
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={guardar} className="pt-2">
          <Form.Item name="name" label="Nombre" rules={[{ required: true, min: 2, message: "Escribe el nombre" }]}>
            <Input placeholder="Nuevo" maxLength={40} />
          </Form.Item>
          <Form.Item name="color" label="Color">
            <Input type="color" className="h-10 w-24" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
