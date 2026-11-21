/**
 * En móvil las pestañas de antd se deslizan con scroll nativo (ver index.css).
 * Pero rc-tabs, al enfocar una pestaña, hace `nav-wrap.scrollLeft = 0`: al
 * tocar una pestaña la barra saltaba al inicio y el toque caía en otra.
 *
 * Guardamos el scroll antes del handler de React (focusin en captura, en
 * window) y lo restauramos justo después (focusin en burbuja, en window), todo
 * síncrono para que el clic que sigue caiga sobre la pestaña tocada.
 */
export function arreglarPestanasDeslizables() {
  let wrap: HTMLElement | null = null;
  let scrollPrevio = 0;

  window.addEventListener(
    "focusin",
    (e) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      const w = el?.closest<HTMLElement>(".ant-tabs-nav-wrap") ?? null;
      wrap = w && getComputedStyle(w).overflowX === "auto" ? w : null;
      scrollPrevio = wrap?.scrollLeft ?? 0;
    },
    true,
  );

  window.addEventListener("focusin", (e) => {
    if (!wrap) return;
    const w = wrap;
    wrap = null;
    w.scrollLeft = scrollPrevio;
    // Si la pestaña quedó cortada en un borde, la traemos a la vista.
    const tab = (e.target as HTMLElement).closest<HTMLElement>(".ant-tabs-tab");
    if (!tab) return;
    const rw = w.getBoundingClientRect();
    const rt = tab.getBoundingClientRect();
    const margen = 16;
    if (rt.left < rw.left) w.scrollBy({ left: rt.left - rw.left - margen, behavior: "smooth" });
    else if (rt.right > rw.right) w.scrollBy({ left: rt.right - rw.right + margen, behavior: "smooth" });
  });
}
