import { Form, Input, Modal, Select, Upload, message } from "antd";
import { useEffect, useState } from "react";
import { PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import type { Business } from "../../types/main";
import axios from "axios";
import { apiTienda } from "../../api/apiTienda";

export function BusinessFormModal({
  open,
  onCancel,
  onSubmit,
  initialValues,
  loading,
}: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (v: any) => void;
  initialValues?: Partial<Business>;
  loading?: boolean;
}) {
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [admins, setAdmins] = useState<{ label: string; value: number }[]>([]);

  useEffect(() => {
    form.resetFields();
    if (initialValues) {
      form.setFieldsValue(initialValues);
      setLogoUrl(initialValues.logo_url ?? null);
    }
  }, [initialValues, form]);

  // Cargar usuarios admin
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await apiTienda.get("/users", {
          params: { role: "admin" },
        });
        const opts = res.data.data.map((u: any) => ({
          label: u.name ?? `Admin #${u.id}`,
          value: u.id,
        }));
        setAdmins(opts);
      } catch (err) {
        console.error(err);
        message.error("No se pudieron cargar los usuarios admin");
      }
    };
    fetchAdmins();
  }, []);

  // Subida de imagen a API multimedia
  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("folder", "business_logos");
    formData.append("files[]", file);

    try {
      const res = await axios.post(
        "http://localhost:8080/apienviosmultimedia/index.php",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (res.data.success && res.data.files?.length > 0) {
        const url = res.data.files[0].url;
        setLogoUrl(url);
        form.setFieldValue("logo_url", url);
        message.success("Logo subido correctamente");
      } else {
        message.error("Error al subir el logo");
      }
    } catch (err) {
      console.error(err);
      message.error("Error al subir el logo");
    } finally {
      setUploading(false);
    }
  };

  // Configuración del Upload de Ant Design
  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Subir</div>
    </div>
  );

  return (
    <Modal
      open={open}
      title={initialValues ? `Editar: ${initialValues.name}` : "Nuevo Business"}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={initialValues}
      >
        {/* Nombre */}
        <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        {/* Descripción */}
        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={3} />
        </Form.Item>

        {/* Logo circular */}
        <Form.Item label="Logo" name="logo_url" valuePropName="fileList">
          <div className="flex flex-col items-center">
            <Upload
              name="logo"
              listType="picture-circle"
              showUploadList={false}
              beforeUpload={(file) => {
                handleUpload(file);
                return false; // Evita subida automática
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="logo"
                  style={{
                    width: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                uploadButton
              )}
            </Upload>
          </div>
        </Form.Item>

        {/* Usuario admin */}
        <Form.Item
          name="user_id"
          label="Usuario (Admin)"
          rules={[{ required: true }]}
        >
          <Select
            placeholder="Selecciona un usuario admin"
            options={admins}
            loading={!admins.length}
          />
        </Form.Item>

        {/* Estado */}
        <Form.Item name="status" label="Estado" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "activo", label: "Activo" },
              { value: "inactivo", label: "Inactivo" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
