import QRCode from "qrcode";

export interface DatosEtiqueta {
  tienda: string;
  codigo: string;
  cliente: string;
  telefono: string | null;
  destino: string;
  nota: string | null;
  empresa: string | null;
  guia: string | null;
  agencia: string | null;
  enlace: string;
  total: string;
  porCobrar: string | null;
}

const esc = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Etiqueta de 80 mm para pegar en el paquete. Se imprime desde el navegador
 * (ticketera térmica o impresora normal). El QR abre el seguimiento del
 * pedido; el código grande sirve para buscarlo en el panel.
 */
export async function imprimirEtiqueta(d: DatosEtiqueta) {
  const qr = await QRCode.toDataURL(d.enlace, { margin: 0, width: 220 });
  const fila = (k: string, v: string | null) =>
    v ? `<div class="f"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ${esc(d.codigo)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; width: 74mm; margin: 0 auto; color: #000; }
  .t { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }
  .c { text-align: center; font-size: 26px; font-weight: 800; letter-spacing: 1px; margin: 4px 0; font-family: monospace; }
  .qr { display: block; margin: 4px auto; width: 34mm; height: 34mm; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .f { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; margin: 2px 0; }
  .f span { color: #333; white-space: nowrap; }
  .f b { text-align: right; word-break: break-word; }
  .dest { font-size: 14px; font-weight: 700; margin: 4px 0; }
  .nota { font-size: 11px; margin-top: 4px; }
  .cobrar { border: 2px solid #000; text-align: center; font-size: 15px; font-weight: 800; padding: 4px; margin-top: 6px; }
</style></head><body>
  <div class="t">${esc(d.tienda)}</div>
  <div class="c">${esc(d.codigo)}</div>
  <img class="qr" src="${qr}" alt="">
  <hr>
  <div class="dest">${esc(d.cliente)}</div>
  ${fila("Teléfono", d.telefono)}
  ${fila("Destino", d.destino)}
  ${fila("Envío por", d.empresa)}
  ${fila("Agencia", d.agencia)}
  ${fila("Guía", d.guia)}
  ${fila("Total", d.total)}
  ${d.nota ? `<div class="nota">${esc(d.nota)}</div>` : ""}
  ${d.porCobrar ? `<div class="cobrar">COBRAR ${esc(d.porCobrar)}</div>` : ""}
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) throw new Error("El navegador bloqueó la ventana de impresión");
  w.document.open();
  w.document.write(html);
  w.document.close();
}
