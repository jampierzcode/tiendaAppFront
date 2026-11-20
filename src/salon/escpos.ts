/* eslint-disable @typescript-eslint/no-explicit-any -- el payload lo arma el backend y varía por tipo de ticket. */
/**
 * Convierte un trabajo de impresión (lo que arma el backend) en bytes ESC/POS
 * para impresoras térmicas de 58 u 80 mm.
 *
 * Se quitan las tildes: muchas impresoras chinas baratas no traen la página
 * de códigos latina y imprimen basura con "á" o "ñ". Mejor "Ceviche mixto"
 * legible que "Ceviche mixto" con un símbolo raro.
 */

const ESC = 0x1b;
const GS = 0x1d;

export interface TrabajoImpresion {
  id: number;
  kind: "comanda" | "anulacion" | "precuenta" | "nota_venta" | "prueba";
  printerId: number | null;
  payload: Record<string, any>;
}

function sinTildes(t: string) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .replace(/[^\x20-\x7e\n]/g, "");
}

class Ticket {
  private bytes: number[] = [];
  constructor(public ancho: number) {
    this.raw(ESC, 0x40); // reiniciar
  }
  raw(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }
  texto(t: string) {
    for (const c of sinTildes(t)) this.bytes.push(c.charCodeAt(0));
    return this;
  }
  linea(t = "") {
    return this.texto(t).raw(0x0a);
  }
  centro() {
    return this.raw(ESC, 0x61, 1);
  }
  izquierda() {
    return this.raw(ESC, 0x61, 0);
  }
  negrita(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** 0 normal · 1 doble alto · 2 doble alto y ancho */
  tamano(n: 0 | 1 | 2) {
    return this.raw(GS, 0x21, n === 0 ? 0x00 : n === 1 ? 0x01 : 0x11);
  }
  separador(c = "-") {
    return this.linea(c.repeat(this.ancho));
  }
  /** Texto a la izquierda y monto a la derecha en la misma línea. */
  dosColumnas(izq: string, der: string, ancho = this.ancho) {
    const d = sinTildes(der);
    const maxIzq = ancho - d.length - 1;
    const partes = envolver(sinTildes(izq), maxIzq);
    partes.forEach((p, i) => {
      if (i === partes.length - 1) this.linea(p + " ".repeat(Math.max(1, ancho - p.length - d.length)) + d);
      else this.linea(p);
    });
    return this;
  }
  /** Avanza papel y corta (las que no tienen cuchilla lo ignoran). */
  cortar() {
    return this.raw(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00);
  }
  build() {
    return new Uint8Array(this.bytes);
  }
}

function envolver(t: string, ancho: number): string[] {
  const palabras = t.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if ((actual + " " + p).trim().length > ancho) {
      if (actual) lineas.push(actual);
      actual = p.length > ancho ? p.slice(0, ancho) : p;
    } else actual = (actual + " " + p).trim();
  }
  if (actual || !lineas.length) lineas.push(actual);
  return lineas;
}

const dinero = (s: string, n: number) => `${s} ${Number(n ?? 0).toFixed(2)}`;

const METODO: Record<string, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

export function ticketEscPos(job: TrabajoImpresion, papelMm: number): Uint8Array {
  const t = new Ticket(papelMm >= 80 ? 48 : 32);
  const p = job.payload ?? {};

  if (job.kind === "prueba") {
    t.centro().tamano(2).linea("PRUEBA").tamano(0).linea(p.negocio ?? "").linea("Impresora lista").linea(p.hora ?? "");
    return t.cortar().build();
  }

  if (job.kind === "comanda" || job.kind === "anulacion") {
    const anul = job.kind === "anulacion";
    t.centro().negrita(true).tamano(1).linea(anul ? "*** ANULACION ***" : String(p.area ?? "COMANDA").toUpperCase());
    t.tamano(2).linea(`MESA ${p.mesa ?? ""}`).tamano(0).negrita(false);
    t.linea(`${p.hora ?? ""}${p.ronda ? `  Ronda ${p.ronda}` : ""}`);
    t.linea(`${anul ? "Anulo" : "Mozo"}: ${p.mesero ?? ""}`).izquierda().separador();
    for (const it of p.items ?? []) {
      t.negrita(true).tamano(1);
      for (const l of envolver(sinTildes(`${it.cantidad} x ${it.nombre}`), t.ancho)) t.linea(l);
      t.tamano(0).negrita(false);
      for (const o of it.opciones ?? []) t.linea(`   + ${o}`);
      if (it.nota) t.negrita(true).linea(`   >> ${it.nota}`).negrita(false);
    }
    if (anul && p.motivo) t.separador().linea(`Motivo: ${p.motivo}`);
    t.separador().linea(`Cuenta ${p.cuenta ?? ""}`);
    return t.cortar().build();
  }

  // precuenta y nota de venta
  const s = p.simbolo ?? "S/";
  const esNota = job.kind === "nota_venta";
  t.centro().negrita(true).tamano(1).linea(p.negocio ?? "").tamano(0).negrita(false);
  if (p.direccion) t.linea(p.direccion);
  if (p.telefono) t.linea(`Tel. ${p.telefono}`);
  t.separador();
  t.negrita(true).linea(esNota ? `NOTA DE VENTA ${p.documento ?? ""}` : "PRECUENTA").negrita(false);
  t.linea(`Mesa ${p.mesa ?? ""}   ${p.hora ?? ""}`).izquierda().separador();
  for (const l of p.lineas ?? []) t.dosColumnas(`${l.cantidad} ${l.nombre}`, dinero(s, l.total));
  t.separador();
  if (Number(p.descuento) > 0) {
    t.dosColumnas("Subtotal", dinero(s, p.subtotal));
    t.dosColumnas("Descuento", `-${dinero(s, p.descuento)}`);
  }
  t.negrita(true).tamano(1).dosColumnas("TOTAL", dinero(s, p.total)).tamano(0).negrita(false);
  if (esNota) {
    for (const pg of p.pagos ?? []) t.dosColumnas(METODO[pg.method] ?? pg.method, dinero(s, pg.amount));
    if (Number(p.vuelto) > 0) t.dosColumnas("Vuelto", dinero(s, p.vuelto));
  } else {
    t.linea().centro().linea("Documento no valido como comprobante");
  }
  t.centro().linea().linea("Gracias por su visita");
  return t.cortar().build();
}
