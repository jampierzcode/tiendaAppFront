import { useEffect } from "react";
import type { User } from "../../types/main";
import { Form, Input, Modal, Select } from "antd";

export function UserFormModal({
  open,
  onCancel,
  onSubmit,
  initialValues,
  loading,
  roleOptions,
  businessOptions,
}: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (v: any) => void;
  initialValues?: Partial<User>;
  loading?: boolean;
  roleOptions?: { value: string; label: string }[];
  businessOptions?: { value: number; label: string }[];
}) {
  const [form] = Form.useForm();
  useEffect(() => {
    form.resetFields();
    if (initialValues)
      form.setFieldsValue({
        fullName: initialValues.name ?? initialValues.full_name,
        email: initialValues.email,
        roleCode: initialValues.role?.code ?? undefined,
        businessId: initialValues.business?.id ?? initialValues.businessId,
        status: initialValues.status,
      });
  }, [initialValues]);

  return (
    <Modal
      open={open}
      title={
        initialValues
          ? `Editar: ${initialValues.name ?? initialValues.email}`
          : "Nuevo usuario"
      }
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="fullName" label="Nombre" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true }, { type: "email" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="roleCode" label="Rol" rules={[{ required: true }]}>
          <Select options={roleOptions} />
        </Form.Item>
        <Form.Item name="businessId" label="Business (opcional)">
          <Select options={businessOptions} allowClear />
        </Form.Item>
        <Form.Item name="password" label="Password (solo nueva)">
          <Input.Password />
        </Form.Item>
        <Form.Item name="status" label="Status">
          <Select
            options={[
              { value: "activo", label: "activo" },
              { value: "inactivo", label: "inactivo" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
