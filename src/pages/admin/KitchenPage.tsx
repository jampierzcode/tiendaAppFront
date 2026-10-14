import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Drawer, Empty, Popconfirm, Spin, message } from "antd";
import { TbMessageCircle } from "react-icons/tb";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import ChatThread from "../../components/admin/ChatThread";
import PagoPedidoModal from "../../components/admin/PagoPedidoModal";
import { avisar, usePermisoAvisos } from "../../hooks/useAvisos";

interface Linea {
  id: number;
  productName: string;
  quantity: number;
  note: string | null;
  modifiers: { optionName: string; quantity: number }[];
}

interface Pedido {
  id: number;
  code: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  deliveryMethod: string;
  note: string | null;
  createdAt: string;
  items: Linea[];
}

const COLUMNAS: { estado: string; titulo: string; siguiente?: { a: string; texto: string } }[] = [
  { estado: "pendiente", titulo: "Nuevos", siguiente: { a: "confirmado", texto: "Confirmar" } },
  { estado: "confirmado", titulo: "Confirmados", siguiente: { a: "preparando", texto: "A cocina" } },
  { estado: "preparando", titulo: "Preparando", siguiente: { a: "listo", texto: "Listo" } },
  { estado: "listo", titulo: "Listos", siguiente: { a: "entregado", texto: "Entregado" } },
];

const donde = (p: Pedido) =>
  p.deliveryMethod === "envio" ? "Delivery" : "Para recoger";

/**
 * Tablero de cocina: una columna por estado, botones grandes, refresco
 * automático y un pitido cuando entra un pedido nuevo.
 */
