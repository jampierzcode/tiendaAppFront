import React, { useState, useEffect } from "react";
import { Modal, Form, Input, InputNumber, Button, message } from "antd";

import GalleryModal from "./GalleryModal";
import { PlusOutlined } from "@ant-design/icons";
import { apiTienda } from "../../api/apiTienda";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: any; // producto si se está editando
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editData,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    id: number;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (editData) {
      form.setFieldsValue(editData);
      if (editData.businessImages) {
        setSelectedImage({
          id: editData.businessImageId,
          url: editData.businessImages.url,
        });
      }
    } else {
      form.resetFields();
      setSelectedImage(null);
    }
  }, [editData, form]);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      const payload = {
        ...values,
        business_image_id: selectedImage?.id || null,
      };

      if (editData) {
        await apiTienda.put(`/products/${editData.id}`, payload);
        message.success("Producto actualizado correctamente");
      } else {
        await apiTienda.post(`/products`, payload);
        message.success("Producto creado correctamente");
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      message.error("Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        title={editData ? "Editar Producto" : "Nuevo Producto"}
        open={open}
        onCancel={onClose}
        okText={editData ? "Guardar cambios" : "Crear"}
        onOk={() => form.submit()}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="w-full">
              <Form.Item className="w-full" label="Imagen principal">
                {selectedImage ? (
                  <div className="flex flex-col items-start w-full">
                    <img
                      src={selectedImage.url}
                      alt="imagen seleccionada"
                      className="w-full h-50 object-contain rounded border mb-2"
                    />
                    <Button type="link" onClick={() => setGalleryOpen(true)}>
                      Cambiar imagen
                    </Button>
                  </div>
                ) : (
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setGalleryOpen(true)}
                  >
                    Seleccionar imagen
                  </Button>
                )}
              </Form.Item>
            </div>
            <div className="w-full">
              <Form.Item
                label="Precio"
                name="price"
                rules={[{ required: true, message: "Ingrese el precio" }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  addonBefore="S/"
                />
              </Form.Item>

              <Form.Item
                label="Stock"
                name="stock"
                rules={[{ required: true, message: "Ingrese el stock" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </div>
          </div>
          <Form.Item
            label="Nombre"
            name="name"
            rules={[
              { required: true, message: "Ingrese el nombre del producto" },
            ]}
          >
            <Input placeholder="Ej: Camiseta oversize" />
          </Form.Item>

          <Form.Item label="Descripción" name="description">
            <Input.TextArea
              rows={3}
              placeholder="Ej: Camiseta de algodón suave"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Galería */}
      <GalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(img) => setSelectedImage(img)}
      />
    </>
  );
};

export default ProductFormModal;
