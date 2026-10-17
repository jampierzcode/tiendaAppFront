import type { AxiosInstance } from "axios";

/**
 * Avisos push del navegador (Web Push). Funcionan con la pestaña en segundo
 * plano o cerrada: el servidor manda el aviso y el service worker lo muestra.
 */
export const pushSoportado = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const aBytes = (base64: string) => {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
};

/**
 * Registra el service worker y suscribe este navegador. `pedirPermiso` solo
 * debe ser true desde un clic del usuario; con false solo renueva la
 * suscripción si el permiso ya estaba dado.
 */
export async function activarPush(
  api: AxiosInstance,
  prefijo: string,
  headers: Record<string, string> = {},
  pedirPermiso = false
): Promise<"activo" | "denegado" | "no-soportado" | "sin-servidor"> {
  if (!pushSoportado()) return "no-soportado";

  if (Notification.permission === "default" && pedirPermiso) await Notification.requestPermission();
  if (Notification.permission === "denied") return "denegado";
  if (Notification.permission !== "granted") return "denegado";

  try {
    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const r = await api.get<{ data: { key: string } }>(`${prefijo}/push/key`, { headers });
    let sub = await registro.pushManager.getSubscription();
    if (!sub) {
      sub = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: aBytes(r.data.data.key),
      });
    }
    await api.post(`${prefijo}/push/subscribe`, sub.toJSON(), { headers });
    return "activo";
  } catch {
    // Sin claves en el servidor o navegador sin soporte completo.
    return "sin-servidor";
  }
}

/** Escucha lo que manda el service worker: refrescar al llegar un aviso o navegar al tocarlo. */
export function escucharServiceWorker(alAviso: () => void, alIr?: (ruta: string) => void) {
  if (!("serviceWorker" in navigator)) return () => undefined;
  const alMensaje = (e: MessageEvent) => {
    if (e.data?.tipo === "push") alAviso();
    if (e.data?.tipo === "ir" && alIr) {
      const url = new URL(e.data.url);
      alIr(url.pathname + url.search);
    }
  };
  navigator.serviceWorker.addEventListener("message", alMensaje);
  return () => navigator.serviceWorker.removeEventListener("message", alMensaje);
}
