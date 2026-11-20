import axios, { type AxiosInstance } from "axios";

/**
 * Cliente del PDV de salón. Lo usan el dueño (con su sesión del panel) y el
 * personal (token propio guardado por negocio, separado del del dueño para
 * que un mismo celular pueda tener las dos sesiones sin pisarse).
 */
export const claveTokenPersonal = (uuid: string) => `pdv_token_${uuid}`;

export function tokenPersonal(uuid: string) {
  return localStorage.getItem(claveTokenPersonal(uuid));
}

export function crearApiSalon(uuid: string, modo: "dueno" | "personal", alSalir?: () => void): AxiosInstance {
  const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/b/${uuid}/salon` });
  api.interceptors.request.use((config) => {
    const token = modo === "dueno" ? localStorage.getItem("token") : tokenPersonal(uuid);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  api.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error.response?.status === 401 && modo === "personal") {
        localStorage.removeItem(claveTokenPersonal(uuid));
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

export interface Mesa {
  id: number;
  name: string;
  zone: string | null;
  seats: number | null;
  cuenta: {
    id: number;
    code: string;
    total: number;
    guests: number | null;
    items: number;
    abiertaDesde: string;
    mesero: string | null;
  } | null;
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
}

export interface Cuenta {
  id: number;
  code: string;
  status: string;
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
  payments: { method: string; amount: number }[];
  vuelto?: number;
}

export interface Yo {
  name: string;
  role: "dueno" | "cajero" | "mesero";
  puedeCobrar: boolean;
  negocio: { name: string; uuid: string; simbolo: string };
}

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
