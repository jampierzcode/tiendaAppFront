import { useCallback, useEffect, useState } from "react";
import { Button, Image, Input, InputNumber, Modal, Select, Spin, Tag, message } from "antd";
import { TbCheck, TbX } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";

export interface Comprobante {
  id: number;
  orderId: number | null;
  phone: string | null;
  imageUrl: string;
  amount: number | null;
  method: string | null;
  operationCode: string | null;
  paidAtText: string | null;
  payerName: string | null;
  aiNote: string | null;
  status: "por_validar" | "validado" | "rechazado";
  rejectReason: string | null;
  createdAt: string;
  order?: { id: number; code: string; customerName: string; total: number; paidTotal: number } | null;
}

const METODOS = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

const MOTIVOS = [
  "El monto no coincide",
  "No vemos el abono en nuestra cuenta",
  "La imagen no se lee bien",
  "El pago fue a otra cuenta",
  "Comprobante repetido",
];

const ESTADO: Record<Comprobante["status"], { texto: string; color: string }> = {
  por_validar: { texto: "Por validar", color: "orange" },
  validado: { texto: "Validado", color: "green" },
  rechazado: { texto: "Rechazado", color: "red" },
};

const soles = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `S/ ${Number(v).toFixed(2)}`);

/**
 * Comprobantes que el comprador mandó por WhatsApp (el vendedor IA los guarda
 * con lo que leyó). Validar registra el cobro con la foto; rechazar le avisa
 * al comprador el motivo. Con `orderId` muestra solo los de ese pedido.
 */
