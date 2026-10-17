import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/** Hojas habituales, en milímetros (ancho × alto, vertical). */
export const PAPELES = {
  a5: { nombre: "A5", ancho: 148, alto: 210 },
  a4: { nombre: "A4", ancho: 210, alto: 297 },
  a3: { nombre: "A3", ancho: 297, alto: 420 },
  carta: { nombre: "Carta", ancho: 215.9, alto: 279.4 },
  oficio: { nombre: "Oficio", ancho: 215.9, alto: 330.2 },
} as const;

export type PapelId = keyof typeof PAPELES;

/** Margen libre entre el borde de la hoja y la tarjeta, en mm. */
const MARGEN_HOJA = 8;

export interface OpcionesCartel {
  papel: PapelId;
  /** Medidas de la tarjeta en centímetros; se recortan a lo que cabe en la hoja. */
  tarjetaAnchoCm: number;
  tarjetaAltoCm: number;
  /** Lado del QR en centímetros; se recorta al máximo que cabe en la tarjeta. */
  qrCm: number;
  /** Ancho máximo del logo en centímetros (la altura sigue su proporción, con tope). */
  logoAnchoCm: number;
  url: string;
  nombre: string;
  logoUrl: string | null;
  portadaUrl: string | null;
  /** Cuánto color de portada se mezcla sobre la portada, de 0 (foto limpia) a 1. */
  portadaColor: number;
  /** Si se pasa, aquí se anota lo que no se pudo dibujar (imágenes que no cargan). */
  avisos?: string[];
  colorPrincipal: string;
  colorSecundario: string;
  /** Fondo de la tarjeta y color del nombre. */
  colorFondo: string;
  /** Color de la franja de portada (y del tinte sobre la foto). */
  colorPortada: string;
  colorTexto: string;
}

/** Tarjeta más grande (cm) que cabe en la hoja. */
export function maxTarjetaCm(papel: PapelId) {
  const { ancho, alto } = PAPELES[papel];
  return {
    ancho: Math.floor(ancho - 2 * MARGEN_HOJA) / 10,
    alto: Math.floor(alto - 2 * MARGEN_HOJA) / 10,
  };
}

/** Medidas internas de la tarjeta (mm); todo sale de su ancho y su alto. */
function medidasTarjeta(anchoCm: number, altoCm: number) {
  const w = anchoCm * 10;
  const h = altoCm * 10;
  const pad = w * 0.07;
  const hueco = h * 0.025;
  const logo = h * 0.18;
  const nombre = w * 0.055;
  const portada = h * 0.17;
  const maxQrMm = Math.min(w - 2 * pad, h - pad - logo - nombre - portada - 4 * hueco);
  return { w, h, pad, hueco, logo, nombre, portada, maxQrMm };
}

/** Lado máximo del QR (cm) que cabe en esa tarjeta. */
export function maxQrCm(anchoCm: number, altoCm: number) {
  return Math.max(2, Math.floor(medidasTarjeta(anchoCm, altoCm).maxQrMm) / 10);
}

const rgb = (hex: string): [number, number, number] => {
  const limpio = hex.replace("#", "");
  const c = limpio.length === 3 ? limpio.split("").map((x) => x + x).join("") : limpio.padEnd(6, "0");
  return [parseInt(c.slice(0, 2), 16) || 0, parseInt(c.slice(2, 4), 16) || 0, parseInt(c.slice(4, 6), 16) || 0];
};

/**
 * La imagen se pasa por un canvas: jsPDF no entiende webp y así todo sale como PNG.
 * Con `proporcion` (ancho/alto) se recorta al centro para llenar ese rectángulo.
 */
