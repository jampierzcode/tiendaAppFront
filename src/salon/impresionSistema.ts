import { vistaPrevia, type TrabajoImpresion } from "./escpos";

/**
 * Impresión por la impresora instalada en la PC (USB o de red) usando el
 * diálogo de impresión del navegador. Con Chrome abierto con
 * `--kiosk-printing` no aparece el diálogo: sale directo por la impresora
 * predeterminada de Windows. Sirve para una caja con su impresora; para
 * varias impresoras de red por área hará falta el agente local.
 */
export function imprimirSistema(job: TrabajoImpresion, papelMm: number): Promise<void> {
  const { lineas } = vistaPrevia(job, papelMm);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const cuerpo = lineas
    .map((l) => {
      const tam = l.tamano === 3 ? "17px" : l.tamano === 2 ? "14px" : "11px";
      return `<div style="font-size:${tam};font-weight:${l.negrita ? 700 : 400};text-align:${
        l.alinear === "centro" ? "center" : "left"
      };${l.tamano === 2 ? "transform:scaleY(1.4);margin:2px 0;" : ""}">${esc(l.texto) || "&nbsp;"}</div>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${papelMm}mm auto; margin: 0 }
    body { margin: 0; padding: 2mm 3mm; width: ${papelMm - 6}mm; font-family: "Courier New", monospace; white-space: pre; line-height: 1.25; color: #000 }
  </style></head><body>${cuerpo}</body></html>`;

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    const listo = () => {
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 500);
    };
    setTimeout(() => {
      try {
        iframe.contentWindow?.addEventListener("afterprint", listo, { once: true });
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        // Algunos navegadores no disparan afterprint: se suelta igual.
        setTimeout(listo, 4000);
      }
    }, 150);
  });
}
