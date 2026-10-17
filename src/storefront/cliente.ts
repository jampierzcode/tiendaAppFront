import { useEffect, useState } from "react";
import { storeApi } from "./api";

/**
 * Sesión del cliente de la tienda. Vive en su propia clave, aparte del token
 * del panel: una persona puede ser dueña de un negocio y clienta de otro sin
 * que una sesión pise a la otra.
 */
const CLAVE = "cliente:token";
const EVENTO = "cliente:cambio";

export const leerTokenCliente = () => {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
};

export const guardarTokenCliente = (token: string | null) => {
  try {
    if (token) localStorage.setItem(CLAVE, token);
    else localStorage.removeItem(CLAVE);
  } catch {
    // almacenamiento bloqueado: la sesión dura lo que dure la pestaña
  }
  window.dispatchEvent(new Event(EVENTO));
};

export const cabeceraCliente = () => {
  const t = leerTokenCliente();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** Código de un solo uso de cada pedido, para crear la cuenta después. */
const claveClaim = (slug: string, code: string) => `claim:${slug}:${code}`;
export const guardarClaim = (slug: string, code: string, token: string) => {
  try {
    localStorage.setItem(claveClaim(slug, code), token);
  } catch {
    // sin almacenamiento: el estado de navegación todavía lo lleva
  }
};
export const leerClaim = (slug: string, code: string) => {
  try {
    return localStorage.getItem(claveClaim(slug, code));
  } catch {
    return null;
  }
};
export const borrarClaim = (slug: string, code: string) => {
  try {
    localStorage.removeItem(claveClaim(slug, code));
  } catch {
    // nada
  }
};

export interface Cliente {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PerfilCambios {
  name?: string;
  phone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const EVENTO_PERFIL = "cliente:perfil";

export const actualizarPerfil = (cambios: PerfilCambios) =>
  storeApi
    .put<{ data: Cliente }>("/account/profile", cambios, { headers: cabeceraCliente() })
    .then((r) => {
      window.dispatchEvent(new Event(EVENTO_PERFIL));
      return r.data.data;
    });

/** Enlace de mapa para el negocio, a partir de la ubicación guardada. */
export const enlaceMapa = (c: Pick<Cliente, "latitude" | "longitude">) =>
  c.latitude !== null && c.longitude !== null
    ? `https://www.google.com/maps?q=${c.latitude},${c.longitude}`
    : null;

export interface PedidoCuenta {
  id: number;
  code: string;
  status: string;
  total: number;
  createdAt: string;
  storeName: string;
  storeSlug: string;
  storeLogo: string | null;
  currencySymbol: string;
  unreadMessages: number;
  lastMessage: string | null;
  lastDirection: "in" | "out" | null;
}

export const registrarCliente = (
  slug: string,
  d: { name: string; email: string; password: string; orderCode?: string; claimToken?: string }
) =>
  storeApi
    .post<{ data: { token: string; user: Cliente; ligado: boolean } }>(`/store/${slug}/account/register`, d)
    .then((r) => r.data.data);

export const entrarCliente = (d: {
  email: string;
  password: string;
  slug?: string;
  orderCode?: string;
  claimToken?: string;
}) => storeApi.post<{ data: { token: string; user: Cliente } }>("/account/login", d).then((r) => r.data.data);

export const miCuenta = () =>
  storeApi.get<{ data: Cliente }>("/account/me", { headers: cabeceraCliente() }).then((r) => r.data.data);

export const misPedidos = () =>
  storeApi
    .get<{ data: PedidoCuenta[] }>("/account/orders", { headers: cabeceraCliente() })
    .then((r) => r.data.data);

export const ligarPedido = (slug: string, orderCode: string, claimToken: string) =>
  storeApi.post("/account/link", { slug, orderCode, claimToken }, { headers: cabeceraCliente() });

/** Cliente con sesión (o null). Se actualiza al entrar o salir desde cualquier pestaña. */
export function useCliente() {
  const [token, setToken] = useState<string | null>(leerTokenCliente);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(Boolean(leerTokenCliente()));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const alCambiar = () => setToken(leerTokenCliente());
    window.addEventListener(EVENTO, alCambiar);
    window.addEventListener("storage", alCambiar);
    // Un cambio de perfil vuelve a pedir los datos en todos los que usan el hook.
    const alPerfil = () => setVersion((v) => v + 1);
    window.addEventListener(EVENTO_PERFIL, alPerfil);
    return () => {
      window.removeEventListener(EVENTO_PERFIL, alPerfil);
      window.removeEventListener(EVENTO, alCambiar);
      window.removeEventListener("storage", alCambiar);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setCliente(null);
      setCargando(false);
      return;
    }
    let vivo = true;
    miCuenta()
      .then((c) => vivo && setCliente(c))
      .catch(() => {
        // Token vencido o de otra cuenta: se descarta.
        if (vivo) {
          guardarTokenCliente(null);
          setCliente(null);
        }
      })
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [token, version]);

  return { cliente, cargando, salir: () => guardarTokenCliente(null) };
}

export const ligarPorTelefono = (slug: string, orderCode: string, phone: string) =>
  storeApi.post("/account/link", { slug, orderCode, phone }, { headers: cabeceraCliente() });

/**
 * Pedidos hechos en este navegador antes de tener cuenta: cada uno guardó su
 * código de un solo uso, así que al iniciar sesión se ligan solos.
 * Devuelve cuántos se ligaron.
 */
export async function ligarPedidosDeEsteNavegador(): Promise<number> {
  let claves: string[] = [];
  try {
    claves = Object.keys(localStorage).filter((k) => k.startsWith("claim:"));
  } catch {
    return 0;
  }
  let ligados = 0;
  for (const clave of claves) {
    const [, slug, code] = clave.split(":");
    const token = localStorage.getItem(clave);
    if (!slug || !code || !token) continue;
    try {
      await ligarPedido(slug, code, token);
      localStorage.removeItem(clave);
      ligados++;
    } catch {
      // Ese pedido ya es de otra cuenta o venció: se deja y no se insiste.
    }
  }
  return ligados;
}
