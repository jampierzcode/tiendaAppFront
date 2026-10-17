import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, Spin, message } from "antd";
import { TbExternalLink, TbPlus } from "react-icons/tb";
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
  status: string;
  shippedAt: string | null;
  estimatedAt: string | null;
  deliveredAt: string | null;
  events?: Evento[];
}

const etiqueta: Record<string, { texto: string; clase: string }> = {
  preparando: { texto: "Preparando", clase: "bg-warn-bg text-warn" },
  en_transito: { texto: "En tránsito", clase: "bg-info-bg text-info" },
  entregado: { texto: "Entregado", clase: "bg-ok-bg text-ok" },
  incidencia: { texto: "Incidencia", clase: "bg-danger-bg text-danger" },
  cancelado: { texto: "Cancelado", clase: "bg-line-soft text-muted" },
};

const siguientes: Record<string, { estado: string; texto: string }[]> = {
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

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

/**
 * Seguimiento de los envíos de una compra. Marcar uno como «Llegó» no suma
 * stock: la mercadería entra cuando registras la recepción.
 */
export default function ShipmentPanel({
  purchaseOrderId,
  editable,
  onChange,
}: {
  purchaseOrderId: number;
  editable: boolean;
  onChange?: () => void;
}) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/shipments", { params: { kind: "compra", purchaseOrderId } });
      setEnvios(r.data.data ?? []);
    } catch {
      message.error("No se pudieron cargar los envíos");
    } finally {
      setCargando(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async (v: any) => {
    setGuardando(true);
    try {
      await apiTienda.post("/shipments", {
        kind: "compra",
        purchaseOrderId,
        carrier: v.carrier,
        trackingCode: v.trackingCode,
        trackingUrl: v.trackingUrl,
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

  const cambiar = async (id: number, estado: string) => {
    try {
      await apiTienda.post(`/shipments/${id}/status`, { status: estado });
      await cargar();
      onChange?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo cambiar el estado");
    }
  };

  if (cargando) return <Spin size="small" />;

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
                  <p className="text-[11px] text-muted">
                    {e.shippedAt && `Salió ${fecha(e.shippedAt)}`}
                    {e.estimatedAt && ` · Estimado ${e.estimatedAt.slice(0, 10)}`}
                    {e.deliveredAt && ` · Llegó ${fecha(e.deliveredAt)}`}
                  </p>
                </div>
                <span className={`pill ${est.clase}`}>{est.texto}</span>
              </div>

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
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Form.Item name="carrier" label="Transportista">
                <Input placeholder="Olva, Shalom, el proveedor…" />
              </Form.Item>
              <Form.Item name="trackingCode" label="Guía o código">
                <Input />
              </Form.Item>
            </div>
            <Form.Item name="trackingUrl" label="Enlace de rastreo">
              <Input placeholder="https://…" />
            </Form.Item>
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
