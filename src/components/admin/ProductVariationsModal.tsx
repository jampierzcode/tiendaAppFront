import { useEffect, useState, useMemo } from "react";
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Space,
  message,
  Popconfirm,
  Card,
  Empty,
  Typography,
  Tooltip,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { apiTienda } from "../../api/apiTienda";

const { Text } = Typography;

interface VariationModalProps {
  open: boolean;
  onClose: () => void;
  product: any;
  refresh: () => void;
}

interface AttributeValue {
  id: number;
  value: string;
  hex_color?: string;
}

interface Attribute {
  id: number;
  name: string;
  values: AttributeValue[];
}

interface VariationAttribute {
  id: number;
  attributeValueId: number;
  value: {
    id: number;
    value: string;
    attribute: { id: number; name: string };
  };
}

interface Variation {
  id: number;
  sku: string;
  price: number;
  stock: number;
  weight: number;
  price_modifier?: number;
  attributes: VariationAttribute[];
}

interface VariationFormModalProps {
  open: boolean;
  onClose: () => void;
  productId: number;
  attributes: Attribute[];
  variationToEdit: Variation | null;
  onSaved: () => void;
}

/**
 * Modal secundario: crear / editar UNA variación
 * con "carrito" de atributos (filas dinámicas atributo + value)
 */
