import { useEffect, useState, useMemo } from "react";
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Form,
  Table,
  Tag,
  Space,
  Select,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { BiCategoryAlt } from "react-icons/bi";
import { PlusOutlined } from "@ant-design/icons";
import { apiTienda } from "../../api/apiTienda";
import { useBusiness } from "../../context/BusinessContext";

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
  const { business } = useBusiness();

  // 🔹 Traer categorías con preload de subcategorías
  const fetchList = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const res = await apiTienda.get(`/categories/byBusiness/${business.id}`);
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
  const filteredData = useMemo(() => {
    return data.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

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
    return subs.filter((s) =>
      s.name.toLowerCase().includes(searchSub.toLowerCase())
    );
  }, [activeCategory, searchSub]);

  // 🧩 Columnas de categorías
  const columns: ColumnsType<Category> = [
    {
      title: "Nombre",
      dataIndex: "name",
      key: "name",
      render: (v) => <strong>{v}</strong>,
    },
    { title: "Slug", dataIndex: "slug", key: "slug" },
    { title: "Descripción", dataIndex: "description", key: "description" },
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
        </Space>
      ),
    },
  ];

  // 🧩 Columnas de subcategorías dentro del modal
  const subColumns: ColumnsType<Subcategory> = [
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
    <Card
      title={
        <span>
          <BiCategoryAlt size={20} className="mr-2" /> Categorías
        </span>
      }
      extra={
        <Space>
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
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredData}
        columns={columns}
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
        <Space style={{ marginBottom: 16 }}>
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
          pagination={false}
        />
      </Modal>
    </Card>
  );
}
