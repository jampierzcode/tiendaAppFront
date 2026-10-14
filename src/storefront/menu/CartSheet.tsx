import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { crearPedidoMenu } from "../api";
import { useStore } from "../StoreContext";
import { precioUnitario, useMenuCart } from "./MenuCart";

interface Props {
  abierto: boolean;
  onClose: () => void;
}

type Metodo = "recojo" | "envio";

const claveContacto = "menu-contacto";

export default function CartSheet({ abierto, onClose }: Props) {
  const { slug, tienda, precio } = useStore();
  const { lineas, subtotal, cambiarCantidad, quitar, vaciar } = useMenuCart();
  const navigate = useNavigate();

  const [metodo, setMetodo] = useState<Metodo>("recojo");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recordar nombre y teléfono: el segundo pedido no vuelve a pedirlos.
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(claveContacto) ?? "null");
      if (guardado) {
        setNombre(guardado.nombre ?? "");
        setTelefono(guardado.telefono ?? "");
      }
    } catch {
      // sin datos guardados
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);

  if (!tienda) return null;

  const envio =
    metodo !== "envio"
      ? 0
      : tienda.freeShippingFrom !== null && subtotal >= tienda.freeShippingFrom
        ? 0
        : tienda.shippingCost;
  const total = subtotal + envio;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lineas.length) return;
    if (metodo === "envio" && !direccion.trim()) return setError("Falta la dirección de entrega");

    setEnviando(true);
    try {
      const pedido = await crearPedidoMenu(slug, {
        customerName: nombre,
        customerPhone: telefono,
        deliveryMethod: metodo,
        deliveryAddress: metodo === "envio" ? direccion : undefined,
        note: nota || undefined,
        items: lineas.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          note: l.note || undefined,
          options: l.options.map((o) => ({ optionId: o.optionId, quantity: o.quantity })),
        })),
      });

      try {
        localStorage.setItem(claveContacto, JSON.stringify({ nombre, telefono }));
      } catch {
        // no pasa nada
      }

      vaciar();
      onClose();
      navigate(`/t/${slug}/pedido/${pedido.code}`, {
        state: { whatsappUrl: pedido.whatsappUrl },
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "No pudimos enviar tu pedido. Inténtalo de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  };

  const campo =
    "h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm outline-none focus:border-neutral-400";

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            key="f"
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            key="h"
            onSubmit={enviar}
            role="dialog"
            aria-modal="true"
            aria-label="Mi pedido"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-lg font-extrabold">Mi pedido</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-lg"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="divide-y divide-neutral-100">
                {lineas.map((l) => (
                  <li key={l.key} className="flex gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-900">{l.name}</p>
                      {l.options.length > 0 && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {l.options
                            .map((o) => (o.quantity > 1 ? `${o.quantity}× ${o.name}` : o.name))
                            .join(" · ")}
                        </p>
                      )}
                      {l.note && <p className="mt-0.5 text-xs italic text-neutral-500">“{l.note}”</p>}
                      <button
                        type="button"
                        onClick={() => quitar(l.key)}
                        className="mt-1 text-xs font-semibold text-red-600"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-sm font-bold tabular-nums">
                        {precio(precioUnitario(l) * l.quantity)}
                      </span>
                      <div className="flex items-center rounded-full border border-neutral-200">
                        <button
                          type="button"
                          aria-label="Menos"
                          onClick={() => cambiarCantidad(l.key, l.quantity - 1)}
                          className="h-8 w-8 text-lg"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">
                          {l.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Más"
                          onClick={() => cambiarCantidad(l.key, l.quantity + 1)}
                          className="h-8 w-8 text-lg"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-3">
                {tienda.paymentPolicy !== "none" && (
                  <div className="rounded-2xl bg-neutral-100 p-3 text-sm text-neutral-700">
                    <p className="font-bold">
                      {tienda.paymentPolicy === "on_confirm"
                        ? "Pago por adelantado"
                        : "Pago contra entrega"}
                    </p>
                    <p className="mt-0.5 text-[13px]">
                      {tienda.paymentPolicy === "on_confirm"
                        ? "Te enviaremos los datos por WhatsApp para pagar y confirmar tu pedido."
                        : "Pagas al recibir tu pedido (efectivo, Yape, Plin o transferencia)."}
                    </p>
                    {tienda.paymentInstructions && (
                      <p className="mt-1 whitespace-pre-line text-[13px] font-semibold">
                        {tienda.paymentInstructions}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-sm font-bold">¿Cómo lo quieres?</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["recojo", "Recojo"],
                      ["envio", "Delivery"],
                    ] as const
                  ).map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setMetodo(valor)}
                      className="h-11 rounded-2xl border text-sm font-bold"
                      style={
                        metodo === valor
                          ? {
                              backgroundColor: "var(--tienda-primario)",
                              borderColor: "var(--tienda-primario)",
                              color: "#fff",
                            }
                          : { borderColor: "#e5e5e5", color: "#404040" }
                      }
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>

                {metodo === "envio" && (
                  <input
                    className={campo}
                    placeholder="Dirección de entrega"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    autoComplete="street-address"
                  />
                )}

                <input
                  className={campo}
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                  required
                />
                <input
                  className={campo}
                  placeholder="Tu WhatsApp (te avisamos cuando esté listo)"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
                <textarea
                  className="w-full resize-none rounded-2xl border border-neutral-200 p-4 text-sm outline-none focus:border-neutral-400"
                  placeholder="Comentario para todo el pedido (opcional)"
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>

            <div className="border-t border-neutral-100 p-4">
              <dl className="mb-3 space-y-1 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{precio(subtotal)}</dd>
                </div>
                {metodo === "envio" && (
                  <div className="flex justify-between text-neutral-600">
                    <dt>Delivery</dt>
                    <dd className="tabular-nums">{envio === 0 ? "Gratis" : precio(envio)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{precio(total)}</dd>
                </div>
              </dl>

              {error && (
                <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando || !tienda.aceptaPedidos || lineas.length === 0}
                className="h-12 w-full rounded-full text-sm font-extrabold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--tienda-primario)" }}
              >
                {enviando ? "Enviando…" : "Confirmar pedido"}
              </button>
            </div>
          </motion.form>
        </>
      )}
    </AnimatePresence>
  );
}
