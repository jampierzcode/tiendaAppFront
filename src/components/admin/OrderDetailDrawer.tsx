import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Tooltip,
  message,
} from "antd";
import { motion } from "motion/react";
import {
  TbBrandWhatsapp,
  TbCash,
  TbCheck,
  TbPackage,
  TbPhoto,
  TbTrash,
  TbTruckDelivery,
  TbX,
  TbArrowBackUp,
} from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import BadgeEstado, { type EstadoPedido } from "../ui/EstadoPedido";
import GalleryModal from "./GalleryModal";

interface ItemPedido {
  id: number;
  productName: string;
  variationLabel: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Pago {
  id: number;
  method: string;
  amount: number;
  reference: string | null;
  note: string | null;
  paidAt: string;
  receipt?: { url: string } | null;
  user?: { name: string } | null;
}

export interface Pedido {
  id: number;
  code: string;
  status: EstadoPedido;
  customerName: string;
  customerPhone: string | null;
  deliveryMethod: string;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  note: string | null;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  paidTotal: number;
  createdAt: string;
  courier: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: ItemPedido[];
  payments?: Pago[];
}

const transiciones: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["pagado", "enviado", "cancelado"],
  pagado: ["enviado", "cancelado"],
  enviado: ["entregado", "devuelto"],
  entregado: ["devuelto"],
  cancelado: [],
  devuelto: [],
};

const iconoAccion: Partial<Record<EstadoPedido, React.ReactNode>> = {
  confirmado: <TbCheck />,
  pagado: <TbCash />,
  enviado: <TbTruckDelivery />,
  entregado: <TbPackage />,
  cancelado: <TbX />,
  devuelto: <TbX />,
};

const metodos = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

/** Los couriers que más usan las tiendas pequeñas en Perú. */
const couriers = [
  "Olva Courier",
  "Shalom",
  "Marvisur",
  "Cruz del Sur Cargo",
  "Motorizado propio",
  "Otro",
];

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

interface Props {
  pedidoId: number | null;
  onCerrar: () => void;
  onCambio: () => void;
}