export default function KitchenPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [moviendo, setMoviendo] = useState<number | null>(null);
  const vistos = useRef<Set<number> | null>(null);
  const [chat, setChat] = useState<Pedido | null>(null);
  // Mensajes de WhatsApp sin leer por cliente (clave: últimos 9 dígitos).
  const [noLeidos, setNoLeidos] = useState<Record<string, number>>({});
  // Política de cobro: pedido y estado que esperan a que se registre el pago.
  const [cobro, setCobro] = useState<{ p: Pedido; a: string; saldo: number } | null>(null);
  const { permiso, pedir } = usePermisoAvisos();

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/orders", { params: { perPage: 100 } });
      const lista = (r.data.data as Pedido[]).filter((p) =>
        COLUMNAS.some((c) => c.estado === p.status)
      );

      // Aviso sonoro solo para pedidos que no estaban en la primera carga.
      if (vistos.current) {
        const nuevo = lista.some((p) => p.status === "pendiente" && !vistos.current!.has(p.id));
        if (nuevo) {
          const nuevos = lista.filter((p) => p.status === "pendiente" && !vistos.current!.has(p.id));
          const p = nuevos[0];
          avisar(
            nuevos.length > 1 ? `${nuevos.length} pedidos nuevos` : `Pedido nuevo ${p.code}`,
            `${p.customerName} · ${donde(p)}`,
            "pedido"
          );
        }
      }
      vistos.current = new Set(lista.map((p) => p.id));
      setPedidos(lista);

      try {
        const c = await apiTienda.get("/whatsapp/conversations");
        const mapa: Record<string, number> = {};
        for (const x of c.data.data ?? []) if (x.unread > 0) mapa[x.contact] = x.unread;
        setNoLeidos(mapa);
      } catch {
        // sin chat, el tablero igual funciona
      }
    } catch {
      // un fallo de red puntual no debe vaciar el tablero
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 8000);
    return () => clearInterval(t);
  }, [cargar]);

  const mover = async (p: Pedido, a: string, sinCobrar = false) => {
    setMoviendo(p.id);
    try {
      await apiTienda.put(`/orders/${p.id}/status`, { status: a, allowUnpaid: sinCobrar || undefined });
      setCobro(null);
      await cargar();
    } catch (e: any) {
      if (e?.response?.data?.code === "PAYMENT_REQUIRED") {
        setCobro({ p, a, saldo: Number(e.response.data.data?.saldo ?? 0) });
        return;
      }
      message.error(e?.response?.data?.message ?? "No se pudo cambiar el estado");
    } finally {
      setMoviendo(null);
    }
  };

  const cancelar = (p: Pedido) => mover(p, "cancelado");

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Cocina"
        descripcion="Se actualiza solo cada pocos segundos. Cada cambio avisa al cliente por WhatsApp si el bot está conectado."
      />

      {permiso === "default" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-bg px-4 py-2 text-[13px] text-warn">
          <span>Activa las notificaciones para enterarte de cada pedido aunque esta pestaña esté en segundo plano.</span>
          <Button size="small" onClick={pedir}>
            Activar avisos
          </Button>
        </div>
      )}
      {permiso === "denied" && (
        <p className="mb-4 rounded-xl bg-warn-bg px-4 py-2 text-[12px] text-warn">
          Las notificaciones están bloqueadas en este navegador; solo sonará el pitido.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNAS.map((c) => {
          const lista = pedidos.filter((p) => p.status === c.estado);
          return (
            <section key={c.estado}>
              <h2 className="eyebrow mb-3">
                {c.titulo} ({lista.length})
              </h2>
              <div className="space-y-3">
                {lista.length === 0 && (
                  <div className="card p-4">
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin pedidos" />
                  </div>
                )}
                {lista.map((p) => (
                  <article key={p.id} className="card p-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-lg font-extrabold text-ink">{p.code}</h3>
                      <span className="text-[12px] text-muted">{dayjs(p.createdAt).format("HH:mm")}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-brand-600">{donde(p)}</p>
                    <p className="text-[12px] text-muted">{p.customerName}</p>

                    <ul className="mt-3 space-y-2">
                      {p.items.map((i) => (
                        <li key={i.id} className="text-[14px] text-ink">
                          <span className="font-bold">{i.quantity}×</span> {i.productName}
                          {i.modifiers.length > 0 && (
                            <span className="block pl-5 text-[12px] text-ink-soft">
                              {i.modifiers
                                .map((m) => (m.quantity > 1 ? `${m.quantity}× ${m.optionName}` : m.optionName))
                                .join(" · ")}
                            </span>
                          )}
                          {i.note && (
                            <span className="block pl-5 text-[12px] italic text-warn">“{i.note}”</span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {p.note && (
                      <p className="mt-2 rounded-lg bg-warn-bg px-2 py-1 text-[12px] text-warn">{p.note}</p>
                    )}

                    <div className="mt-4 flex gap-2">
                      {c.siguiente && (
                        <Button
                          type="primary"
                          size="large"
                          block
                          loading={moviendo === p.id}
                          onClick={() => mover(p, c.siguiente!.a)}
                        >
                          {c.siguiente.texto}
                        </Button>
                      )}
                      {p.customerPhone && (
                        <Badge
                          count={noLeidos[p.customerPhone.replace(/\D/g, "").slice(-9)] ?? 0}
                          size="small"
                          offset={[-4, 4]}
                        >
                          <Button size="large" icon={<TbMessageCircle />} onClick={() => setChat(p)} />
                        </Badge>
                      )}
                      {["pendiente", "confirmado", "preparando", "listo"].includes(p.status) && (
                        <Popconfirm
                          title={`¿Cancelar el pedido ${p.code}?`}
                          description={
                            p.customerPhone
                              ? "Se repondrán los insumos y se avisará al cliente por WhatsApp."
                              : "Se repondrán los insumos."
                          }
                          okText="Sí, cancelar"
                          cancelText="No"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => cancelar(p)}
                        >
                          <Button size="large" danger>
                            Cancelar
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <PagoPedidoModal
        open={!!cobro}
        pedido={cobro ? { id: cobro.p.id, code: cobro.p.code } : null}
        saldo={cobro?.saldo ?? 0}
        motivo="La política de cobro de tu negocio pide registrar el pago antes de continuar."
        onClose={() => setCobro(null)}
        onPagado={() => cobro && mover(cobro.p, cobro.a)}
        onSinCobrar={() => cobro && mover(cobro.p, cobro.a, true)}
      />

      <Drawer
        open={!!chat}
        onClose={() => {
          setChat(null);
          cargar();
        }}
        width={420}
        title={chat ? `${chat.customerName} · ${chat.code}` : ""}
        styles={{ body: { padding: 0 } }}
      >
        {chat?.customerPhone && (
          <ChatThread
            contact={chat.customerPhone.replace(/\D/g, "").slice(-9)}
            phone={chat.customerPhone.replace(/\D/g, "")}
          />
        )}
      </Drawer>
    </>
  );
}
