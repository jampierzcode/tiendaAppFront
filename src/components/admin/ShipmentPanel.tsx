import { useCallback, useEffect, useState } from "react";
import { AutoComplete, Button, DatePicker, Form, Input, Spin, message } from "antd";
import { TbEdit, TbExternalLink, TbPlus } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";

interface Evento {
  id: number;
  status: string;
  note: string | null;
  happenedAt: string;
}

export interface Envio {
  id: number;
  carrier: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  pickupKey?: string | null;
  agency?: string | null;
  status: string;
  shippedAt: string | null;
  estimatedAt: string | null;
  deliveredAt: string | null;
  events?: Evento[];
}

const etiqueta: Record<string, { texto: string; clase: string }> = {
  preparando: { texto: "Preparando", clase: "bg-warn-bg text-warn" },
  en_transito: { texto: "En tránsito", clase: "bg-info-bg text-info" },
  en_agencia: { texto: "En agencia", clase: "bg-info-bg text-info" },
  entregado: { texto: "Entregado", clase: "bg-ok-bg text-ok" },
  incidencia: { texto: "Incidencia", clase: "bg-danger-bg text-danger" },
  cancelado: { texto: "Cancelado", clase: "bg-line-soft text-muted" },
};

const siguientesCompra: Record<string, { estado: string; texto: string }[]> = {
  preparando: [
    { estado: "en_transito", texto: "Salió" },
    { estado: "cancelado", texto: "Cancelar" },
  ],
  en_transito: [
    { estado: "entregado", texto: "Llegó" },
    { estado: "incidencia", texto: "Reportar problema" },
  ],
  incidencia: [
    { estado: "en_transito", texto: "Sigue en camino" },
    { estado: "entregado", texto: "Llegó" },
    { estado: "cancelado", texto: "Cancelar" },
  ],
};

/** Envíos a compradores: con el paso «llegó a la agencia». */
const siguientesPedido: Record<string, { estado: string; texto: string }[]> = {
  preparando: [
    { estado: "en_transito", texto: "Despachado" },
    { estado: "cancelado", texto: "Cancelar" },
  ],
  en_transito: [
    { estado: "en_agencia", texto: "Llegó a la agencia" },
    { estado: "entregado", texto: "Entregado" },
    { estado: "incidencia", texto: "Reportar problema" },
  ],
  en_agencia: [
    { estado: "entregado", texto: "Ya lo recogió" },
    { estado: "incidencia", texto: "Reportar problema" },
  ],
  incidencia: [
    { estado: "en_transito", texto: "Sigue en camino" },
    { estado: "en_agencia", texto: "Llegó a la agencia" },
    { estado: "entregado", texto: "Entregado" },
    { estado: "cancelado", texto: "Cancelar" },
  ],
};

export const COURIERS = ["Shalom", "Olva Courier", "Marvisur", "Cruz del Sur Cargo", "Motorizado propio"];

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

/**
 * Seguimiento de envíos. En una compra, marcar «Llegó» no suma stock (la
 * mercadería entra al registrar la recepción). En un pedido, cada cambio de
 * estado le llega al comprador por WhatsApp con la guía, la clave y la agencia.
 */