export default function OrderDetailDrawer({ pedidoId, onCerrar, onCambio }: Props) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [galeria, setGaleria] = useState(false);
  const [comprobante, setComprobante] = useState<{ id: number; url: string } | null>(null);
  const [modalDevolucion, setModalDevolucion] = useState(false);
  const [formDevolucion] = Form.useForm();
  const [formPago] = Form.useForm();
  const [formEnvio] = Form.useForm();

  const cargar = useCallback(async () => {
    if (!pedidoId) return;
    setCargando(true);
    try {
      const r = await apiTienda.get(`/orders/${pedidoId}`);
      setPedido(r.data.data);
      formEnvio.setFieldsValue({
        courier: r.data.data.courier,
        tracking_code: r.data.data.trackingCode,
        tracking_url: r.data.data.trackingUrl,
      });
    } catch {
      message.error("No se pudo cargar el pedido");
    } finally {
      setCargando(false);
    }
  }, [pedidoId, formEnvio]);

  useEffect(() => {
    if (pedidoId) cargar();
    else setPedido(null);
  }, [pedidoId, cargar]);

  const saldo = pedido ? pedido.total - pedido.paidTotal : 0;

  const cambiarEstado = async (nuevo: EstadoPedido) => {
    if (!pedido) return;

    const avisos: Partial<Record<EstadoPedido, string>> = {
      confirmado: `Confirmar ${pedido.code} descontará el stock de ${pedido.items.length} productos.`,
      cancelado: `Cancelar ${pedido.code} repondrá el stock si ya se había descontado.`,
      devuelto: `Devolver ${pedido.code} repondrá el stock al inventario.`,
    };

    if (avisos[nuevo]) {
      const ok = await new Promise<boolean>((resolve) =>
        Modal.confirm({
          title: avisos[nuevo],
          okText: "Sí, continuar",
          cancelText: "Cancelar",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      );
      if (!ok) return;
    }

    setGuardando(true);
    try {
      await apiTienda.put(`/orders/${pedido.id}/status`, { status: nuevo });
      message.success(`Pedido marcado como ${nuevo}`);
      await cargar();
      onCambio();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo cambiar el estado");
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async (valores: any) => {
    if (!pedido) return;
    setGuardando(true);
    try {
      await apiTienda.post(`/orders/${pedido.id}/payments`, {
        method: valores.method,
        amount: valores.amount,
        reference: valores.reference || null,
        note: valores.note || null,
        receiptImageId: comprobante?.id ?? null,
      });
      message.success("Pago registrado");
      setModalPago(false);
      setComprobante(null);
      formPago.resetFields();
      await cargar();
      onCambio();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  };

  const anularPago = (pago: Pago) =>
    Modal.confirm({
      title: "¿Anular este cobro?",
      content: `Se descontarán ${soles(pago.amount)} de lo pagado. Úsalo solo si lo registraste por error.`,
      okText: "Anular",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        await apiTienda.delete(`/payments/${pago.id}`);
        message.success("Cobro anulado");
        await cargar();
        onCambio();
      },
    });

  const registrarDevolucion = async (valores: any) => {
    if (!pedido) return;

    const items = (valores.items ?? [])
      .map((cantidad: number, i: number) => ({
        orderItemId: pedido.items[i].id,
        quantity: Number(cantidad ?? 0),
      }))
      .filter((i: any) => i.quantity > 0);

    if (!items.length) {
      message.warning("Indica cuántas unidades vuelven");
      return;
    }

    setGuardando(true);
    try {
      await apiTienda.post("/returns", {
        orderId: pedido.id,
        items,
        reason: valores.reason || null,
        restocked: valores.restocked !== false,
      });
      message.success("Devolución registrada");
      setModalDevolucion(false);
      formDevolucion.resetFields();
      await cargar();
      onCambio();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo registrar la devolución");
    } finally {
      setGuardando(false);
    }
  };

  const guardarEnvio = async (valores: any) => {
    if (!pedido) return;
    setGuardando(true);
    try {
      await apiTienda.put(`/orders/${pedido.id}/shipping`, valores);
      message.success("Datos de envío guardados");
      await cargar();
      onCambio();
    } catch {
      message.error("No se pudo guardar el envío");
    } finally {
      setGuardando(false);
    }
  };

  const mostrarEnvio =
    pedido &&
    pedido.deliveryMethod !== "recojo" &&
    !["pendiente", "cancelado"].includes(pedido.status);

  return (
    <>
      <Drawer
        open={pedidoId !== null}
        onClose={onCerrar}
        width={560}
        title={
          pedido && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[15px] font-bold">{pedido.code}</span>
              <BadgeEstado estado={pedido.status} />
            </div>
          )
        }
      >
        {cargando || !pedido ? (
          <div className="flex justify-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Cliente */}
            <section>
              <p className="eyebrow mb-2">Cliente</p>
              <p className="font-semibold text-ink">{pedido.customerName}</p>
              {/* Una venta de mostrador no tiene teléfono: el cliente pagó y
                  se fue. Antes se llamaba a .replace() sobre null y la
                  pantalla entera se quedaba en blanco. */}
              {pedido.customerPhone ? (
                <a
                  href={`https://wa.me/${pedido.customerPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-brand-600 hover:underline"
                >
                  <TbBrandWhatsapp className="text-base" />
                  {pedido.customerPhone}
                </a>
              ) : (
                <p className="mt-1 text-[13px] text-muted">Sin teléfono registrado</p>
              )}
              <p className="mt-1.5 text-[13px] text-ink-soft">
                {pedido.deliveryMethod === "recojo"
                  ? "Recojo en tienda"
                  : [pedido.deliveryAddress, pedido.deliveryCity].filter(Boolean).join(", ")}
              </p>
              {pedido.note && (
                <p className="mt-1.5 rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-soft">
                  {pedido.note}
                </p>
              )}
            </section>

            {/* Productos */}
            <section>
              <p className="eyebrow mb-2">Productos</p>
              <ul className="divide-y divide-line-soft">
                {pedido.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{item.productName}</p>
                      {item.variationLabel && (
                        <p className="text-[12px] text-muted">{item.variationLabel}</p>
                      )}
                      <p className="text-[11px] text-muted">
                        {item.quantity} × {soles(item.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold">
                      {soles(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Totales */}
            <section className="rounded-xl bg-canvas p-3.5">
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between text-ink-soft">
                  <dt>Subtotal</dt>
                  <dd>{soles(pedido.subtotal)}</dd>
                </div>
                {pedido.discountTotal > 0 && (
                  <div className="flex justify-between text-ok">
                    <dt>Descuentos</dt>
                    <dd>− {soles(pedido.discountTotal)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-ink-soft">
                  <dt>Envío</dt>
                  <dd>{pedido.shippingCost === 0 ? "Gratis" : soles(pedido.shippingCost)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-bold text-ink">
                  <dt>Total</dt>
                  <dd>{soles(pedido.total)}</dd>
                </div>
                {pedido.paidTotal > 0 && (
                  <div
                    className={`flex justify-between text-[12px] font-medium ${
                      saldo > 0.01 ? "text-warn" : "text-ok"
                    }`}
                  >
                    <dt>{saldo > 0.01 ? `Pagado (debe ${soles(saldo)})` : "Pagado completo"}</dt>
                    <dd>{soles(pedido.paidTotal)}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Pagos */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">Pagos</p>
                {saldo > 0.01 && !["cancelado", "devuelto"].includes(pedido.status) && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<TbCash />}
                    onClick={() => {
                      formPago.setFieldsValue({ amount: saldo, method: "yape" });
                      setModalPago(true);
                    }}
                  >
                    Registrar pago
                  </Button>
                )}
              </div>

              {!pedido.payments?.length ? (
                <p className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-muted">
                  Todavía no se ha cobrado nada de este pedido.
                </p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {pedido.payments.map((pago) => (
                    <li key={pago.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="pill bg-brand-50 text-brand-600">
                            {metodos.find((m) => m.value === pago.method)?.label ?? pago.method}
                          </span>
                          <span className="text-[13px] font-semibold text-ink">
                            {soles(pago.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {fecha(pago.paidAt)}
                          {pago.reference && ` · Op. ${pago.reference}`}
                          {pago.user?.name && ` · ${pago.user.name}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {pago.receipt?.url && (
                          <Tooltip title="Ver comprobante">
                            <a href={pago.receipt.url} target="_blank" rel="noopener noreferrer">
                              <Button size="small" icon={<TbPhoto />} />
                            </a>
                          </Tooltip>
                        )}
                        <Tooltip title="Anular cobro">
                          <Button
                            size="small"
                            danger
                            icon={<TbTrash />}
                            onClick={() => anularPago(pago)}
                          />
                        </Tooltip>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Envío */}
            {mostrarEnvio && (
              <section>
                <p className="eyebrow mb-2">Envío</p>
                <Form form={formEnvio} layout="vertical" onFinish={guardarEnvio} size="small">
                  <div className="grid gap-x-3 sm:grid-cols-2">
                    <Form.Item name="courier" label="Courier">
                      <Select
                        allowClear
                        showSearch
                        placeholder="Elige o escribe"
                        options={couriers.map((c) => ({ value: c, label: c }))}
                      />
                    </Form.Item>
                    <Form.Item name="tracking_code" label="Número de guía">
                      <Input placeholder="OLV-889231" />
                    </Form.Item>
                  </div>
                  <Form.Item name="tracking_url" label="Enlace de seguimiento">
                    <Input placeholder="https://www.olvacourier.com/rastrea" />
                  </Form.Item>
                  <Button htmlType="submit" loading={guardando} size="small">
                    Guardar envío
                  </Button>
                </Form>

                {(pedido.shippedAt || pedido.deliveredAt) && (
                  <p className="mt-2 text-[12px] text-muted">
                    {pedido.shippedAt && `Enviado el ${fecha(pedido.shippedAt)}`}
                    {pedido.deliveredAt && ` · Entregado el ${fecha(pedido.deliveredAt)}`}
                  </p>
                )}
              </section>
            )}

            {/* Acciones */}
            <section className="border-t border-line pt-4">
              <p className="eyebrow mb-2">Siguiente paso</p>
              <div className="flex flex-wrap gap-2">
                {(transiciones[pedido.status] ?? []).map((destino) => (
                  <Button
                    key={destino}
                    type={["cancelado", "devuelto"].includes(destino) ? "default" : "primary"}
                    danger={["cancelado", "devuelto"].includes(destino)}
                    loading={guardando}
                    icon={iconoAccion[destino]}
                    onClick={() => cambiarEstado(destino)}
                  >
                    Marcar {destino}
                  </Button>
                ))}
                {["confirmado", "pagado", "enviado", "entregado"].includes(pedido.status) && (
                  <Button
                    icon={<TbArrowBackUp />}
                    onClick={() => setModalDevolucion(true)}
                  >
                    Registrar devolución
                  </Button>
                )}

                {(transiciones[pedido.status] ?? []).length === 0 &&
                  pedido.status !== "entregado" && (
                    <p className="text-[13px] text-muted">Este pedido ya está cerrado.</p>
                  )}
              </div>
            </section>
          </motion.div>
        )}
      </Drawer>

      {/* Registrar pago */}
      <Modal
        open={modalPago}
        onCancel={() => {
          setModalPago(false);
          setComprobante(null);
        }}
        onOk={() => formPago.submit()}
        confirmLoading={guardando}
        title="Registrar pago"
        okText="Registrar"
        cancelText="Cancelar"
      >
        <Form form={formPago} layout="vertical" onFinish={registrarPago} className="pt-2">
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item
              name="method"
              label="Método"
              rules={[{ required: true, message: "Elige el método" }]}
            >
              <Select options={metodos} />
            </Form.Item>
            <Form.Item
              name="amount"
              label="Monto"
              rules={[{ required: true, message: "Indica el monto" }]}
              extra={`Saldo pendiente: ${soles(saldo)}`}
            >
              <InputNumber
                prefix="S/"
                min={0.01}
                max={saldo}
                step={0.5}
                precision={2}
                className="w-full"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="reference"
            label="Número de operación"
            extra="El código que aparece en el Yape, Plin o la transferencia."
          >
            <Input placeholder="0012345" />
          </Form.Item>

          <Form.Item label="Comprobante">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-canvas">
                {comprobante ? (
                  <img src={comprobante.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[10px] text-muted">
                    Sin foto
                  </div>
                )}
              </div>
              <Button icon={<TbPhoto />} onClick={() => setGaleria(true)}>
                {comprobante ? "Cambiar" : "Subir captura"}
              </Button>
            </div>
          </Form.Item>

          <Form.Item name="note" label="Nota">
            <Input placeholder="Adelanto, resto contra entrega…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Devolución */}
      <Modal
        open={modalDevolucion}
        onCancel={() => setModalDevolucion(false)}
        onOk={() => formDevolucion.submit()}
        confirmLoading={guardando}
        title={`Devolución del pedido ${pedido?.code ?? ""}`}
        okText="Registrar devolución"
        cancelText="Cancelar"
      >
        <Form form={formDevolucion} layout="vertical" onFinish={registrarDevolucion} className="pt-2">
          <p className="mb-3 text-[13px] text-muted">
            Indica cuántas unidades vuelven de cada línea. Puedes devolver solo una parte.
          </p>

          <ul className="mb-4 space-y-2">
            {pedido?.items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-canvas p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{item.productName}</p>
                  <p className="text-[11px] text-muted">
                    {item.variationLabel} · vendidas {item.quantity}
                  </p>
                </div>
                <Form.Item name={["items", i]} className="!mb-0" initialValue={0}>
                  <InputNumber min={0} max={item.quantity} style={{ width: 80 }} />
                </Form.Item>
              </li>
            ))}
          </ul>

          <Form.Item name="reason" label="Motivo">
            <Input placeholder="Talla equivocada, prenda con falla…" />
          </Form.Item>

          <Form.Item name="restocked" label="¿La prenda se puede volver a vender?" initialValue={true}>
            <Select
              options={[
                { value: true, label: "Sí, vuelve al inventario" },
                { value: false, label: "No, se registra como merma" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <GalleryModal
        open={galeria}
        onClose={() => setGaleria(false)}
        onSelect={(img) => setComprobante(img)}
      />
    </>
  );
}
