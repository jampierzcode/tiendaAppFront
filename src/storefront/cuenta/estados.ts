export const ESTADOS: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Recibido", clase: "bg-amber-100 text-amber-800" },
  confirmado: { texto: "Confirmado", clase: "bg-blue-100 text-blue-800" },
  pagado: { texto: "Pagado", clase: "bg-blue-100 text-blue-800" },
  preparando: { texto: "Preparando", clase: "bg-indigo-100 text-indigo-800" },
  listo: { texto: "Listo", clase: "bg-emerald-100 text-emerald-800" },
  enviado: { texto: "En camino", clase: "bg-emerald-100 text-emerald-800" },
  entregado: { texto: "Entregado", clase: "bg-neutral-200 text-neutral-700" },
  cancelado: { texto: "Cancelado", clase: "bg-red-100 text-red-700" },
  devuelto: { texto: "Devuelto", clase: "bg-red-100 text-red-700" },
};

export const FINALIZADOS = ["entregado", "cancelado", "devuelto"];
