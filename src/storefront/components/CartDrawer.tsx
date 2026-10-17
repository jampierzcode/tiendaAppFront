import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { crearPedido, marcarPedidoEnviado, type RespuestaPedido } from "../api";
import CuponCarrito from "./CuponCarrito";
import { useStore } from "../StoreContext";
import TelefonoPais from "./TelefonoPais";
import { correoValido, dialDePais, errorTelefono, separarTelefono, telefonoCompleto } from "../../utilities/paises";
import { enlaceMapa, guardarClaim, useCliente } from "../cliente";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

type Paso = "carrito" | "datos" | "listo";

/**
 * Carrito y checkout, en un panel lateral.
 *
 * El pedido se manda al servidor ANTES de abrir WhatsApp: así el negocio ve
 * el pedido aunque el cliente cierre el chat sin enviar el mensaje.
 */
export default function CartDrawer({ abierto, onCerrar }: Props) {
  const {
    slug,
    tienda,
    carrito,
    subtotal,
    descuento,
    cupon,
    cuponEstado,
    aplicarCupon,
    quitarCupon,
    envio,
    total,
    cambiarCantidad,
    quitar,
    vaciar,
    precio,
  } = useStore();

  const navigate = useNavigate();
  const { cliente } = useCliente();
  const [paso, setPaso] = useState<Paso>("carrito");
  // El código de país arranca con el de la tienda; el cliente puede cambiarlo.
  const [dial, setDial] = useState<string | null>(null);
  const dialActual = dial ?? dialDePais(tienda?.country);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<RespuestaPedido | null>(null);

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryMethod: "envio" as "envio" | "recojo",
    deliveryAddress: "",
    deliveryCity: tienda?.city ?? "",
    note: "",
  });

  // Con sesión de cliente, el perfil rellena nombre, WhatsApp y dirección.
  useEffect(() => {
    if (!cliente) return;
    const tel = separarTelefono(cliente.phone);
    if (tel.dial) setDial((d) => d ?? tel.dial);
    setForm((f) => ({
      ...f,
      customerName: f.customerName || cliente.name,
      customerPhone: f.customerPhone || tel.nacional,
      customerEmail: f.customerEmail || cliente.email,
      deliveryAddress: f.deliveryAddress || cliente.deliveryAddress || "",
      deliveryCity: f.deliveryCity || cliente.deliveryCity || tienda?.city || "",
    }));
  }, [cliente, tienda?.city]);

  // Con sesión, los datos precargados se ven como fichas con un lápiz para editarlos.
  const [editarContacto, setEditarContacto] = useState(false);
  const [editarDireccion, setEditarDireccion] = useState(false);
  const contactoListo =
    Boolean(cliente) &&
    form.customerName.trim().length > 1 &&
    !errorTelefono(dialActual, form.customerPhone) &&
    (!form.customerEmail.trim() || correoValido(form.customerEmail));
  const direccionLista = Boolean(cliente) && form.deliveryAddress.trim().length > 0 && form.deliveryCity.trim().length > 0;
  const usaUbicacionGuardada = Boolean(
    cliente && enlaceMapa(cliente) && form.deliveryAddress === cliente.deliveryAddress
  );

  // El panel bloquea el desplazamiento de la página de atrás; solo se mueve su propio contenido.
  useEffect(() => {
    if (!abierto) return;
    const ancho = window.innerWidth - document.documentElement.clientWidth;
    const antes = { overflow: document.body.style.overflow, padding: document.body.style.paddingRight };
    document.body.style.overflow = "hidden";
    if (ancho > 0) document.body.style.paddingRight = `${ancho}px`; // evita el salto al quitar la barra
    return () => {
      document.body.style.overflow = antes.overflow;
      document.body.style.paddingRight = antes.padding;
    };
  }, [abierto]);

  // Cerrar con Escape es lo que espera cualquiera que abra un panel.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, onCerrar]);

  useEffect(() => {
    if (!abierto) {
      // Al cerrar se vuelve al carrito, salvo que el pedido ya esté hecho.
      setTimeout(() => setPaso((p) => (p === "listo" ? "carrito" : p)), 300);
    }
  }, [abierto]);

  const confirmar = async () => {
    setError(null);

    const telefono = telefonoCompleto(dialActual, form.customerPhone);
    const falloTel = errorTelefono(dialActual, form.customerPhone);
    if (falloTel) {
      setError(falloTel);
      return;
    }
    if (form.customerEmail.trim() && !correoValido(form.customerEmail)) {
      setError("El correo no parece válido. Revísalo o déjalo vacío.");
      return;
    }
    if (!form.customerName.trim()) {
      setError("Necesitamos tu nombre y tu teléfono para contactarte.");
      return;
    }
    if (form.deliveryMethod === "envio" && !form.deliveryAddress.trim()) {
      setError("Escribe la dirección donde quieres recibir el pedido.");
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await crearPedido(slug, {
        ...form,
        customerPhone: telefono,
        // Si usa la dirección guardada con ubicación, el negocio recibe el enlace al mapa.
        note:
          [
            form.note.trim(),
            cliente && form.deliveryMethod === "envio" && form.deliveryAddress === cliente.deliveryAddress
              ? enlaceMapa(cliente)
                ? `Ubicación: ${enlaceMapa(cliente)}`
                : ""
              : "",
          ]
            .filter(Boolean)
            .join("\n") || undefined,
        // Solo se manda un cupón que el servidor ya dio por bueno.
        couponCode: cuponEstado?.valido ? cuponEstado.codigo : undefined,
        items: carrito.map((l) => ({ variationId: l.variationId, quantity: l.quantity })),
      });

      setPedido(respuesta);
      vaciar();

      if (respuesta.claimToken) guardarClaim(slug, respuesta.code, respuesta.claimToken);
      if (respuesta.whatsappUrl) {
        marcarPedidoEnviado(slug, respuesta.code);
        window.open(respuesta.whatsappUrl, "_blank", "noopener");
      }
      // El cliente aterriza en el detalle de su pedido, donde puede seguirlo
      // y, si quiere, crear su cuenta.
      onCerrar();
      navigate(`/t/${slug}/pedido/${respuesta.code}`, {
        state: { whatsappUrl: respuesta.whatsappUrl, claimToken: respuesta.claimToken, nuevo: true },
      });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "No pudimos registrar tu pedido. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const faltaParaEnvioGratis =
    tienda?.freeShippingFrom != null && subtotal > 0 && subtotal - descuento < tienda.freeShippingFrom
      ? tienda.freeShippingFrom - (subtotal - descuento)
      : 0;

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCerrar}
            className="fixed inset-0 z-40 bg-black/40"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            role="dialog"
            aria-label="Tu pedido"
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="text-base font-semibold text-neutral-900">
                {paso === "listo" ? "¡Pedido registrado!" : paso === "datos" ? "Tus datos" : "Tu pedido"}
              </h2>
              <button
                onClick={onCerrar}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {paso === "carrito" && (
                <>
                  {carrito.length === 0 ? (
                    <p className="mt-10 text-center text-sm text-neutral-500">
                      Tu carrito está vacío.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      <AnimatePresence initial={false}>
                        {carrito.map((linea) => (
                          <motion.li
                            key={linea.variationId}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            transition={{ duration: 0.2 }}
                            className="flex gap-3 rounded-lg border border-neutral-200 p-2.5"
                          >
                            <div className="h-20 w-16 shrink-0 overflow-hidden rounded bg-neutral-100">
                              {linea.imageUrl && (
                                <img src={linea.imageUrl} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-neutral-900">
                                {linea.productName}
                              </p>
                              {linea.variationLabel && (
                                <p className="text-xs text-neutral-500">{linea.variationLabel}</p>
                              )}
                              <p className="mt-0.5 text-sm font-semibold">{precio(linea.price)}</p>

                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex items-center rounded-md border border-neutral-300">
                                  <button
                                    onClick={() => cambiarCantidad(linea.variationId, linea.quantity - 1)}
                                    className="px-2 py-0.5 text-neutral-600 hover:bg-neutral-100"
                                    aria-label="Quitar uno"
                                  >
                                    −
                                  </button>
                                  <span className="w-7 text-center text-sm tabular-nums">
                                    {linea.quantity}
                                  </span>
                                  <button
                                    onClick={() => cambiarCantidad(linea.variationId, linea.quantity + 1)}
                                    disabled={linea.quantity >= linea.stock}
                                    className="px-2 py-0.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                                    aria-label="Agregar uno"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  onClick={() => quitar(linea.variationId)}
                                  className="text-xs text-neutral-500 underline hover:text-red-600"
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}

                  {faltaParaEnvioGratis > 0 && (
                    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Te faltan {precio(faltaParaEnvioGratis)} para el envío gratis.
                    </p>
                  )}
                </>
              )}

              {paso === "datos" && (
                <div className="space-y-3">
                  {contactoListo && !editarContacto ? (
                    <DatoCargado titulo="Tus datos" onEditar={() => setEditarContacto(true)}>
                      <p className="text-sm font-semibold text-neutral-900">{form.customerName}</p>
                      <p className="text-sm text-neutral-600">
                        +{dialActual} {form.customerPhone}
                      </p>
                      {form.customerEmail && <p className="truncate text-sm text-neutral-600">{form.customerEmail}</p>}
                    </DatoCargado>
                  ) : (
                    <>
                      <Campo
                        id="nombre"
                        label="Tu nombre"
                        value={form.customerName}
                        onChange={(v) => setForm({ ...form, customerName: v })}
                        placeholder="Ana Torres"
                      />
                      <div>
                        <label htmlFor="telefono" className="mb-1 block text-xs font-medium text-neutral-700">
                          Tu WhatsApp
                        </label>
                        <TelefonoPais
                          id="telefono"
                          dial={dialActual}
                          onDial={setDial}
                          value={form.customerPhone}
                          onValue={(v) => setForm({ ...form, customerPhone: v })}
                          placeholder="987 654 321"
                          className="h-[38px] rounded-lg border border-neutral-300 focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900"
                        />
                      </div>
                      <Campo
                        id="correo"
                        label="Tu correo (opcional)"
                        value={form.customerEmail}
                        onChange={(v) => setForm({ ...form, customerEmail: v })}
                        placeholder="ana@correo.com"
                        type="email"
                      />
                      {editarContacto && (
                        <button
                          type="button"
                          onClick={() => setEditarContacto(false)}
                          disabled={!contactoListo}
                          className="text-sm font-semibold underline disabled:opacity-40"
                        >
                          Listo
                        </button>
                      )}
                    </>
                  )}

                  <fieldset>
                    <legend className="mb-1.5 text-xs font-medium text-neutral-700">Entrega</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["envio", "recojo"] as const).map((metodo) => (
                        <button
                          key={metodo}
                          type="button"
                          onClick={() => setForm({ ...form, deliveryMethod: metodo })}
                          className={`rounded-lg border px-3 py-2 text-sm transition ${
                            form.deliveryMethod === metodo
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-300 text-neutral-700 hover:border-neutral-400"
                          }`}
                        >
                          {metodo === "envio" ? "Envío a domicilio" : "Recojo en tienda"}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {form.deliveryMethod === "envio" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 overflow-hidden"
                    >
                      {direccionLista && !editarDireccion ? (
                        <DatoCargado titulo="Enviar a" onEditar={() => setEditarDireccion(true)}>
                          <p className="text-sm font-semibold text-neutral-900">{form.deliveryAddress}</p>
                          <p className="text-sm text-neutral-600">{form.deliveryCity}</p>
                          {usaUbicacionGuardada && (
                            <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              📍 Ubicación guardada
                            </span>
                          )}
                        </DatoCargado>
                      ) : (
                        <>
                          <Campo
                            id="direccion"
                            label="Dirección"
                            value={form.deliveryAddress}
                            onChange={(v) => setForm({ ...form, deliveryAddress: v })}
                            placeholder="Av. Brasil 123, dpto 401"
                          />
                          <Campo
                            id="ciudad"
                            label="Ciudad"
                            value={form.deliveryCity}
                            onChange={(v) => setForm({ ...form, deliveryCity: v })}
                            placeholder="Lima"
                          />
                          {editarDireccion && (
                            <button
                              type="button"
                              onClick={() => setEditarDireccion(false)}
                              disabled={!direccionLista}
                              className="text-sm font-semibold underline disabled:opacity-40"
                            >
                              Listo
                            </button>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}

                  <Campo
                    id="nota"
                    label="Nota (opcional)"
                    value={form.note}
                    onChange={(v) => setForm({ ...form, note: v })}
                    placeholder="Referencia, horario preferido…"
                  />
                </div>
              )}

              {paso === "listo" && pedido && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 text-center"
                >
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm text-neutral-700">
                    Guardamos tu pedido <strong>{pedido.code}</strong> por{" "}
                    <strong>{pedido.currencySymbol} {pedido.total.toFixed(2)}</strong>.
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Se abrió WhatsApp con el detalle. Si no se abrió, usa el botón de abajo.
                  </p>
                  {pedido.whatsappUrl && (
                    <a
                      href={pedido.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Abrir WhatsApp
                    </a>
                  )}
                </motion.div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {paso !== "listo" && carrito.length > 0 && (
              <footer className="border-t border-neutral-200 px-5 py-4">
                {paso === "carrito" && (
                  <CuponCarrito aplicado={cupon} estado={cuponEstado} onAplicar={aplicarCupon} onQuitar={quitarCupon} />
                )}
                <dl className="mb-3 space-y-1 text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <dt>Subtotal</dt>
                    <dd className="tabular-nums">{precio(subtotal)}</dd>
                  </div>
                  {descuento > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Promociones{cuponEstado?.valido ? " y cupón" : ""}</dt>
                      <dd className="tabular-nums">− {precio(descuento)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-neutral-600">
                    <dt>Envío</dt>
                    <dd className="tabular-nums">{envio === 0 ? "Gratis" : precio(envio)}</dd>
                  </div>
                  <div className="flex justify-between pt-1 text-base font-semibold text-neutral-900">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{precio(total)}</dd>
                  </div>
                </dl>

                {paso === "carrito" ? (
                  <button
                    onClick={() => setPaso("datos")}
                    disabled={!tienda?.aceptaPedidos}
                    className="w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--tienda-primario, #111827)" }}
                  >
                    {tienda?.aceptaPedidos ? "Continuar" : "Esta tienda no recibe pedidos ahora"}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaso("carrito")}
                      className="rounded-lg border border-neutral-300 px-4 py-3 text-sm text-neutral-700"
                    >
                      Atrás
                    </button>
                    <button
                      onClick={confirmar}
                      disabled={enviando}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {enviando ? "Registrando…" : "Pedir por WhatsApp"}
                    </button>
                  </div>
                )}
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
      />
    </div>
  );
}

/** Dato ya cargado (del perfil): se ve como ficha, con un lápiz para cambiarlo en este pedido. */
function DatoCargado({
  titulo,
  onEditar,
  children,
}: {
  titulo: string;
  onEditar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{titulo}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${titulo.toLowerCase()}`}
        className="shrink-0 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
  );
}
