import { useCallback, useState } from "react";

const soportado = () => typeof window !== "undefined" && "Notification" in window;

/**
 * Un solo AudioContext para toda la app. El navegador lo deja sonar recién
 * después de un toque del usuario: `desbloquearAudio` se engancha al primer
 * toque para que los avisos posteriores suenen solos.
 */
let ctxAudio: AudioContext | null = null;
const audio = () => {
  if (!ctxAudio) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctxAudio = new Ctx();
  }
  if (ctxAudio.state === "suspended") void ctxAudio.resume();
  return ctxAudio;
};

export function desbloquearAudio() {
  const alTocar = () => {
    try {
      audio();
      // La voz también necesita un primer uso dentro de un toque (iOS).
      if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch {
      /* sin audio */
    }
  };
  window.addEventListener("pointerdown", alTocar, { once: true });
  return () => window.removeEventListener("pointerdown", alTocar);
}

/** «Ding-dong» corto (dos notas), sin archivos de audio. */
export function pitar() {
  try {
    const ctx = audio();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t);
      o.stop(t + 0.32);
    });
  } catch {
    // sin audio: queda la notificación visual
  }
}

/**
 * Dice el texto en voz alta, como el «¡Yape!» de cada pago. Usa la voz en
 * español del sistema; si no hay, el pitido ya avisó.
 */
export function decir(texto: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-PE";
    const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
    if (voz) u.voice = voz;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {
    // sin voz: queda el pitido
  }
}

/**
 * ¿Este aviso ya sonó hace poco? Lo comparten todas las pestañas del mismo
 * navegador (localStorage): con el panel y el PDV abiertos, o la campana y el
 * PDV en la misma pantalla, un pedido suena una sola vez.
 */
function yaAvisado(etiqueta: string) {
  try {
    const clave = `aviso:${etiqueta}`;
    const antes = Number(localStorage.getItem(clave) ?? 0);
    if (Date.now() - antes < 60_000) return true;
    localStorage.setItem(clave, String(Date.now()));
    // Limpieza: no dejar claves viejas acumuladas.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("aviso:") && Date.now() - Number(localStorage.getItem(k)) > 10 * 60_000) localStorage.removeItem(k);
    }
  } catch {
    // sin almacenamiento: mejor avisar de más que de menos
  }
  return false;
}

/**
 * Notificación del navegador, solo si el usuario ya dio permiso. Se muestra
 * por el service worker cuando existe: en Android `new Notification` no está
 * permitido y el aviso no salía. Con `voz`, además lo dice en voz alta.
 */
export function avisar(titulo: string, cuerpo: string, etiqueta?: string, ruta?: string, voz?: string) {
  if (etiqueta && yaAvisado(etiqueta)) return;
  pitar();
  if (voz) decir(voz);
  if (!soportado() || Notification.permission !== "granted") return;
  const destino = ruta ? new URL(ruta, window.location.origin).href : window.location.href;
  const conPagina = () => {
    try {
      const n = new Notification(titulo, { body: cuerpo, tag: etiqueta });
      n.onclick = () => {
        window.focus();
        // La app es una SPA: se navega sin recargar (React Router escucha popstate).
        if (ruta && window.location.pathname + window.location.search !== ruta) {
          window.history.pushState({}, "", ruta);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
        n.close();
      };
    } catch {
      // el pitido ya sonó
    }
  };
  if (!("serviceWorker" in navigator)) return conPagina();
  navigator.serviceWorker
    .getRegistration()
    .then((reg) =>
      reg
        ? reg.showNotification(titulo, { body: cuerpo, tag: etiqueta, data: { url: destino }, icon: "/pdv-192.png" })
        : conPagina()
    )
    .catch(conPagina);
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
