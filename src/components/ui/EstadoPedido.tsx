export type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "pagado"
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
  enviado: { texto: "Enviado", clase: "bg-info-bg text-info" },
  entregado: { texto: "Entregado", clase: "bg-ok-bg text-ok" },
  cancelado: { texto: "Cancelado", clase: "bg-danger-bg text-danger" },
  devuelto: { texto: "Devuelto", clase: "bg-line-soft text-muted" },
};

export default function BadgeEstado({ estado }: { estado: EstadoPedido }) {
  const e = estilosEstado[estado] ?? estilosEstado.pendiente;
  return <span className={`pill ${e.clase}`}>{e.texto}</span>;
}