function VariationFormModal({
  open,
  onClose,
  productId,
  attributes,
  variationToEdit,
  onSaved,
}: VariationFormModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  type AttributeRow = {
    key: string;
    attributeId?: number;
    valueId?: number;
  };

  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>([]);

  // Prefill cuando abrimos para editar / crear
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAttributeRows([]);
      return;
    }

    if (variationToEdit) {
      form.setFieldsValue({
        sku: variationToEdit.sku,
        price: variationToEdit.price,
        stock: variationToEdit.stock,
        weight: variationToEdit.weight,
        price_modifier: variationToEdit.price_modifier ?? 0,
      });

      const rows: AttributeRow[] = variationToEdit.attributes.map((a) => ({
        key: String(a.id),
        attributeId: a.value.attribute.id,
        valueId: a.value.id,
      }));

      setAttributeRows(rows.length ? rows : [{ key: "0" }]);
    } else {
      form.resetFields();
      setAttributeRows([{ key: "0" }]);
    }
  }, [open, variationToEdit, form]);

  const usedAttributeIds = useMemo(
    () =>
      attributeRows
        .map((r) => r.attributeId)
        .filter((id): id is number => typeof id === "number"),
    [attributeRows]
  );

  const handleAddRow = () => {
    setAttributeRows((prev) => [
      ...prev,
      { key: `${Date.now()}_${prev.length}` },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    setAttributeRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleChangeAttribute = (key: string, attributeId: number) => {
    setAttributeRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, attributeId, valueId: undefined } : r
      )
    );
  };

  const handleChangeValue = (key: string, valueId: number) => {
    setAttributeRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, valueId } : r))
    );
  };

  const getAttributeOptionsForRow = (row: AttributeRow) => {
    return attributes.map((attr) => ({
      ...attr,
      disabled:
        row.attributeId === attr.id
          ? false
          : usedAttributeIds.includes(attr.id),
    }));
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();

      // Validar filas de atributos
      if (!attributeRows.length) {
        message.error("Agrega al menos un atributo.");
        return;
      }

      const cleanRows = attributeRows.filter(
        (r) => r.attributeId && r.valueId
      ) as Required<AttributeRow>[];

      if (!cleanRows.length) {
        message.error("Cada fila debe tener atributo y valor.");
        return;
      }

      const attributeValueIds = cleanRows.map((r) => r.valueId);

      const values = form.getFieldsValue();
      setSubmitting(true);

      let variationId = variationToEdit?.id;

      // Crear o actualizar variación
      if (!variationToEdit) {
        const res = await apiTienda.post("/product-variations", {
          product_id: productId,
          sku: values.sku,
          price: values.price,
          stock: values.stock,
          weight: values.weight || 0,
          price_modifier: values.price_modifier || 0,
        });
        variationId = res.data.data.id;
      } else {
        await apiTienda.put(`/product-variations/${variationToEdit.id}`, {
          sku: values.sku,
          price: values.price,
          stock: values.stock,
          weight: values.weight || 0,
          price_modifier: values.price_modifier || 0,
        });
        variationId = variationToEdit.id;
      }

      if (!variationId) {
        throw new Error("No se pudo obtener el ID de la variación");
      }

      // 👉 Sync de atributos en UN solo request (Adonis hace createMany / delete)
      await apiTienda.post("/product-variation-attributes", {
        variationId,
        attributeValueIds,
      });

      message.success(
        variationToEdit
          ? "Variación actualizada correctamente."
          : "Variación creada correctamente."
      );
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      message.error("Error al guardar la variación.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={variationToEdit ? "Editar variación" : "Nueva variación"}
      open={open}
      onCancel={onClose}
      width={720}
      okText={variationToEdit ? "Guardar cambios" : "Crear variación"}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        {/* Carrito de atributos */}
        <div className="flex items-center justify-between mb-2">
          <Text strong>Atributos de la variación</Text>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>
            Agregar atributo
          </Button>
        </div>
        {attributeRows.length === 0 && (
          <Text type="secondary">
            Agrega al menos un atributo para esta variación.
          </Text>
        )}

        <Space direction="vertical" style={{ width: "100%" }}>
          {attributeRows.map((row) => {
            const attributeOptions = getAttributeOptionsForRow(row);
            const selectedAttribute = attributes.find(
              (a) => a.id === row.attributeId
            );
            const availableValues = selectedAttribute?.values || [];

            return (
              <div
                key={row.key}
                className="flex flex-col md:flex-row gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
              >
                <Form.Item className="flex-1 mb-0" label="Atributo" required>
                  <Select
                    placeholder="Selecciona un atributo"
                    value={row.attributeId}
                    onChange={(val) => handleChangeAttribute(row.key, val)}
                    options={attributeOptions.map((attr) => ({
                      label: attr.name,
                      value: attr.id,
                      disabled: (attr as any).disabled,
                    }))}
                  />
                </Form.Item>

                <Form.Item className="flex-1 mb-0" label="Valor" required>
                  <Select
                    placeholder={
                      selectedAttribute
                        ? `Selecciona un valor de ${selectedAttribute.name}`
                        : "Selecciona primero un atributo"
                    }
                    value={row.valueId}
                    onChange={(val) => handleChangeValue(row.key, val)}
                    disabled={!selectedAttribute}
                  >
                    {availableValues.map((v) => (
                      <Select.Option key={v.id} value={v.id}>
                        <Space>
                          {v.hex_color && (
                            <span
                              style={{
                                display: "inline-block",
                                width: 12,
                                height: 12,
                                borderRadius: "999px",
                                backgroundColor: v.hex_color,
                                border: "1px solid rgba(0,0,0,.1)",
                              }}
                            />
                          )}
                          {v.value}
                        </Space>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <div className="flex items-center justify-end md:self-end">
                  <Button
                    danger
                    type="text"
                    onClick={() => handleRemoveRow(row.key)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })}
        </Space>
        {/* Datos básicos de la variación */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Form.Item
            name="sku"
            label="SKU"
            rules={[{ required: true, message: "Ingresa un SKU" }]}
          >
            <Input placeholder="SKU de la variación" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Precio"
            rules={[{ required: true, message: "Ingresa un precio" }]}
          >
            <InputNumber
              min={0}
              className="w-full"
              placeholder="Precio de la variación"
            />
          </Form.Item>

          <Form.Item
            name="stock"
            label="Stock"
            rules={[{ required: true, message: "Ingresa un stock" }]}
          >
            <InputNumber
              min={0}
              className="w-full"
              placeholder="Stock disponible"
            />
          </Form.Item>

          <Form.Item name="weight" label="Peso (opcional)">
            <InputNumber
              min={0}
              className="w-full"
              placeholder="Peso en gramos / kg"
            />
          </Form.Item>

          <Form.Item name="price_modifier" label="Modificador de precio">
            <InputNumber className="w-full" placeholder="Ej. +5, -10, etc." />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

/**
 * Modal principal: muestra variaciones como CARDS bonitas,
 * y abre el modal secundario para crear / editar.
 */
export default function VariationModal({
  open,
  onClose,
  product,
  refresh,
}: VariationModalProps) {
  const [loading, setLoading] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [variationToEdit, setVariationToEdit] = useState<Variation | null>(
    null
  );

  const fetchAttributes = async () => {
    try {
      const res = await apiTienda.get("/product-attributes");
      setAttributes(res.data.data || []);
    } catch (error) {
      console.error(error);
      message.error("Error cargando atributos");
    }
  };

  const fetchVariations = async () => {
    try {
      setLoading(true);
      const res = await apiTienda.get(
        `/product-variations?productId=${product.id}`
      );
      setVariations(res.data.data || []);
    } catch (error) {
      console.error(error);
      message.error("Error cargando variaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && product?.id) {
      fetchAttributes();
      fetchVariations();
    }
  }, [open, product?.id]);

  const handleNewVariation = () => {
    setVariationToEdit(null);
    setFormOpen(true);
  };

  const handleEditVariation = (variation: Variation) => {
    setVariationToEdit(variation);
    setFormOpen(true);
  };

  const handleDeleteVariation = async (id: number) => {
    try {
      setLoading(true);
      await apiTienda.delete(`/product-variations/${id}`);
      message.success("Variación eliminada");
      await fetchVariations();
      refresh();
    } catch (error) {
      console.error(error);
      message.error("Error eliminando variación");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSaved = () => {
    fetchVariations();
    refresh();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <Modal
        title={
          <div className="flex flex-col gap-1">
            <Text strong>Variaciones del producto</Text>
            {product?.name && (
              <h1 className="font-bold text-xl">{product.name}</h1>
            )}
          </div>
        }
        open={open}
        onCancel={handleClose}
        width={980}
        footer={null}
        destroyOnClose
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <Text>
              Gestiona todas las variaciones de este producto: talla, color,
              presentación, etc.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleNewVariation}
          >
            Nueva variación
          </Button>
        </div>

        {loading ? null : variations.length === 0 ? (
          <div className="py-10">
            <Empty description="Aún no hay variaciones creadas.">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleNewVariation}
              >
                Crear primera variación
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {variations.map((v) => (
              <Card
                onClick={() => handleEditVariation(v)}
                key={v.id}
                hoverable
                className="rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Text strong>{v.sku}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ID: {v.id}
                      </Text>
                    </div>
                  </div>
                  <div className="text-right">
                    <Text>
                      Precio:{" "}
                      <Text strong>
                        {v.price.toLocaleString("es-PE", {
                          style: "currency",
                          currency: "PEN",
                        })}
                      </Text>
                    </Text>
                    <div>
                      <Tag color={v.stock > 0 ? "green" : "red"}>
                        Stock: {v.stock}
                      </Tag>
                    </div>
                  </div>
                </div>

                {v.attributes?.length > 0 && (
                  <div className="mb-3">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Atributos
                    </Text>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {v.attributes.map((a) => (
                        <Tooltip
                          key={a.id}
                          title={`${a.value.attribute.name}: ${a.value.value}`}
                        >
                          <Tag>
                            <Text strong style={{ marginRight: 4 }}>
                              {a.value.attribute.name}:
                            </Text>
                            {a.value.value}
                          </Tag>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  {typeof v.weight === "number" && v.weight > 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Peso: {v.weight}
                    </Text>
                  ) : (
                    <span />
                  )}

                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditVariation(v)}
                    >
                      Editar
                    </Button>
                    <Popconfirm
                      title="¿Eliminar variación?"
                      description="Esta acción no se puede deshacer."
                      okText="Sí, eliminar"
                      cancelText="Cancelar"
                      onConfirm={() => handleDeleteVariation(v.id)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>
                        Eliminar
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal secundario: crear / editar variación */}
      <VariationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        productId={product?.id}
        attributes={attributes}
        variationToEdit={variationToEdit}
        onSaved={handleFormSaved}
      />
    </>
  );
}
