import { useCallback, useEffect, useState } from "react";
import { Button, Drawer, InputNumber, Input, Modal, Select, Spin, message } from "antd";
import { apiTienda } from "../../api/apiTienda";
import ShipmentPanel from "./ShipmentPanel";

interface Linea {
  id: number;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  variation?: {
    product?: { name: string };
    attributes?: { value?: { value: string } }[];
  };
}

interface Detalle {
  id: number;
  code: string;
  status: string;
  supplierId: number;
  documentNumber: string | null;
  expectedAt: string | null;
  total: number;
  supplier?: { name: string };
  items: Linea[];
  receipts: { id: number; code: string; receivedAt: string; note: string | null; items: { quantity: number }[] }[];
}

export const estadoCompra: Record<string, { texto: string; clase: string }> = {
  cotizacion: { texto: "Cotización", clase: "bg-info-bg text-info" },
  borrador: { texto: "Pedida", clase: "bg-warn-bg text-warn" },
  parcial: { texto: "Parcial", clase: "bg-warn-bg text-warn" },
  recibida: { texto: "Recibida", clase: "bg-ok-bg text-ok" },
  cancelada: { texto: "Cancelada", clase: "bg-line-soft text-muted" },
};

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;
const etiquetaLinea = (l: Linea) =>
  `${l.variation?.product?.name ?? "—"} — ${
    (l.variation?.attributes ?? []).map((a) => a.value?.value).filter(Boolean).join(" · ") || "Único"
  }`;

/**
 * Una orden de compra por dentro: lo pedido, lo que ya llegó y lo que falta;
 * registra recepciones parciales y los envíos que las traen.
 */
