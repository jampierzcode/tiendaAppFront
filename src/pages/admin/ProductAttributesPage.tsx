import { useEffect, useState, useMemo } from "react";
import {
  Card,
  Button,
  Input,
  Table,
  Modal,
  Form,
  Tag,
  Space,
  Select,
  Switch,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { GiSettingsKnobs } from "react-icons/gi";
import { apiTienda } from "../../api/apiTienda";
import { useBusiness } from "../../context/BusinessContext";

interface AttributeValue {
  id: number;
  attribute_id: number;
  value: string;
  hex_color?: string | null;
}

interface ProductAttribute {
  id: number;
  name: string;
  type: string;
  is_required: boolean;
  is_filterable: boolean;
  values?: AttributeValue[];
}

export default function ProductAttributesPage() {
  const { business } = useBusiness();
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [modalAttrOpen, setModalAttrOpen] = useState(false);
  const [modalValuesOpen, setModalValuesOpen] = useState(false);
  const [formAttr] = Form.useForm();
  const [formValue] = Form.useForm();
  const [editingAttr, setEditingAttr] = useState<ProductAttribute | null>(null);
  const [editingValue, setEditingValue] = useState<AttributeValue | null>(null);
  const [activeAttr, setActiveAttr] = useState<ProductAttribute | null>(null);
  const [searchValue, setSearchValue] = useState("");

  // 📦 Cargar atributos
  const fetchAttributes = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const res = await apiTienda.get(`/product-attributes`);
      setAttributes(res.data.data || []);
    } catch (err) {
      console.error(err);
      message.error("Error al cargar atributos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, [business]);

  // 💾 Crear / actualizar atributo
  const handleSaveAttribute = async (values: any) => {
    try {
      if (editingAttr) {
        await apiTienda.put(`/product-attributes/${editingAttr.id}`, values);
        message.success("Atributo actualizado");
      } else {
        await apiTienda.post(`/product-attributes`, values);
        message.success("Atributo creado");
      }
      setModalAttrOpen(false);
      await fetchAttributes();
    } catch {
      message.error("No se pudo guardar");
    }
  };

  // 🗑️ Eliminar atributo
  const handleDeleteAttribute = async (row: ProductAttribute) => {
    Modal.confirm({
      title: "¿Eliminar atributo?",
      content: `Esto eliminará el atributo "${row.name}"`,
      onOk: async () => {
        try {
          await apiTienda.delete(`/product-attributes/${row.id}`);
          message.success("Atributo eliminado");
          fetchAttributes();
        } catch {
          message.error("Error al eliminar");
        }
      },
    });
  };

  // 💾 Crear / actualizar valor
  const handleSaveValue = async (values: any) => {
    if (!activeAttr) return;
    const payload = { ...values, attribute_id: activeAttr.id };
    try {
      if (editingValue) {
        await apiTienda.put(
          `/product-attribute-values/${editingValue.id}`,
          payload
        );
        message.success("Valor actualizado");
      } else {
        await apiTienda.post(`/product-attribute-values`, payload);
        message.success("Valor agregado");
      }
      formValue.resetFields();
      setEditingValue(null);
      fetchAttributes();
    } catch {
      message.error("Error al guardar valor");
    }
  };

  // 🗑️ Eliminar valor
  const handleDeleteValue = async (value: AttributeValue) => {
    Modal.confirm({
      title: "¿Eliminar valor?",
      content: `Se eliminará "${value.value}"`,
      onOk: async () => {
        try {
          await apiTienda.delete(`/product-attribute-values/${value.id}`);
          message.success("Valor eliminado");
          fetchAttributes();
        } catch {
          message.error("No se pudo eliminar");
        }
      },
    });
  };

  // 🔎 Filtrar atributos
  const filteredAttributes = useMemo(() => {
    return attributes.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [attributes, search]);

  useEffect(() => {
    if (!activeAttr) return;

    const updatedAttr = attributes.find((a) => a.id === activeAttr.id);
    if (updatedAttr) {
      setActiveAttr(updatedAttr);
    }
  }, [attributes]);

  // 🔎 Filtrar valores
  const filteredValues = useMemo(() => {
    if (!activeAttr) return [];
    const vals = activeAttr.values || [];
    return vals.filter((v) =>
      v.value.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [activeAttr, searchValue]);

  // 🧩 Columnas principales
  const columns: ColumnsType<ProductAttribute> = [
    { title: "Nombre", dataIndex: "name", key: "name" },
    {
      title: "Tipo",
      dataIndex: "type",
      key: "type",
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Requerido",
      dataIndex: "is_required",
      render: (v) => (v ? "Sí" : "No"),
    },
    {
      title: "Filtrable",
      dataIndex: "is_filterable",
      render: (v) => (v ? "Sí" : "No"),
    },
    {
      title: "Valores",
      key: "values",
      render: (_, row) => <Tag color="purple">{row.values?.length || 0}</Tag>,
    },
    {
      title: "Acciones",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditingAttr(row);
              formAttr.setFieldsValue(row);
              setModalAttrOpen(true);
            }}
          >
            Editar
          </Button>
          <Button
            size="small"
            danger
            onClick={() => handleDeleteAttribute(row)}
          >
            Eliminar
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setActiveAttr(row);
              setModalValuesOpen(true);
              formValue.resetFields();
              setEditingValue(null);
            }}
          >
            Valores
          </Button>
        </Space>
      ),
    },
  ];

  // 🧩 Columnas de valores
  const valueColumns: ColumnsType<AttributeValue> = [
    {
      title: "Valor",
      dataIndex: "value",
      key: "value",
    },
    {
      title: "Color (si aplica)",
      dataIndex: "hexColor",
      render: (v) =>
        v && v !== "" ? (
          <div
            style={{
              backgroundColor: v,
              width: 25,
              height: 25,
              borderRadius: "50%",
              border: "1px solid #ccc",
            }}
          />
        ) : (
          "-"
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
              setEditingValue(row);
              formValue.setFieldsValue(row);
            }}
          >
            Editar
          </Button>
          <Button size="small" danger onClick={() => handleDeleteValue(row)}>
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
          <GiSettingsKnobs size={20} className="mr-2" />
          Atributos del negocio
        </span>
      }
      extra={
        <Space>
          <Input.Search
            placeholder="Buscar atributos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <Button
            type="primary"
            onClick={() => {
              setEditingAttr(null);
              formAttr.resetFields();
              setModalAttrOpen(true);
            }}
          >
            Nuevo atributo
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        dataSource={filteredAttributes}
        columns={columns}
        loading={loading}
      />

      {/* MODAL ATRIBUTOS */}
      <Modal
        open={modalAttrOpen}
        title={editingAttr ? "Editar atributo" : "Nuevo atributo"}
        onCancel={() => setModalAttrOpen(false)}
        onOk={() => formAttr.submit()}
      >
        <Form layout="vertical" form={formAttr} onFinish={handleSaveAttribute}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "text", label: "Texto" },
                { value: "color", label: "Color" },
                { value: "size", label: "Talla" },
                { value: "number", label: "Número" },
                { value: "select", label: "Lista desplegable" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Requerido"
            name="is_required"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Usar como filtro"
            name="is_filterable"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL VALORES */}
      <Modal
        open={modalValuesOpen}
        width={800}
        title={`${activeAttr?.name}`}
        onCancel={() => setModalValuesOpen(false)}
        footer={null}
      >
        <Form
          layout="inline"
          form={formValue}
          onFinish={handleSaveValue}
          style={{ marginBottom: 16 }}
        >
          <Form.Item
            label="Valor"
            name="value"
            rules={[{ required: true, message: "Ingresa un valor" }]}
          >
            <Input placeholder="Ej. Azul, M, Grande..." />
          </Form.Item>

          <Form.Item
            label="Color"
            name="hex_color"
            valuePropName="value"
            className="flex flex-col"
          >
            <Input
              type="color"
              className="!w-10 !p-2 !border !border-gray-300 rounded cursor-pointer"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              {editingValue ? "Actualizar" : "Agregar"}
            </Button>
          </Form.Item>
        </Form>

        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Buscar valores..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ width: 250 }}
          />
        </Space>
        <Table
          rowKey="id"
          dataSource={filteredValues}
          columns={valueColumns}
          pagination={false}
        />
      </Modal>
    </Card>
  );
}
