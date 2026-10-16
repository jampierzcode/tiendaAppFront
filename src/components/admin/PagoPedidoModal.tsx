import { useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Select, message } from "antd";
import { apiTienda } from "../../api/apiTienda";
import ComprobanteInput, { type Comprobante } from "../ui/ComprobanteInput";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

interface Props {
  open: boolean;
  pedido: { id: number; code: string } | null;
  saldo: number;
  /** Texto que explica por qué se pide el cobro ahora. */
  motivo?: string;
  onClose: () => void;
  onPagado: () => void;
  /** Si se pasa, aparece «Continuar sin cobrar» (la política deja saltarla a propósito). */
  onSinCobrar?: () => void;
}

/** Cobro rápido: método, monto, código de operación y foto del comprobante (opcional). */
export default function PagoPedidoModal({ open, pedido, saldo, motivo, onClose, onPagado, onSinCobrar }: Props) {
  const [form] = Form.useForm();
  const [guardando, setGuardando] = useState(false);
  const metodo = Form.useWatch("method", form);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ method: "efectivo", amount: saldo, reference: "" });
      setComprobante(null);
    }
  }, [open, saldo, form]);

  const guardar = async (v: any) => {
    if (!pedido) return;
    setGuardando(true);
    try {
      await apiTienda.post(`/orders/${pedido.id}/payments`, {
        method: v.method,
        amount: v.amount,
        reference: v.reference || null,
        receiptKey: comprobante?.key ?? null,
      });
      message.success("Pago registrado");
      onPagado();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Cobrar ${pedido?.code ?? ""}`}
      okText="Registrar pago"
      cancelText="Cancelar"
      confirmLoading={guardando}
      onOk={() => form.submit()}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className="flex items-center justify-between gap-2">
          {onSinCobrar ? (
            <Button type="link" danger onClick={onSinCobrar}>
              Continuar sin cobrar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      )}
    >
      {motivo && <p className="mb-3 text-[13px] text-muted">{motivo}</p>}
      <Form form={form} layout="vertical" onFinish={guardar}>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item name="method" label="Método" rules={[{ required: true }]}>
            <Select options={METODOS} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Monto"
            rules={[{ required: true, message: "Indica el monto" }]}
            extra={`Saldo pendiente: ${saldo.toFixed(2)}`}
          >
            <InputNumber min={0.01} max={saldo} step={0.5} precision={2} className="w-full" />
          </Form.Item>
        </div>
        {metodo && metodo !== "efectivo" && (
          <Form.Item
            name="reference"
            label="Código de operación"
            extra="El número que aparece en el Yape, Plin o la transferencia."
          >
            <Input placeholder="0012345" />
          </Form.Item>
        )}
        <Form.Item label="Foto del comprobante" extra="Opcional. Toma la foto o sube la captura; queda guardada con el pago.">
          <ComprobanteInput value={comprobante} onChange={setComprobante} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
