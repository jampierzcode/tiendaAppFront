import { useCallback, useState } from "react";

const soportado = () => typeof window !== "undefined" && "Notification" in window;

/** Pitido corto; el navegador lo bloquea si el usuario aún no interactuó. */
export function pitar() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    // sin audio: queda la notificación visual
  }
}

/** Notificación del navegador, solo si el usuario ya dio permiso. */
export function avisar(titulo: string, cuerpo: string, etiqueta?: string) {
  pitar();
  if (!soportado() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(titulo, { body: cuerpo, tag: etiqueta });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // algunos navegadores móviles exigen service worker; el pitido ya sonó
  }
}

/** Estado del permiso y botón para pedirlo (requiere un clic del usuario). */
export function usePermisoAvisos() {
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">(
    soportado() ? Notification.permission : "no-soportado"
  );
  const pedir = useCallback(async () => {
    if (!soportado()) return;
    setPermiso(await Notification.requestPermission());
  }, []);
  return { permiso, pedir };
}
