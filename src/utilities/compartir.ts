import { message } from "antd";

/** Copia al portapapeles; con un respaldo para páginas sin acceso seguro. */
export async function copiarEnlace(url: string) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const t = document.createElement("textarea");
    t.value = url;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
  }
  message.success("Enlace copiado");
}

/** Hoja de compartir del celular (WhatsApp, Instagram…); si no existe, copia. */
export async function compartirEnlace(url: string, titulo: string) {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: titulo, text: titulo, url });
    } catch {
      /* el usuario cerró la hoja: no es un error */
    }
    return;
  }
  await copiarEnlace(url);
}

export const puedeCompartir = () => typeof navigator !== "undefined" && "share" in navigator;

/** Enlace público de un producto o de una categoría de la tienda. */
export const urlProducto = (slugTienda: string, slugProducto: string) =>
  `${window.location.origin}/t/${slugTienda}/p/${slugProducto}`;

export const urlCategoria = (slugTienda: string, slugCategoria: string) =>
  `${window.location.origin}/t/${slugTienda}?category=${encodeURIComponent(slugCategoria)}`;