export default function PurchaseDetailDrawer({
  ordenId,
  proveedores,
  onClose,
  onChanged,
}: {
  ordenId: number | null;
  proveedores: { id: number; name: string; status: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [orden, setOrden] = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [llega, setLlega] = useState<Record<number, number>>({});
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [proveedor, setProveedor] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    if (!ordenId) return;
    setCargando(true);
    try {
      const r = await apiTienda.get(`/purchases/${ordenId}`);
      setOrden(r.data.data);
      setProveedor(r.data.data.supplierId);
      setLlega({});
      setNota("");
    } catch {
      message.error("No se pudo cargar la orden");
    } finally {
      setCargando(false);
    }
  }, [ordenId]);

  useEffect(() => {
    if (ordenId) cargar();
    else setOrden(null);
  }, [ordenId, cargar]);

  const accion = async (fn: () => Promise<any>, ok: string) => {
    setGuardando(true);
    try {
      const r = await fn();
      message.success(ok);
      const revisiones = r?.data?.data?.revisionesDePrecio ?? [];
      if (revisiones.length) {
        Modal.info({
          title: "El costo subió: revisa tus precios",
          content:
            "No cambiamos ningún precio. Tienes una sugerencia pendiente en la parte superior de Compras para decidir si lo ajustas.",
        });
      }
      await cargar();
      onChanged();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo completar");
    } finally {
      setGuardando(false);
    }
  };

  const registrarRecepcion = () => {
    if (!orden) return;
    const items = Object.entries(llega)
      .filter(([, q]) => Number(q) > 0)
      .map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity: Number(quantity) }));
    if (!items.length) {
      message.warning("Escribe cuánto llegó en al menos una línea");
      return;
    }
    accion(() => apiTienda.post(`/purchases/${orden.id}/receipts`, { items, note: nota || undefined }), "Recepción registrada");
  };

  const esVigente = orden && ["borrador", "parcial"].includes(orden.status);
  const sinRecepciones = orden ? (orden.receipts ?? []).length === 0 : false;
  const est = orden ? estadoCompra[orden.status] : null;

  return (
    <Drawer open={!!ordenId} onClose={onClose} width={560} title={orden ? `${orden.code} · ${orden.supplier?.name ?? ""}` : "Compra"}>
      {cargando || !orden ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-2">
            <span className={`pill ${est?.clase}`}>{est?.texto}</span>
            <span className="text-[13px] font-semibold text-ink">{soles(orden.total)}</span>
            {orden.expectedAt && <p className="w-full text-[12px] text-muted">Llegada estimada {orden.expectedAt.slice(0, 10)}</p>}
            {orden.status === "cotizacion" && (
              <p className="w-full rounded-lg bg-info-bg px-3 py-2 text-[12px] text-info">
                Es solo un precio consultado: no suma stock ni cambia costos hasta que la conviertas en pedido.
              </p>
            )}
          </section>

          {["cotizacion", "borrador"].includes(orden.status) && sinRecepciones && (
            <section>
              <p className="eyebrow mb-2">Proveedor</p>
              <div className="flex gap-2">
                <Select
                  className="flex-1"
                  showSearch
                  optionFilterProp="label"
                  value={proveedor}
                  onChange={setProveedor}
                  options={proveedores.filter((p) => p.status === "activo").map((p) => ({ value: p.id, label: p.name }))}
                />
                {orden.status === "borrador" && (
                  <Button
                    disabled={proveedor === orden.supplierId}
                    loading={guardando}
                    onClick={() =>
                      accion(() => apiTienda.put(`/purchases/${orden.id}`, { supplierId: proveedor }), "Proveedor cambiado")
                    }
                  >
                    Cambiar
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted">El historial de costos de cada proveedor se conserva.</p>
            </section>
          )}

          <section>
            <p className="eyebrow mb-2">Mercadería</p>
            <ul className="divide-y divide-line-soft">
              {orden.items.map((l) => {
                const pendiente = l.quantity - l.receivedQuantity;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{etiquetaLinea(l)}</p>
                      <p className="text-[11px] text-muted">
                        Pedido {l.quantity} · Recibido {l.receivedQuantity} · Falta {pendiente} · Costo {soles(l.unitCost)}
                      </p>
                    </div>
                    {esVigente && pendiente > 0 && (
                      <InputNumber
                        min={0}
                        max={pendiente}
                        value={llega[l.id] ?? 0}
                        onChange={(q) => setLlega((p) => ({ ...p, [l.id]: Number(q ?? 0) }))}
                        style={{ width: 80 }}
                        aria-label="Llegó ahora"
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            {esVigente && (
              <div className="mt-3 space-y-2">
                <Input placeholder="Nota de la recepción (guía, observaciones…)" value={nota} onChange={(e) => setNota(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button type="primary" loading={guardando} onClick={registrarRecepcion}>
                    Registrar lo que llegó
                  </Button>
                  <Button
                    loading={guardando}
                    onClick={() =>
                      Modal.confirm({
                        title: "¿Llegó todo lo que falta?",
                        content: "Entrará al inventario todo lo pendiente de esta orden.",
                        okText: "Sí, recibir todo",
                        cancelText: "Volver",
                        onOk: () => accion(() => apiTienda.post(`/purchases/${orden.id}/receive`), "Orden recibida"),
                      })
                    }
                  >
                    Recibir todo lo pendiente
                  </Button>
                </div>
                <p className="text-[11px] text-muted">El stock sube solo con lo que escribas arriba, cuando ya llegó físicamente.</p>
              </div>
            )}
          </section>

          {orden.receipts.length > 0 && (
            <section>
              <p className="eyebrow mb-2">Recepciones</p>
              <ul className="space-y-1 text-[12px] text-ink-soft">
                {orden.receipts.map((r) => (
                  <li key={r.id}>
                    <span className="font-mono">{r.code}</span> · {new Date(r.receivedAt).toLocaleDateString("es-PE")} ·{" "}
                    {r.items.reduce((t, i) => t + i.quantity, 0)} uds{r.note ? ` — ${r.note}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {orden.status !== "cotizacion" && orden.status !== "cancelada" && (
            <section>
              <p className="eyebrow mb-2">Envíos</p>
              <ShipmentPanel purchaseOrderId={orden.id} editable={!!esVigente} onChange={onChanged} />
            </section>
          )}

          <section className="flex flex-wrap gap-2 border-t border-line pt-4">
            {orden.status === "cotizacion" && (
              <Button
                type="primary"
                loading={guardando}
                onClick={() =>
                  accion(
                    () => apiTienda.post(`/purchases/${orden.id}/confirm`, { supplierId: proveedor }),
                    "Convertida en pedido"
                  )
                }
              >
                Convertir en pedido
              </Button>
            )}
            {orden.status === "parcial" && (
              <Button
                loading={guardando}
                onClick={() =>
                  Modal.confirm({
                    title: "¿Cerrar la orden?",
                    content: "Lo que no llegó dejará de esperarse y de contarse como stock por llegar.",
                    okText: "Cerrar orden",
                    cancelText: "Volver",
                    onOk: () => accion(() => apiTienda.post(`/purchases/${orden.id}/close`), "Orden cerrada"),
                  })
                }
              >
                Cerrar lo pendiente
              </Button>
            )}
            {["cotizacion", "borrador"].includes(orden.status) && (
              <Button
                danger
                loading={guardando}
                onClick={() => accion(() => apiTienda.post(`/purchases/${orden.id}/cancel`), "Cancelada")}
              >
                Cancelar
              </Button>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
