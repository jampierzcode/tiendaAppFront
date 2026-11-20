import axios, { type AxiosInstance } from "axios";

/**
 * Cliente del PDV de salón. Lo usan el dueño (con su sesión del panel) y el
 * personal (que entra con PIN en un equipo vinculado; su token se guarda
 * aparte para que el mismo celular pueda tener las dos sesiones).
 */
const CLAVE_EQUIPO = "pdv_equipo";
const CLAVE_SESION = "pdv_sesion";

export interface EquipoGuardado {
  deviceToken: string;
  negocio: { uuid: string; name: string };
  equipo: string;
  /** pdv: comandero/caja con PIN · monitor: pantalla de producción. */
  modo?: "pdv" | "monitor";
}

export function equipoGuardado(): EquipoGuardado | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_EQUIPO) ?? "null");
  } catch {
    return null;
  }
}

export function guardarEquipo(e: EquipoGuardado | null) {
  if (e) localStorage.setItem(CLAVE_EQUIPO, JSON.stringify(e));
  else localStorage.removeItem(CLAVE_EQUIPO);
}

export const tokenPersonal = () => localStorage.getItem(CLAVE_SESION);
export const guardarTokenPersonal = (t: string | null) =>
  t ? localStorage.setItem(CLAVE_SESION, t) : localStorage.removeItem(CLAVE_SESION);

export function crearApiSalon(uuid: string, modo: "dueno" | "personal", alSalir?: () => void): AxiosInstance {
  const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/b/${uuid}/salon` });
  api.interceptors.request.use((config) => {
    const token = modo === "dueno" ? localStorage.getItem("token") : tokenPersonal();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  api.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error.response?.status === 401 && modo === "personal") {
        guardarTokenPersonal(null);
        alSalir?.();
      }
      return Promise.reject(error);
    }
  );
  return api;
}

export const apiPublica = axios.create({ baseURL: import.meta.env.VITE_API_URL });

/** Mensaje legible de un error de la API. */
export function mensajeError(e: unknown, porDefecto = "No se pudo completar") {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message ?? (err?.response ? porDefecto : "Sin conexión. Revisa tus datos o el Wi‑Fi.");
}

// ---- tipos

export type Servicio = "comedor" | "para_llevar" | "delivery";
export const NOMBRE_SERVICIO: Record<Servicio, string> = {
  comedor: "Comedor",
  para_llevar: "Para llevar",
  delivery: "Delivery",
};

export interface ResumenCuenta {
  id: number;
  propia: boolean;
  visible: boolean;
  mesero: string | null;
  service: Servicio;
  etiqueta: string;
  /** Cliente asignado (o nombre escrito al abrir), aparte del nombre de la cuenta. */
  cliente: string | null;
  telefono: string | null;
  accountStatus: "abierta" | "impresa" | "reabierta" | null;
  folio: string | null;
  total: number | null;
  guests: number | null;
  items: number;
  /** Platos que cocina ya terminó y faltan llevar. */
  listos: number;
  abiertaDesde: string;
  mesa: string | null;
  mesaId: number | null;
  status?: string;
}

export interface Mesa {
  id: number;
  name: string;
  zone: string | null;
  seats: number | null;
  estado: "libre" | "ocupada" | "impresa" | "por_liberar";
  cuenta: ResumenCuenta | null;
}

export interface GrupoMod {
  groupId: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { id: number; name: string; priceDelta: number }[];
}

export interface Plato {
  id: number;
  name: string;
  imageUrl: string | null;
  price: number;
  categoryIds: number[];
  modifierGroups: GrupoMod[];
}

export interface Carta {
  categorias: { id: number; name: string }[];
  platos: Plato[];
}

export interface ItemCuenta {
  id: number;
  roundId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
  area: string | null;
  modifiers: { name: string; quantity: number }[];
  voided: boolean;
  voidReason: string | null;
  courtesy: boolean;
  courtesyReason: string | null;
  kitchenStatus: "pendiente" | "preparando" | "listo" | "servido" | null;
}

export interface Cuenta {
  id: number;
  code: string;
  status: string;
  accountStatus: "abierta" | "impresa" | "reabierta" | null;
  service: Servicio;
  etiqueta: string;
  accountName: string | null;
  cliente: string | null;
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  mesero: string | null;
  folio: string | null;
  printCount: number;
  discountReason: string | null;
  mesa: { id: number | null; name: string | null };
  guests: number | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  documento: string | null;
  abiertaDesde: string;
  rondas: { id: number; number: number; userName: string | null; createdAt: string }[];
  items: ItemCuenta[];
  payments: { method: string; amount: number; cobradoPor: string | null }[];
  vuelto?: number;
}

export type Permisos = Record<string, boolean | number | string>;

export interface Yo {
  name: string;
  role: "dueno" | "cajero" | "mesero" | "gerente";
  permisos: Permisos;
  caja: { id: number; name: string } | null;
  servicios: Record<Servicio, boolean>;
  inactividadSegundos: number;
  liberarMesaManual: boolean;
  negocio: { name: string; uuid: string; simbolo: string };
}

/** ¿El actor tiene el permiso? (los "alcance" se consultan por valor). */
export const puede = (yo: Yo | null, p: string) => yo?.permisos?.[p] === true;

/** Línea del carrito de la comanda (aún no enviada). */
export interface LineaCarrito {
  key: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  note: string;
  options: { optionId: number; quantity: number; name: string; priceDelta: number }[];
}
