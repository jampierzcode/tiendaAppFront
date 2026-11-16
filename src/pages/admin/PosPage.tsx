import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, InputNumber, Modal, Select, Spin, message } from "antd";
import { AnimatePresence, motion } from "motion/react";
import {
  TbCash,
  TbChevronDown,
  TbDiscount,
  TbPhoto,
  TbPrinter,
  TbSearch,
  TbTrash,
  TbX,
} from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import GalleryModal from "../../components/admin/GalleryModal";
import PageHeader from "../../components/ui/PageHeader";
import TicketPrint, { type DatosTicket } from "../../components/admin/TicketPrint";

interface VariacionPos {
  id: number;
  sku: string | null;
  stock: number;
  price: number;
  originalPrice: number | null;
  isDefault: boolean;
  label: string;
}

interface ProductoPos {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  originalPrice: number | null;
  desde: boolean;
  promo: boolean;
  promoLabels: string[];
  unlimitedStock: boolean;
  stock: number;
  imageUrl: string | null;
  variations: VariacionPos[];
}

interface Categoria {
  id: number;
  name: string;
  isActive?: boolean;
  subcategories?: { id: number; name: string }[];
}

const POR_PAGINA = 24;

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
  const [referencia, setReferencia] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [comprobante, setComprobante] = useState<{ id: number; url: string } | null>(null);
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);
  const [detallesAbiertos, setDetallesAbiertos] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const buscadorRef = useRef<any>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoria, setCategoria] = useState<number | null>(null);
  const [subcategoria, setSubcategoria] = useState<number | null>(null);
  const [soloPromo, setSoloPromo] = useState(false);
  const [promoId, setPromoId] = useState<number | null>(null);
  const [promociones, setPromociones] = useState<{ id: number; name: string; label: string }[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const [eligiendo, setEligiendo] = useState<ProductoPos | null>(null);

  useEffect(() => {
    apiTienda
      .get("/categories")
      .then((r) => setCategorias((r.data.data ?? []).filter((c: Categoria) => c.isActive !== false)))
      .catch(() => undefined);
  }, []);

  // Todo el catálogo vendible, filtrado; «Cargar más» suma la página siguiente.
  const buscar = useCallback(
    async (q: string, pag: number) => {
      setBuscando(true);
      try {
        const r = await apiTienda.get("/pos/search", {
          params: {
            q: q.trim() || undefined,
            categoryId: categoria ?? undefined,
            subcategoryId: subcategoria ?? undefined,
            promo: soloPromo ? 1 : undefined,
            promoId: promoId ?? undefined,
            page: pag,
            perPage: POR_PAGINA,
          },
        });
        const lista: ProductoPos[] = r.data.data ?? [];
        setResultados((actual) => (pag === 1 ? lista : [...actual, ...lista]));
        setTotalCatalogo(Number(r.data.meta?.total ?? lista.length));
        setPromociones(r.data.meta?.promociones ?? []);
        setPagina(pag);
      } catch {
        message.error("No se pudo cargar el catálogo");
      } finally {
        setBuscando(false);
      }
    },
    [categoria, subcategoria, soloPromo, promoId]
  );

  useEffect(() => {
    const t = setTimeout(() => buscar(termino, 1), termino ? 280 : 0);
    return () => clearTimeout(t);
  }, [termino, buscar]);

  const subcategorias = categorias.find((c) => c.id === categoria)?.subcategories ?? [];

  /** Un clic: si tiene una sola variación entra directo; si no, se elige talla/color. */
  const tocar = (p: ProductoPos) => {
    if (p.variations.length === 1) agregar(p, p.variations[0]);
    else setEligiendo(p);
  };

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
    setEligiendo(null);
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
        payments: [
          {
            method: metodo,
            amount: montoPago,
            reference: referencia.trim() || null,
            note: notaPago.trim() || null,
            receiptImageId: comprobante?.id ?? null,
          },
        ],
        discountPercentage: descuento,
      });

      const orderId = r.data.data.order.id;
      const t = await apiTienda.get(`/pos/ticket/${orderId}`);
      setTicket(t.data.data);

      message.success(`Venta ${r.data.data.order.code} registrada`);
      setCarrito([]);
      setDescuento(0);
      setRecibido(null);
      setReferencia("");
      setNotaPago("");
      setComprobante(null);
      setDetallesAbiertos(false);
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
        {/* Catálogo */}
        <div className="card flex flex-col overflow-hidden">
          <div className="space-y-3 border-b border-line-soft p-4">
            <Input
              ref={buscadorRef}
              size="large"
              autoFocus
              prefix={<TbSearch className="text-muted" />}
              placeholder="Busca por nombre o código (o usa el lector)…"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              onPressEnter={() => {
                // Lector de códigos: un solo resultado con una sola variación entra al carrito.
                if (resultados.length === 1 && resultados[0].variations.length === 1) {
                  agregar(resultados[0], resultados[0].variations[0]);
                  setTermino("");
                }
              }}
              allowClear
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setCategoria(null);
                  setSubcategoria(null);
                }}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                  categoria === null ? "border-brand-500 bg-brand-600 text-white" : "border-line text-ink-soft hover:border-brand-300"
                }`}
              >
                Todo
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategoria(c.id === categoria ? null : c.id);
                    setSubcategoria(null);
                  }}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                    categoria === c.id ? "border-brand-500 bg-brand-600 text-white" : "border-line text-ink-soft hover:border-brand-300"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {promociones.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger">
                  <TbDiscount /> Promociones:
                </span>
                <button
                  onClick={() => {
                    setSoloPromo((v) => !v);
                    setPromoId(null);
                  }}
                  className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                    soloPromo && !promoId ? "border-danger bg-danger text-white" : "border-danger/40 text-danger hover:bg-danger-bg"
                  }`}
                >
                  Todas ({promociones.length})
                </button>
                {promociones.map((pr) => (
                  <button
                    key={pr.id}
                    onClick={() => {
                      setPromoId(promoId === pr.id ? null : pr.id);
                      setSoloPromo(false);
                    }}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                      promoId === pr.id ? "border-danger bg-danger text-white" : "border-danger/30 text-ink-soft hover:bg-danger-bg"
                    }`}
                  >
                    {pr.name} <b className={promoId === pr.id ? "" : "text-danger"}>{pr.label}</b>
                  </button>
                ))}
              </div>
            )}
            {subcategorias.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {subcategorias.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setSubcategoria(sc.id === subcategoria ? null : sc.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11.5px] transition ${
                      subcategoria === sc.id ? "bg-brand-100 font-semibold text-brand-700" : "bg-canvas text-ink-soft hover:bg-brand-50"
                    }`}
                  >
                    {sc.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-[420px] flex-1 p-4">
            {buscando && pagina === 1 && resultados.length === 0 ? (
              <div className="flex justify-center py-16">
                <Spin size="large" />
              </div>
            ) : resultados.length === 0 ? (
              <Empty
                className="py-16"
                description={
                  termino || categoria || soloPromo || promoId
                    ? "Nada con ese filtro, o está agotado"
                    : "No hay productos con stock para vender"
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <>
                <p className="mb-3 text-[12px] text-muted">
                  {totalCatalogo} producto{totalCatalogo === 1 ? "" : "s"} · toca uno para agregarlo
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {resultados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => tocar(p)}
                      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white text-left transition hover:border-brand-400 hover:shadow-md"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-canvas">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center text-3xl text-line">
                            <TbPhoto />
                          </div>
                        )}
                        {p.promo && (
                          <span className="absolute left-1.5 top-1.5 rounded-md bg-danger px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                            {p.promoLabels[0] ?? "Promo"}
                          </span>
                        )}
                        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
                          {p.unlimitedStock ? "∞" : `${p.stock} und.`}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-2.5">
                        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">{p.name}</p>
                        <div className="mt-auto pt-1.5">
                          {p.originalPrice !== null && (
                            <span className="mr-1.5 text-[11px] text-muted line-through">{soles(p.originalPrice)}</span>
                          )}
                          <span className="text-[13px] font-bold text-brand-700">
                            {p.desde && <span className="text-[10.5px] font-medium text-muted">desde </span>}
                            {soles(p.price)}
                          </span>
                          {p.variations.length > 1 && (
                            <span className="ml-1 text-[10.5px] text-muted">· {p.variations.length} opciones</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {resultados.length < totalCatalogo && (
                  <div className="mt-4 flex justify-center">
                    <Button loading={buscando} onClick={() => buscar(termino, pagina + 1)}>
                      Cargar más ({totalCatalogo - resultados.length})
                    </Button>
                  </div>
                )}
              </>
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
                    // En Yape, Plin o transferencia el número de operación y la
                    // captura son la prueba de que el dinero entró: el bloque se
                    // abre solo para que no se cierre la venta sin ellos.
                    if (v !== "efectivo") setDetallesAbiertos(true);
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

                {/* Datos opcionales del cobro. Van plegados para que la venta
                    en efectivo, que es la mayoría, siga siendo de un solo
                    clic. */}
                <div className="rounded-xl border border-line-soft">
                  <button
                    type="button"
                    onClick={() => setDetallesAbiertos((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-medium text-ink-soft"
                  >
                    Comprobante, operación y nota
                    <TbChevronDown
                      className={`transition-transform ${
                        detallesAbiertos ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {detallesAbiertos && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 border-t border-line-soft p-3">
                          <div>
                            <label
                              htmlFor="operacion"
                              className="mb-1 block text-[11px] font-medium text-muted"
                            >
                              Número de operación
                            </label>
                            <Input
                              id="operacion"
                              value={referencia}
                              onChange={(e) => setReferencia(e.target.value)}
                              placeholder="0012345"
                            />
                          </div>

                          <div>
                            <span className="mb-1 block text-[11px] font-medium text-muted">
                              Comprobante
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-canvas">
                                {comprobante ? (
                                  <img
                                    src={comprobante.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full place-items-center text-[9px] text-muted">
                                    Sin foto
                                  </div>
                                )}
                              </div>
                              <Button
                                size="small"
                                icon={<TbPhoto />}
                                onClick={() => setGaleriaAbierta(true)}
                              >
                                {comprobante ? "Cambiar" : "Subir captura"}
                              </Button>
                              {comprobante && (
                                <Button
                                  size="small"
                                  type="text"
                                  danger
                                  onClick={() => setComprobante(null)}
                                >
                                  Quitar
                                </Button>
                              )}
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="nota-cobro"
                              className="mb-1 block text-[11px] font-medium text-muted"
                            >
                              Nota
                            </label>
                            <Input
                              id="nota-cobro"
                              value={notaPago}
                              onChange={(e) => setNotaPago(e.target.value)}
                              placeholder="Cliente frecuente, cambio pendiente…"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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

      <GalleryModal
        open={galeriaAbierta}
        onClose={() => setGaleriaAbierta(false)}
        onSelect={(img) => setComprobante(img)}
      />

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
      <Modal
        open={Boolean(eligiendo)}
        title={eligiendo?.name}
        footer={null}
        onCancel={() => setEligiendo(null)}
        destroyOnHidden
      >
        {eligiendo && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {eligiendo.variations.map((v) => (
              <button
                key={v.id}
                onClick={() => agregar(eligiendo, v)}
                className="rounded-xl border border-line p-2.5 text-left transition hover:border-brand-400 hover:bg-brand-50"
              >
                <p className="text-[13px] font-semibold text-ink">{v.label || "Único"}</p>
                <p className="text-[12px]">
                  {v.originalPrice !== null && (
                    <span className="mr-1 text-muted line-through">{soles(v.originalPrice)}</span>
                  )}
                  <b className="text-brand-700">{soles(v.price)}</b>
                </p>
                <p className="text-[11px] text-muted">
                  {eligiendo.unlimitedStock ? "Stock ilimitado" : `${v.stock} en stock`}
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
