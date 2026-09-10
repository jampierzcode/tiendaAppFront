import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, InputNumber, Modal, Select, Spin, message } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { TbCash, TbPrinter, TbSearch, TbShoppingCart, TbTrash, TbX } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import TicketPrint, { type DatosTicket } from "../../components/admin/TicketPrint";

interface VariacionPos {
  id: number;
  sku: string | null;
  stock: number;
  price: number;
  isDefault: boolean;
  label: string;
}

interface ProductoPos {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  imageUrl: string | null;
  variations: VariacionPos[];
}

interface LineaCaja {
  variationId: number;
  nombre: string;
  etiqueta: string;
  precio: number;
  stock: number;
  cantidad: number;
}

const metodos = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
];

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;

export default function PosPage() {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<ProductoPos[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [carrito, setCarrito] = useState<LineaCaja[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState<number | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const buscadorRef = useRef<any>(null);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    try {
      const r = await apiTienda.get("/pos/search", { params: { q } });
      setResultados(r.data.data ?? []);
    } catch {
      message.error("No se pudo buscar");
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscar(termino), 280);
    return () => clearTimeout(t);
  }, [termino, buscar]);

  // El foco vuelve al buscador tras cada acción: en caja se trabaja con el
  // lector de códigos y las manos no van al ratón.
  useEffect(() => {
    buscadorRef.current?.focus();
  }, [carrito.length]);

  const agregar = (p: ProductoPos, v: VariacionPos) => {
    setCarrito((actual) => {
      const existe = actual.find((l) => l.variationId === v.id);
      if (existe) {
        if (existe.cantidad >= v.stock) {
          message.warning(`Solo quedan ${v.stock} de ${p.name}`);
          return actual;
        }
        return actual.map((l) =>
          l.variationId === v.id ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [
        ...actual,
        {
          variationId: v.id,
          nombre: p.name,
          etiqueta: v.label,
          precio: v.price,
          stock: v.stock,
          cantidad: 1,
        },
      ];
    });
    setTermino("");
  };

  const cambiar = (variationId: number, cantidad: number) =>
    setCarrito((actual) =>
      actual
        .map((l) =>
          l.variationId === variationId
            ? { ...l, cantidad: Math.max(0, Math.min(cantidad, l.stock)) }
            : l
        )
        .filter((l) => l.cantidad > 0)
    );

  const { subtotal, rebaja, total } = useMemo(() => {
    const sub = carrito.reduce((t, l) => t + l.precio * l.cantidad, 0);
    const r = (sub * descuento) / 100;
    return {
      subtotal: sub,
      rebaja: r,
      total: Math.round((sub - r + Number.EPSILON) * 100) / 100,
    };
  }, [carrito, descuento]);

  const vuelto = recibido !== null ? Math.max(0, recibido - total) : 0;
  const faltante = recibido !== null ? Math.max(0, total - recibido) : 0;

  const cobrar = async () => {
    if (!carrito.length) return;

    // En efectivo se pide lo recibido para calcular el vuelto; en los demás
    // métodos se asume el monto exacto.
    const montoPago = metodo === "efectivo" && recibido !== null ? recibido : total;

    if (metodo === "efectivo" && montoPago < total) {
      message.warning(`Faltan ${soles(total - montoPago)}`);
      return;
    }

    setCobrando(true);
    try {
      const r = await apiTienda.post("/pos/sell", {
        items: carrito.map((l) => ({ variationId: l.variationId, quantity: l.cantidad })),
        payments: [{ method: metodo, amount: montoPago }],
        discountPercentage: descuento,
      });

      const orderId = r.data.data.order.id;
      const t = await apiTienda.get(`/pos/ticket/${orderId}`);
      setTicket(t.data.data);

      message.success(`Venta ${r.data.data.order.code} registrada`);
      setCarrito([]);
      setDescuento(0);
      setRecibido(null);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo cerrar la venta");
    } finally {
      setCobrando(false);
    }
  };

  return (
    <>
      <PageHeader
        titulo="Mostrador"
        descripcion="Venta en caja. El stock baja al instante y comparte inventario con la tienda online."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Búsqueda y resultados */}
        <div className="card flex flex-col overflow-hidden">
          <div className="border-b border-line-soft p-4">
            <Input
              ref={buscadorRef}
              size="large"
              autoFocus
              prefix={<TbSearch className="text-muted" />}
              placeholder="Busca por nombre o código…"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              allowClear
            />
          </div>

          <div className="min-h-[420px] flex-1 p-4">
            {buscando ? (
              <div className="flex justify-center py-16">
                <Spin size="large" />
              </div>
            ) : termino.trim().length < 2 ? (
              <div className="grid place-items-center py-20 text-center">
                <TbShoppingCart className="text-4xl text-line" />
                <p className="mt-3 max-w-xs text-[13px] text-muted">
                  Escribe el nombre o el código del producto para empezar la venta.
                </p>
              </div>
            ) : resultados.length === 0 ? (
              <Empty
                className="py-16"
                description="Nada con ese nombre, o está agotado"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <ul className="space-y-3">
                {resultados.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-canvas">
                        {p.imageUrl && (
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                        <p className="font-mono text-[11px] text-muted">{p.sku ?? "—"}</p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold">{soles(p.price)}</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {p.variations.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => agregar(p, v)}
                          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                        >
                          {v.label || "Único"}
                          <span className="ml-1.5 text-[11px] text-muted">({v.stock})</span>
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Caja */}
        <div className="card flex h-fit flex-col lg:sticky lg:top-20">
          <div className="flex items-center justify-between border-b border-line-soft p-4">
            <p className="text-[15px] font-bold text-ink">Venta actual</p>
            {carrito.length > 0 && (
              <Button size="small" type="text" danger onClick={() => setCarrito([])}>
                Vaciar
              </Button>
            )}
          </div>

          <div className="max-h-[320px] min-h-[120px] overflow-y-auto p-3">
            {carrito.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted">
                Sin productos todavía.
              </p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {carrito.map((l) => (
                    <motion.li
                      key={l.variationId}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start gap-2 rounded-lg bg-canvas p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{l.nombre}</p>
                        {l.etiqueta && (
                          <p className="text-[11px] text-muted">{l.etiqueta}</p>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex items-center rounded-md border border-line bg-white">
                            <button
                              onClick={() => cambiar(l.variationId, l.cantidad - 1)}
                              className="px-2 py-0.5 text-ink-soft hover:bg-canvas"
                              aria-label="Quitar uno"
                            >
                              −
                            </button>
                            <span className="tabular w-7 text-center text-[13px]">
                              {l.cantidad}
                            </span>
                            <button
                              onClick={() => cambiar(l.variationId, l.cantidad + 1)}
                              disabled={l.cantidad >= l.stock}
                              className="px-2 py-0.5 text-ink-soft hover:bg-canvas disabled:opacity-30"
                              aria-label="Agregar uno"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[11px] text-muted">× {soles(l.precio)}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[13px] font-semibold">
                          {soles(l.precio * l.cantidad)}
                        </span>
                        <button
                          onClick={() => cambiar(l.variationId, 0)}
                          aria-label={`Quitar ${l.nombre}`}
                          className="text-muted hover:text-danger"
                        >
                          <TbTrash className="text-sm" />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          {carrito.length > 0 && (
            <div className="border-t border-line-soft p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor="descuento" className="text-[13px] text-ink-soft">
                  Descuento
                </label>
                <InputNumber
                  id="descuento"
                  size="small"
                  min={0}
                  max={90}
                  value={descuento}
                  onChange={(v) => setDescuento(Number(v ?? 0))}
                  suffix="%"
                  style={{ width: 90 }}
                />
              </div>

              <dl className="mb-3 space-y-1 text-[13px]">
                <div className="flex justify-between text-ink-soft">
                  <dt>Subtotal</dt>
                  <dd className="tabular">{soles(subtotal)}</dd>
                </div>
                {rebaja > 0 && (
                  <div className="flex justify-between text-ok">
                    <dt>Descuento</dt>
                    <dd className="tabular">− {soles(rebaja)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-1.5 text-[18px] font-extrabold text-ink">
                  <dt>Total</dt>
                  <dd className="tabular">{soles(total)}</dd>
                </div>
              </dl>

              <div className="mb-3 space-y-2">
                <Select
                  value={metodo}
                  onChange={(v) => {
                    setMetodo(v);
                    setRecibido(null);
                  }}
                  options={metodos}
                  className="w-full"
                />

                {metodo === "efectivo" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="overflow-hidden"
                  >
                    <InputNumber
                      prefix="S/"
                      placeholder="¿Con cuánto paga?"
                      min={0}
                      step={5}
                      value={recibido}
                      onChange={(v) => setRecibido(v === null ? null : Number(v))}
                      className="w-full"
                    />
                    {recibido !== null && (
                      <p
                        className={`mt-1.5 text-center text-[15px] font-bold ${
                          faltante > 0 ? "text-danger" : "text-ok"
                        }`}
                      >
                        {faltante > 0
                          ? `Faltan ${soles(faltante)}`
                          : `Vuelto ${soles(vuelto)}`}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<TbCash />}
                loading={cobrando}
                disabled={metodo === "efectivo" && recibido !== null && faltante > 0}
                onClick={cobrar}
                className="!h-12 !text-[15px] !font-bold"
              >
                Cobrar {soles(total)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Ticket recién emitido */}
      <Modal
        open={ticket !== null}
        onCancel={() => setTicket(null)}
        footer={null}
        width={360}
        closeIcon={<TbX />}
      >
        {ticket && (
          <>
            <TicketPrint datos={ticket} />
            <div className="mt-4 flex gap-2 print:hidden">
              <Button block onClick={() => setTicket(null)}>
                Cerrar
              </Button>
              <Button
                type="primary"
                block
                icon={<TbPrinter />}
                onClick={() => window.print()}
              >
                Imprimir
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
