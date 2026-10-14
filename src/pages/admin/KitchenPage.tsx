import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Empty, Spin, message } from "antd";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

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
  deliveryMethod: string;
  tableLabel: string | null;
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
  p.deliveryMethod === "mesa"
    ? `Mesa ${p.tableLabel ?? "?"}`
    : p.deliveryMethod === "envio"
      ? "Delivery"
      : "Para llevar";

/**
 * Tablero de cocina: una columna por estado, botones grandes, refresco
 * automático y un pitido cuando entra un pedido nuevo.
 */
export default function KitchenPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [moviendo, setMoviendo] = useState<number | null>(null);
  const vistos = useRef<Set<number> | null>(null);

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
          try {
            const ctx = new AudioContext();
            const o = ctx.createOscillator();
            o.frequency.value = 880;
            o.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.25);
          } catch {
            // el navegador puede bloquear audio sin interacción previa
          }
        }
      }
      vistos.current = new Set(lista.map((p) => p.id));
      setPedidos(lista);
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

  const mover = async (p: Pedido, a: string) => {
    setMoviendo(p.id);
    try {
      await apiTienda.put(`/orders/${p.id}/status`, { status: a });
      await cargar();
    } catch (e: any) {
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
                      {["pendiente", "confirmado"].includes(p.status) && (
                        <Button size="large" danger onClick={() => cancelar(p)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
