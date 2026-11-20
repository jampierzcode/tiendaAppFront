import type { AxiosInstance } from "axios";
import type { LineaCarrito } from "./api";

/**
 * Comandas por enviar. Se guardan en el celular ANTES de mandarlas: si la
 * mesera se queda sin señal, la comanda espera aquí y sale sola al volver.
 * El backend ignora los reintentos repetidos gracias a `clientRequestId`.
 */
export interface ComandaPendiente {
  clientRequestId: string;
  /** Destino: una mesa, una cuenta abierta, o una cuenta nueva sin mesa. */
  tableId?: number | null;
  orderId?: number | null;
  service?: "comedor" | "para_llevar" | "delivery" | null;
  alias?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  shippingCost?: number | null;
  /** Para mostrar: "Mesa 4", "Juan (delivery)"… */
  tableName: string;
  guests: number | null;
  items: LineaCarrito[];
  createdAt: number;
  /** Error de validación (no de red): no se reintenta solo. */
  error?: string;
}

const clave = (uuid: string) => `pdv_outbox_${uuid}`;

export function leerPendientes(uuid: string): ComandaPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(clave(uuid)) ?? "[]");
  } catch {
    return [];
  }
}

function guardar(uuid: string, lista: ComandaPendiente[]) {
  localStorage.setItem(clave(uuid), JSON.stringify(lista));
  window.dispatchEvent(new Event("pdv-outbox"));
}

export function nuevoId() {
  return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function encolarComanda(uuid: string, c: ComandaPendiente) {
  guardar(uuid, [...leerPendientes(uuid), c]);
}

export function descartar(uuid: string, id: string) {
  guardar(uuid, leerPendientes(uuid).filter((c) => c.clientRequestId !== id));
}

let enviando = false;

/** Intenta mandar todo lo pendiente, en orden. Devuelve cuántas salieron. */
export async function enviarPendientes(uuid: string, api: AxiosInstance): Promise<number> {
  if (enviando) return 0;
  enviando = true;
  let enviadas = 0;
  try {
    for (const c of leerPendientes(uuid)) {
      if (c.error) continue;
      try {
        await api.post("/command", aCuerpo(c));
        descartar(uuid, c.clientRequestId);
        enviadas++;
      } catch (e) {
        const err = e as { response?: { status: number; data?: { message?: string } } };
        if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 401) {
          // El servidor la rechazó (plato agotado, mesa borrada…): se marca y se avisa.
          guardar(
            uuid,
            leerPendientes(uuid).map((x) =>
              x.clientRequestId === c.clientRequestId
                ? { ...x, error: err.response?.data?.message ?? "Rechazada" }
                : x
            )
          );
          continue;
        }
        break; // sin red: se reintenta después, sin desordenar
      }
    }
  } finally {
    enviando = false;
  }
  return enviadas;
}

/** Cuerpo de POST /command a partir de una comanda guardada. */
export function aCuerpo(c: ComandaPendiente) {
  return {
    tableId: c.tableId ?? null,
    orderId: c.orderId ?? null,
    service: c.service ?? null,
    alias: c.alias ?? null,
    customerName: c.customerName ?? null,
    customerPhone: c.customerPhone ?? null,
    deliveryAddress: c.deliveryAddress ?? null,
    shippingCost: c.shippingCost ?? null,
    clientRequestId: c.clientRequestId,
    guests: c.guests,
    items: c.items.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      note: l.note || null,
      options: l.options.map((o) => ({ optionId: o.optionId, quantity: o.quantity })),
    })),
  };
}