export default function PaymentProofs({
  orderId,
  onChange,
  onAbrirPedido,
}: {
  orderId?: number;
  onChange?: () => void;
  onAbrirPedido?: (id: number) => void;
}) {
  const [lista, setLista] = useState<Comprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [validando, setValidando] = useState<Comprobante | null>(null);
  const [rechazando, setRechazando] = useState<Comprobante | null>(null);
  const [form, setForm] = useState({ amount: 0, method: "yape", reference: "", orderCode: "" });
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/payment-proofs", {
        params: orderId ? { orderId, status: "todos" } : { status: "por_validar" },
      });
      setLista(r.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar los comprobantes");
    } finally {
      setCargando(false);
    }
  }, [orderId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const validar = async () => {
    if (!validando) return;
    setGuardando(true);
    try {
      let pedidoId = validando.orderId;
      if (!pedidoId) {
        const r = await apiTienda.get("/orders", { params: { search: form.orderCode.trim() } });
        const encontrado = (r.data.data ?? []).find(
          (o: any) => String(o.code).toUpperCase() === form.orderCode.trim().toUpperCase()
        );
        if (!encontrado) {
          message.warning("No encontramos un pedido con ese código");
          setGuardando(false);
          return;
        }
        pedidoId = encontrado.id;
      }
      await apiTienda.post(`/payment-proofs/${validando.id}/validate`, {
        amount: form.amount,
        method: form.method,
        reference: form.reference || null,
        orderId: pedidoId,
      });
      message.success("Pago validado. Se le avisa al comprador por WhatsApp.");
      setValidando(null);
      await cargar();
      onChange?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo validar");
    } finally {
      setGuardando(false);
    }
  };

  const rechazar = async () => {
    if (!rechazando) return;
    setGuardando(true);
    try {
      await apiTienda.post(`/payment-proofs/${rechazando.id}/reject`, { reason: motivo });
      message.success("Comprobante rechazado. Se le avisa al comprador.");
      setRechazando(null);
      setMotivo("");
      await cargar();
      onChange?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo rechazar");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Spin size="small" />;
  if (!lista.length) {
    return orderId ? null : <p className="text-[13px] text-muted">No hay comprobantes por validar. 🎉</p>;
  }

  return (
    <>
      <ul className="space-y-3">
        {lista.map((c) => {
          const saldo = c.order ? Number(c.order.total) - Number(c.order.paidTotal) : null;
          const noCuadra = c.amount !== null && saldo !== null && Math.abs(c.amount - saldo) > 0.02;
          return (
            <li key={c.id} className="flex gap-3 rounded-lg border border-line-soft p-3">
              <Image
                src={c.imageUrl}
                width={72}
                height={96}
                className="rounded-md object-cover"
                style={{ objectFit: "cover" }}
              />
              <div className="min-w-0 flex-1 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{soles(c.amount)}</span>
                  {c.method && <Tag>{METODOS.find((m) => m.value === c.method)?.label ?? c.method}</Tag>}
                  <Tag color={ESTADO[c.status].color}>{ESTADO[c.status].texto}</Tag>
                </div>
                <p className="text-[12px] text-ink-soft">
                  {c.operationCode && `Op. ${c.operationCode} · `}
                  {c.paidAtText && `${c.paidAtText} · `}
                  {c.payerName}
                </p>
                {!orderId && (
                  <p className="text-[12px] text-ink-soft">
                    {c.order ? (
                      <button className="font-semibold text-brand-600" onClick={() => onAbrirPedido?.(c.order!.id)}>
                        Pedido {c.order.code} · {c.order.customerName}
                      </button>
                    ) : (
                      <span className="text-warn">Sin pedido · {c.phone}</span>
                    )}
                  </p>
                )}
                {c.status === "por_validar" && saldo !== null && (
                  <p className={`text-[12px] ${noCuadra ? "text-warn" : "text-ok"}`}>
                    Saldo del pedido: {soles(saldo)}
                    {noCuadra ? " · el monto no coincide (¿adelanto?)" : " · coincide"}
                  </p>
                )}
                {c.aiNote && <p className="text-[12px] italic text-muted">IA: {c.aiNote}</p>}
                {c.rejectReason && <p className="text-[12px] text-danger">Motivo: {c.rejectReason}</p>}
                {c.status === "por_validar" && (
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="small"
                      type="primary"
                      icon={<TbCheck />}
                      onClick={() => {
                        setForm({
                          amount: c.amount ?? saldo ?? 0,
                          method: c.method ?? "yape",
                          reference: c.operationCode ?? "",
                          orderCode: "",
                        });
                        setValidando(c);
                      }}
                    >
                      Validar pago
                    </Button>
                    <Button size="small" danger icon={<TbX />} onClick={() => setRechazando(c)}>
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={Boolean(validando)}
        title="Validar pago"
        okText="Validar y registrar cobro"
        cancelText="Cancelar"
        confirmLoading={guardando}
        onOk={validar}
        onCancel={() => setValidando(null)}
      >
        <p className="mb-3 text-[13px] text-ink-soft">
          Revisa en tu Yape o banco que el dinero llegó. Al validar se registra el cobro en el pedido con esta
          foto como comprobante.
        </p>
        <div className="space-y-3">
          {validando && !validando.orderId && (
            <div>
              <label className="text-[12px] font-semibold">Código del pedido</label>
              <Input
                value={form.orderCode}
                onChange={(e) => setForm({ ...form, orderCode: e.target.value })}
                placeholder="Ej. PED-0012"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold">Monto recibido</label>
              <InputNumber
                className="w-full"
                min={0}
                addonBefore="S/"
                value={form.amount}
                onChange={(v) => setForm({ ...form, amount: Number(v ?? 0) })}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold">Método</label>
              <Select
                className="w-full"
                options={METODOS}
                value={form.method}
                onChange={(v) => setForm({ ...form, method: v })}
              />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold">N.° de operación</label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(rechazando)}
        title="Rechazar comprobante"
        okText="Rechazar"
        okButtonProps={{ danger: true, disabled: !motivo.trim() }}
        cancelText="Cancelar"
        confirmLoading={guardando}
        onOk={rechazar}
        onCancel={() => setRechazando(null)}
      >
        <p className="mb-2 text-[13px] text-ink-soft">Se le enviará el motivo al comprador por WhatsApp.</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {MOTIVOS.map((m) => (
            <Tag.CheckableTag key={m} checked={motivo === m} onChange={() => setMotivo(m)}>
              {m}
            </Tag.CheckableTag>
          ))}
        </div>
        <Input.TextArea
          rows={2}
          maxLength={255}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Escribe el motivo"
        />
      </Modal>
    </>
  );
}
