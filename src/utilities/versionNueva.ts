import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Es una SPA: una pestaña abierta antes de un despliegue sigue con el código
 * viejo (menús, candados y pantallas de antes) hasta que alguien recargue.
 * Cada cierto tiempo, y al volver a la pestaña, miramos qué bundle sirve el
 * index.html; si cambió, recargamos en el siguiente cambio de pantalla, nunca
 * a media acción.
 */
const bundleDe = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null;

export function useVersionNueva() {
  const { pathname } = useLocation();
  const hayNueva = useRef(false);
  const primeraRuta = useRef(true);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const actual = bundleDe(document.documentElement.innerHTML);
    if (!actual) return;

    const revisar = async () => {
      if (hayNueva.current) return;
      try {
        const r = await fetch("/", { cache: "no-store" });
        const publicado = bundleDe(await r.text());
        if (publicado && publicado !== actual) hayNueva.current = true;
      } catch {
        /* sin red: se vuelve a intentar luego */
      }
    };
    const alVolver = () => document.visibilityState === "visible" && void revisar();

    const id = window.setInterval(revisar, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  useEffect(() => {
    if (primeraRuta.current) {
      primeraRuta.current = false;
      return;
    }
    if (hayNueva.current) window.location.reload();
  }, [pathname]);
}
