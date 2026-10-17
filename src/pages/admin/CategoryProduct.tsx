import { useEffect, useState, useMemo } from "react";
import {
  Button,
  Input,
  message,
  Modal,
  Form,
  Table,
  Tag,
  Space,
  Switch,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { MenuOutlined, PlusOutlined } from "@ant-design/icons";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import { useBusiness, useEsRestaurante } from "../../context/BusinessContext";
import SelectorOrden, { type Orden } from "../../components/ui/SelectorOrden";
import { moverElemento, useFilasArrastrables } from "../../hooks/useFilasArrastrables";
import { compartirEnlace, copiarEnlace, puedeCompartir, urlCategoria } from "../../utilities/compartir";
import { TbCopy, TbShare3 } from "react-icons/tb";

interface Subcategory {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  category_id: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image_url?: string | null;
  isActive?: boolean;
  subcategories?: Subcategory[];
}

export function CategoriesPage() {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const [form] = Form.useForm();
  const [formSub] = Form.useForm();
  const [editing, setEditing] = useState<Category | null>(null);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [searchSub, setSearchSub] = useState("");
  const [orden, setOrden] = useState<Orden>("manual");
  const [ordenSub, setOrdenSub] = useState<Orden>("manual");
  const { business } = useBusiness();
  const esRestaurante = useEsRestaurante();

  // 🔹 Traer categorías con preload de subcategorías
  const fetchList = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const res = await apiTienda.get("/categories");
      setData(res.data.data || []);
    } catch (err) {
      console.error(err);
      message.error("No se pudo cargar categorías");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [business]);

  // 🔹 Guardar categoría
  const handleSave = async (values: any) => {
    try {
      const payload = { ...values, business_id: business?.id };
      if (editing) {
        await apiTienda.put(`/categories/${editing.id}`, payload);
        message.success("Categoría actualizada");
      } else {
        await apiTienda.post("/categories", payload);
        message.success("Categoría creada");
      }
      setOpen(false);
      fetchList();
    } catch (err) {
      console.error(err);
      message.error("No se pudo guardar");
    }
  };

  // 🔹 Eliminar categoría
  const handleDelete = async (row: Category) => {
    Modal.confirm({
      title: "¿Eliminar categoría?",
      content: `Se eliminará "${row.name}"`,
      onOk: async () => {
        try {
          await apiTienda.delete(`/categories/${row.id}`);
          message.success("Categoría eliminada");
          fetchList();
        } catch {
          message.error("No se pudo eliminar");
        }
      },
    });
  };

  // 🔹 Guardar subcategoría
  const handleSaveSub = async (values: any) => {
    if (!activeCategory) return;
    try {
      const payload = { ...values, category_id: activeCategory.id };
      if (editingSub) {
        await apiTienda.put(`/subcategories/${editingSub.id}`, payload);
        message.success("Subcategoría actualizada");
      } else {
        await apiTienda.post(`/subcategories`, payload);
        message.success("Subcategoría creada");
      }
      await fetchList();
      setEditingSub(null);
      formSub.resetFields();
    } catch (err) {
      console.error(err);
      message.error("Error al guardar subcategoría");
    }
  };

  // 🔹 Eliminar subcategoría
  const handleDeleteSub = async (sub: Subcategory) => {
    Modal.confirm({
      title: "¿Eliminar subcategoría?",
      content: `Se eliminará "${sub.name}"`,
      onOk: async () => {
        try {
          await apiTienda.delete(`/subcategories/${sub.id}`);
          message.success("Subcategoría eliminada");
          fetchList();
        } catch {
          message.error("No se pudo eliminar");
        }
      },
    });
  };

  // 🔹 Filtrar categorías
  const alfabetico = <T extends { name: string }>(lista: T[], o: Orden) =>
    o === "manual"
      ? lista
      : [...lista].sort((a, b) =>
          o === "asc" ? a.name.localeCompare(b.name, "es") : b.name.localeCompare(a.name, "es")
        );

  const filteredData = useMemo(() => {
    return alfabetico(
      data.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
      orden
    );
  }, [data, search, orden]);

  useEffect(() => {
    if (!activeCategory) return;

    const updatedCategory = data.find((c) => c.id === activeCategory.id);

    if (updatedCategory) {
      setActiveCategory(updatedCategory);
    }
  }, [data]);

  // 🔹 Filtrar subcategorías dentro del modal
  const filteredSubcategories = useMemo(() => {
    if (!activeCategory) return [];
    const subs = activeCategory.subcategories || [];
    return alfabetico(
      subs.filter((s) => s.name.toLowerCase().includes(searchSub.toLowerCase())),
      ordenSub
    );
  }, [activeCategory, searchSub, ordenSub]);

  // Arrastrar para ordenar (solo con orden manual y sin búsqueda activa).
  const guardarOrden = async (ruta: string, ids: number[]) => {
    try {
      await apiTienda.put(ruta, { ids });
    } catch {
      message.error("No se pudo guardar el orden");
      fetchList();
    }
  };

  const filasCategorias = useFilasArrastrables<Category>({
    habilitado: orden === "manual" && !search,
    onSoltar: (desde, hacia) => {
      const i = data.findIndex((c) => c.id === desde);
      const j = data.findIndex((c) => c.id === hacia);
      const nuevo = moverElemento(data, i, j);
      setData(nuevo);
      guardarOrden("/categories/reorder", nuevo.map((c) => c.id));
    },
  });

  const filasSub = useFilasArrastrables<Subcategory>({
    habilitado: ordenSub === "manual" && !searchSub,
    onSoltar: (desde, hacia) => {
      if (!activeCategory) return;
      const subs = activeCategory.subcategories ?? [];
      const nuevo = moverElemento(
        subs,
        subs.findIndex((s) => s.id === desde),
        subs.findIndex((s) => s.id === hacia)
      );
      setData((d) => d.map((c) => (c.id === activeCategory.id ? { ...c, subcategories: nuevo } : c)));
      guardarOrden("/subcategories/reorder", nuevo.map((s) => s.id));
    },
  });

  // 🧩 Columnas de categorías
  const alternarActiva = (row: Category, activa: boolean) => {
    const aplicar = async () => {
      try {
        await apiTienda.put(`/categories/${row.id}`, { is_active: activa });
        message.success(activa ? "Categoría activada" : "Categoría desactivada");
        fetchList();
      } catch {
        message.error("No se pudo cambiar el estado");
      }
    };

    if (activa) return aplicar();
    Modal.confirm({
      title: `¿Desactivar «${row.name}»?`,
      content:
        "La categoría y sus productos dejarán de verse en tu tienda. Un producto que también esté en otra categoría activa seguirá visible. Al reactivarla todo vuelve como estaba.",
      okText: "Sí, desactivar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
      onOk: aplicar,
    });
  };

  const columns: ColumnsType<Category> = [
    ...(orden === "manual" && !search
      ? [{ title: "", key: "arrastrar", width: 40, render: () => <MenuOutlined style={{ color: "#999" }} /> }]
      : []),
    {
      title: "Nombre",
      dataIndex: "name",
      key: "name",
      render: (v) => <strong>{v}</strong>,
    },
    { title: "Slug", dataIndex: "slug", key: "slug" },
    { title: "Descripción", dataIndex: "description", key: "description" },
    {
      title: "En la tienda",
      key: "is_active",
      width: 130,
      render: (_, row) => (
        <Switch
          checked={row.isActive !== false}
          checkedChildren="Activa"
          unCheckedChildren="Oculta"
          onChange={(v) => alternarActiva(row, v)}
        />
      ),
    },
    {
      title: "Subcategorías",
      key: "subcategories",
      render: (_, row) => (
        <Space>
          <Tag color="blue">{row.subcategories?.length || 0}</Tag>
        </Space>
      ),
    },
    {
      title: "Acciones",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(row);
              form.setFieldsValue(row);
              setOpen(true);
            }}
          >
            Editar
          </Button>
          <Button size="small" danger onClick={() => handleDelete(row)}>
            Eliminar
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setActiveCategory(row);
              setOpenSubs(true);
              setSearchSub("");
              setEditingSub(null);
              formSub.resetFields();
            }}
          >
            Subcategorías
          </Button>
          {!esRestaurante && business?.slug && row.slug && (
            <>
              <Button
                size="small"
                icon={<TbCopy />}
                title="Copiar el enlace de esta categoría en tu tienda"
                onClick={() => copiarEnlace(urlCategoria(business!.slug!, row.slug))}
              >
                Copiar enlace
              </Button>
              {puedeCompartir() && (
                <Button
                  size="small"
                  icon={<TbShare3 />}
                  onClick={() => compartirEnlace(urlCategoria(business!.slug!, row.slug), row.name)}
                >
                  Compartir
                </Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  // 🧩 Columnas de subcategorías dentro del modal
  const subColumns: ColumnsType<Subcategory> = [
    ...(ordenSub === "manual" && !searchSub
      ? [{ title: "", key: "arrastrar", width: 40, render: () => <MenuOutlined style={{ color: "#999" }} /> }]
      : []),
    { title: "Nombre", dataIndex: "name", key: "name" },
    { title: "Descripción", dataIndex: "description", key: "description" },
    {
      title: "Acciones",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditingSub(row);
              formSub.setFieldsValue(row);
            }}
          >
            Editar
          </Button>
          <Button size="small" danger onClick={() => handleDeleteSub(row)}>
            Eliminar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Categorías"
        descripcion="Cómo se organiza tu tienda para el cliente. Cada categoría puede tener subcategorías."
        acciones={
        <Space wrap>
          <SelectorOrden value={orden} onChange={setOrden} />
          <Input.Search
            placeholder="Buscar categorías..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Nueva categoría
          </Button>
        </Space>
        }
      />

      <div className="card overflow-hidden">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredData}
        columns={columns}
        onRow={(row) => filasCategorias.onRow(row)}
      />

      {/* Modal Categoría */}
      <Modal
        open={open}
        title={editing ? "Editar categoría" : "Nueva categoría"}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form layout="vertical" form={form} onFinish={handleSave}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="image_url" label="URL de imagen">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Subcategorías */}
      <Modal
        open={openSubs}
        width={800}
        title={`Subcategorías de "${activeCategory?.name}"`}
        onCancel={() => setOpenSubs(false)}
        footer={null}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <SelectorOrden value={ordenSub} onChange={setOrdenSub} />
          <Input.Search
            placeholder="Buscar subcategorías..."
            value={searchSub}
            onChange={(e) => setSearchSub(e.target.value)}
            style={{ width: 250 }}
          />
          <Button
            type="primary"
            onClick={() => {
              setEditingSub(null);
              formSub.resetFields();
            }}
          >
            Nueva subcategoría
          </Button>
        </Space>

        <Form
          form={formSub}
          layout="vertical"
          onFinish={handleSaveSub}
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {editingSub ? "Actualizar" : "Agregar"}
          </Button>
        </Form>

        <Table
          rowKey="id"
          dataSource={filteredSubcategories}
          columns={subColumns}
          onRow={(row) => filasSub.onRow(row)}
          pagination={false}
        />
      </Modal>
      </div>
    </>
  );
}
