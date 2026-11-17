/**
 * Lo que el front necesita saber de los planes: qué función exige cada
 * pantalla del panel y cómo se llaman las cosas. La lista de funciones de
 * cada plan la manda el backend (`business.funciones`).
 */

/** Pantalla del panel (`/b/:uuid/<ruta>`) → función que exige. */
export const FUNCION_DE_PANTALLA: Record<string, string> = {
  orders: "pedidos_online",
  customers: "pedidos_online",
  kitchen: "cocina",
  pos: "pos",
  reports: "reportes",
  chat: "whatsapp",
  whatsapp: "whatsapp",
  "vendedor-ia": "vendedor_ia",
  ingredients: "insumos",
  discounts: "promociones",
  inventory: "inventario",
  purchases: "compras",
};

export const NOMBRE_FUNCION: Record<string, string> = {
  carta: "Carta o catálogo digital",
  inventario: "Inventario y stock",
  envios: "Envíos y delivery",
  compras: "Compras y proveedores",
  qr: "QR y link propio",
  promociones: "Promociones y cupones",
  pedidos_online: "Pedidos en línea",
  cocina: "Pantalla de cocina",
  cuentas_cliente: "App del cliente",
  pos: "Caja / mostrador",
  reportes: "Reportes de ventas",
  whatsapp: "WhatsApp conectado",
  vendedor_ia: "Vendedor IA 24/7",
  insumos: "Insumos y recetas",
};

export const INTERVALO: Record<string, { uno: string; varios: string; corto: string }> = {
  month: { uno: "mes", varios: "meses", corto: "/mes" },
  year: { uno: "año", varios: "años", corto: "/año" },
  trial: { uno: "día de prueba", varios: "días de prueba", corto: "" },
};

export const soles = (n: number | string | null | undefined) =>
  `S/ ${Number(n ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ESTADO_SUSCRIPCION: Record<string, { texto: string; color: string }> = {
  vigente: { texto: "Vigente", color: "green" },
  programada: { texto: "Programada", color: "blue" },
  vencida: { texto: "Vencida", color: "default" },
  anulada: { texto: "Anulada", color: "red" },
};

export const METODOS_PAGO = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

/** ¿La función aplica a este tipo de negocio? (cocina solo restaurante, compras solo tienda…) */
export const aplicaA = (f: { rubro?: string | null }, tipo?: string | null) =>
  !f.rubro || !tipo || f.rubro === tipo;