export default function ShipmentPanel({
  purchaseOrderId,
  orderId,
  editable,
  onChange,
  onEnvios,
}: {
  purchaseOrderId?: number;
  orderId?: number;
  editable: boolean;
  onChange?: () => void;
  onEnvios?: (e: Envio[]) => void;
}) {
  const esPedido = Boolean(orderId);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();
  const [formEdit] = Form.useForm();

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/shipments", {
        params: esPedido ? { kind: "pedido", orderId } : { kind: "compra", purchaseOrderId },
      });
      setEnvios(r.data.data ?? []);
      onEnvios?.(r.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar los envíos");
    } finally {
      setCargando(false);
    }
    // onEnvios cambia en cada render del padre; no debe recargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrderId, orderId, esPedido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async (v: any) => {
    setGuardando(true);
    try {
      await apiTienda.post("/shipments", {
        kind: esPedido ? "pedido" : "compra",
        purchaseOrderId,
        orderId,
        carrier: v.carrier,
        trackingCode: v.trackingCode,
        trackingUrl: v.trackingUrl,
        pickupKey: v.pickupKey,
        agency: v.agency,
        estimatedAt: v.estimatedAt ? v.estimatedAt.format("YYYY-MM-DD") : undefined,
      });
      form.resetFields();
      setNuevo(false);
      await cargar();
      onChange?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo registrar el envío");
    } finally {
      setGuardando(false);
    }
  };

  const actualizar = async (id: number, v: any) => {
    setGuardando(true);
    try {
      await apiTienda.put(`/shipments/${id}`, {
        carrier: v.carrier ?? null,
        trackingCode: v.trackingCode ?? null,
        trackingUrl: v.trackingUrl ?? null,
        pickupKey: v.pickupKey ?? null,
        agency: v.agency ?? null,
      });
      setEditando(null);
      await cargar();
      onChange?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = async (id: number, estado: string) => {
    try {
      await apiTienda.post(`/shipments/${id}/status`, { status: estado });
      if (esPedido && ["en_transito", "en_agencia", "incidencia"].includes(estado)) {
        message.success("Estado actualizado. Se le avisa al comprador por WhatsApp.");
      }
      await cargar();
      onChange?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo cambiar el estado");
    }
  };

  if (cargando) return <Spin size="small" />;

  const siguientes = esPedido ? siguientesPedido : siguientesCompra;

  const campos = (
    <>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Form.Item name="carrier" label={esPedido ? "Empresa de envío" : "Transportista"}>
          <AutoComplete
            options={COURIERS.map((c) => ({ value: c }))}
            placeholder={esPedido ? "Shalom, Olva, motorizado…" : "Olva, Shalom, el proveedor…"}
          />
        </Form.Item>
        <Form.Item name="trackingCode" label="Guía o código de envío">
          <Input placeholder="Ej. 12345678" />
        </Form.Item>
      </div>
      {esPedido && (
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item name="pickupKey" label="Clave de recojo" extra="Solo la recibe el comprador por WhatsApp.">
            <Input placeholder="Ej. 4821" maxLength={40} />
          </Form.Item>
          <Form.Item name="agency" label="Agencia de destino">
            <Input placeholder="Shalom Cusco – Av. de la Cultura 123" maxLength={300} />
          </Form.Item>
        </div>
      )}
      <Form.Item name="trackingUrl" label="Enlace de rastreo (opcional)">
        <Input placeholder="https://…" />
      </Form.Item>
    </>
  );

  return (
    <div>
      {envios.length === 0 && <p className="text-[12px] text-muted">Aún no hay envíos registrados.</p>}

      <ul className="space-y-3">
        {envios.map((e) => {
          const est = etiqueta[e.status] ?? etiqueta.preparando;
          return (
            <li key={e.id} className="rounded-lg border border-line-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    {e.carrier || "Envío"} {e.trackingCode && <span className="font-mono">· {e.trackingCode}</span>}
                  </p>
                  {e.agency && <p className="text-[12px] text-ink-soft">📍 {e.agency}</p>}
                  {e.pickupKey && <p className="text-[12px] text-ink-soft">🔑 Clave: {e.pickupKey}</p>}
                  <p className="text-[11px] text-muted">
                    {e.shippedAt && `Salió ${fecha(e.shippedAt)}`}
                    {e.estimatedAt && ` · Estimado ${e.estimatedAt.slice(0, 10)}`}
                    {e.deliveredAt && ` · Llegó ${fecha(e.deliveredAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`pill ${est.clase}`}>{est.texto}</span>
                  {editable && esPedido && !["entregado", "cancelado"].includes(e.status) && (
                    <Button
                      size="small"
                      type="text"
                      icon={<TbEdit />}
                      onClick={() => {
                        formEdit.setFieldsValue(e);
                        setEditando(editando === e.id ? null : e.id);
                      }}
                    />
                  )}
                </div>
              </div>

              {esPedido && !e.trackingCode && e.status === "preparando" && (
                <p className="mt-1 text-[11px] text-warn">
                  Cuando lo despaches, anota la guía y la clave: el comprador las recibe por WhatsApp.
                </p>
              )}

              {editando === e.id && (
                <Form
                  form={formEdit}
                  layout="vertical"
                  size="small"
                  className="mt-3"
                  onFinish={(v) => actualizar(e.id, v)}
                >
                  {campos}
                  <div className="flex gap-2">
                    <Button type="primary" htmlType="submit" loading={guardando} size="small">
                      Guardar
                    </Button>
                    <Button size="small" onClick={() => setEditando(null)}>
                      Cancelar
                    </Button>
                  </div>
                </Form>
              )}

              {e.trackingUrl && (
                <a
                  href={e.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:underline"
                >
                  Rastrear <TbExternalLink />
                </a>
              )}

              {e.events && e.events.length > 0 && (
                <ul className="mt-2 border-l border-line-soft pl-3 text-[11px] text-muted">
                  {e.events.map((ev) => (
                    <li key={ev.id}>
                      {fecha(ev.happenedAt)} · {etiqueta[ev.status]?.texto ?? ev.status}
                      {ev.note ? ` — ${ev.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              {editable && (siguientes[e.status] ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {siguientes[e.status].map((s) => (
                    <Button key={s.estado} size="small" onClick={() => cambiar(e.id, s.estado)}>
                      {s.texto}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editable &&
        (nuevo ? (
          <Form form={form} layout="vertical" size="small" onFinish={crear} className="mt-3">
            {campos}
            <Form.Item name="estimatedAt" label="Llegada estimada">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" loading={guardando} size="small">
                Registrar envío
              </Button>
              <Button size="small" onClick={() => setNuevo(false)}>
                Cancelar
              </Button>
            </div>
          </Form>
        ) : (
          <Button size="small" type="dashed" icon={<TbPlus />} className="mt-3" onClick={() => setNuevo(true)}>
            Agregar envío
          </Button>
        ))}
    </div>
  );
}