async function cargarImagen(
  url: string,
  proporcion?: number,
  /** Color que se mezcla encima con "multiply" y algo de transparencia. */
  tinte?: string,
  intensidad = 0.85
): Promise<{ data: string; w: number; h: number } | { error: string }> {
  try {
    // "reload": una copia cacheada por un <img> no trae cabeceras CORS y haría fallar el fetch.
    const r = await fetch(url, { cache: "reload" });
    if (!r.ok) return { error: `el servidor respondió ${r.status}` };
    const bmp = await decodificar(await r.blob());
    let sw = bmp.width;
    let sh = bmp.height;
    let sx = 0;
    let sy = 0;
    if (proporcion) {
      if (sw / sh > proporcion) {
        sw = sh * proporcion;
        sx = (bmp.width - sw) / 2;
      } else {
        sh = sw / proporcion;
        sy = (bmp.height - sh) / 2;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (tinte) {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = intensidad;
      ctx.fillStyle = tinte;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return { data: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch (e) {
    console.warn("No se pudo cargar la imagen del cartel", url, e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Decodifica con <img> (acepta avif/webp en más navegadores que createImageBitmap). */
async function decodificar(blob: Blob): Promise<{ width: number; height: number } & CanvasImageSource> {
  const src = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } catch {
    return await createImageBitmap(blob);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export async function crearCartel(op: OpcionesCartel): Promise<jsPDF> {
  const { ancho: W, alto: H } = PAPELES[op.papel];
  const tope = maxTarjetaCm(op.papel);
  const anchoCm = Math.min(Math.max(op.tarjetaAnchoCm, 4), tope.ancho);
  const altoCm = Math.min(Math.max(op.tarjetaAltoCm, 6), tope.alto);
  const m = medidasTarjeta(anchoCm, altoCm);
  const qrMm = Math.min(Math.max(op.qrCm, 2) * 10, m.maxQrMm);

  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait", compress: true });
  const x0 = (W - m.w) / 2;
  const y0 = (H - m.h) / 2;

  const fondo = rgb(op.colorFondo || "#FFFFFF");
  const texto = rgb(op.colorTexto || "#151243");
  // El QR lleva siempre el color de las letras: si ese cambia, el QR cambia con él.
  const secundario = texto;
  const mmAPt = (mm: number) => (mm * 72) / 25.4;

  // Fondo de la tarjeta
  doc.setFillColor(...fondo);
  doc.rect(x0, y0, m.w, m.h, "F");

  // Portada al pie (se recorta al centro); sin portada, una banda del color principal.
  const yPortada = y0 + m.h - m.portada;
  const resPortada = op.portadaUrl
    ? await cargarImagen(op.portadaUrl, m.w / m.portada, op.colorPortada || op.colorPrincipal || "#4F46E5", op.portadaColor)
    : null;
  const portada = resPortada && "data" in resPortada ? resPortada : null;
  if (!op.portadaUrl) op.avisos?.push("La tienda no tiene imagen de portada.");
  else if (resPortada && "error" in resPortada) op.avisos?.push(`No se pudo cargar la portada: ${resPortada.error}`);
  if (portada) {
    doc.addImage(portada.data, "PNG", x0, yPortada, m.w, m.portada);
  } else {
    doc.setFillColor(...rgb(op.colorPortada || op.colorPrincipal || "#4F46E5"));
    doc.rect(x0, yPortada, m.w, m.portada, "F");
  }

  // Logo centrado arriba
  let y = y0 + m.pad;
  const resLogo = op.logoUrl ? await cargarImagen(op.logoUrl) : null;
  const logo = resLogo && "data" in resLogo ? resLogo : null;
  if (resLogo && "error" in resLogo) op.avisos?.push(`No se pudo cargar el logo: ${resLogo.error}`);
  if (logo) {
    let w = Math.min(Math.max(op.logoAnchoCm, 1) * 10, m.w - 2 * m.pad);
    let h = w * (logo.h / logo.w);
    if (h > m.logo) {
      h = m.logo;
      w = h * (logo.w / logo.h);
    }
    doc.addImage(logo.data, "PNG", x0 + (m.w - w) / 2, y + (m.logo - h) / 2, w, h);
  }
  y += m.logo + m.hueco;

  // Nombre en letra pequeña
  doc.setTextColor(...texto);
  doc.setFont("helvetica", "bold");
  let fuente = mmAPt(m.nombre);
  doc.setFontSize(fuente);
  while (doc.getTextWidth(op.nombre) > m.w - 2 * m.pad && fuente > 6) {
    fuente -= 0.5;
    doc.setFontSize(fuente);
  }
  doc.text(op.nombre, x0 + m.w / 2, y + m.nombre / 2, { align: "center", baseline: "middle" });
  y += m.nombre + m.hueco;

  // QR centrado en el espacio libre entre el nombre y la portada
  const libre = yPortada - m.hueco - y;
  const yQr = y + (libre - qrMm) / 2;
  const xQr = x0 + (m.w - qrMm) / 2;
  const qr = QRCode.create(op.url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const celda = qrMm / n;
  doc.setFillColor(...secundario);
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(f, c)) {
        // Un pelo más grande para que no queden líneas blancas entre módulos.
        doc.rect(xQr + c * celda, yQr + f * celda, celda + 0.02, celda + 0.02, "F");
      }
    }
  }

  // Línea punteada de corte alrededor de la tarjeta
  doc.setDrawColor(120, 120, 140);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.rect(x0, y0, m.w, m.h, "S");
  doc.setLineDashPattern([], 0);

  return doc;
}

/** Ancho máximo del logo (cm) para esa tarjeta. */
export function maxLogoCm(anchoCm: number) {
  return Math.floor(anchoCm * 10 * 0.86) / 10;
}
