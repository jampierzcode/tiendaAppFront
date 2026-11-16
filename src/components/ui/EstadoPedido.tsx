import { useEsRestaurante } from "../../context/BusinessContext";

export type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "pagado"
  | "preparando"
  | "listo"
  | "enviado"
  | "entregado"
  | "cancelado"
  | "devuelto";

/**
 * Estilo de cada estado de pedido, en un solo sitio.
 *
 * El color va siempre con la palabra: quien no distingue el ámbar del verde
 * tiene que poder leer en qué punto está el pedido.
 */
export const estilosEstado: Record<EstadoPedido, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-warn-bg text-warn" },
  confirmado: { texto: "Confirmado", clase: "bg-info-bg text-info" },
  pagado: { texto: "Pagado", clase: "bg-brand-50 text-brand-600" },
  preparando: { texto: "Preparando", clase: "bg-warn-bg text-warn" },
  listo: { texto: "Listo", clase: "bg-ok-bg text-ok" },
  enviado: { texto: "Enviado", clase: "bg-info-bg text-info" },
  entregado: { texto: "Entregado", clase: "bg-ok-bg text-ok" },
  cancelado: { texto: "Cancelado", clase: "bg-danger-bg text-danger" },
  devuelto: { texto: "Devuelto", clase: "bg-line-soft text-muted" },
};

/** En un restaurante el pedido se acepta, va a cocina y sale a reparto. */
const TEXTO_RESTAURANTE: Partial<Record<EstadoPedido, string>> = {
  confirmado: "Aceptado",
  preparando: "En cocina",
  enviado: "En camino",
};

export function textoEstado(estado: EstadoPedido, restaurante = false) {
  return (restaurante && TEXTO_RESTAURANTE[estado]) || estilosEstado[estado]?.texto || estado;
}

export default function BadgeEstado({ estado }: { estado: EstadoPedido }) {
  const restaurante = useEsRestaurante();
  const e = estilosEstado[estado] ?? estilosEstado.pendiente;
  return <span className={`pill ${e.clase}`}>{textoEstado(estado, restaurante)}</span>;
}
