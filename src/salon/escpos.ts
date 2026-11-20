/* eslint-disable @typescript-eslint/no-explicit-any -- el payload lo arma el backend y varía por tipo de ticket. */
/**
 * Convierte un trabajo de impresión (lo que arma el backend) en bytes ESC/POS
 * para impresoras térmicas de 58 u 80 mm, aplicando el estilo del negocio
 * (tamaños, negrita, campos visibles, encabezado y pie).
 *
 * La misma rutina sirve para la vista previa en Infraestructura → Tickets:
 * cada línea queda anotada con su tamaño y alineación.
 *
 * Se quitan las tildes: muchas impresoras chinas baratas no traen la página
 * de códigos latina y imprimen basura con "á" o "ñ".
 */

const ESC = 0x1b;
const GS = 0x1d;

export interface TrabajoImpresion {
  id: number;
  kind: "comanda" | "anulacion" | "precuenta" | "nota_venta" | "cancelacion" | "prueba" | "corte_x" | "corte_z" | "corte_global";
  printerId: number | null;
  payload: Record<string, any>;
}

export interface LineaVista {
  texto: string;
  tamano: 1 | 2 | 3;
  negrita: boolean;
  alinear: "izq" | "centro";
}

interface Seccion {
  tamano?: 1 | 2 | 3;
  negrita?: boolean;
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
  readonly vista: LineaVista[] = [];
  private tam: 1 | 2 | 3 = 1;
  private neg = false;
  private ali: "izq" | "centro" = "izq";

  constructor(public ancho: number) {
    this.raw(ESC, 0x40); // reiniciar
  }
  raw(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }
  /** Columnas útiles con el tamaño actual (doble ancho = la mitad). */
  get cols() {
    return this.tam === 3 ? Math.floor(this.ancho / 2) : this.ancho;
  }
  linea(t = "") {
    const limpio = sinTildes(t);
    for (const c of limpio) this.bytes.push(c.charCodeAt(0));
    this.bytes.push(0x0a);
    this.vista.push({ texto: limpio, tamano: this.tam, negrita: this.neg, alinear: this.ali });
    return this;
  }
  /** Texto largo partido en varias líneas al ancho útil. */
  parrafo(t: string) {
    for (const l of envolver(sinTildes(t), this.cols)) this.linea(l);
    return this;
  }
  centro() {
    this.ali = "centro";
    return this.raw(ESC, 0x61, 1);
  }
  izquierda() {
    this.ali = "izq";
    return this.raw(ESC, 0x61, 0);
  }
  negrita(on: boolean) {
    this.neg = on;
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** 1 normal · 2 doble alto · 3 doble alto y ancho */
  tamano(n: 1 | 2 | 3) {
    this.tam = n;
    return this.raw(GS, 0x21, n === 1 ? 0x00 : n === 2 ? 0x01 : 0x11);
  }
  estilo(s?: Seccion) {
    return this.tamano(s?.tamano ?? 1).negrita(Boolean(s?.negrita));
  }
  normal() {
    return this.tamano(1).negrita(false);
  }
  separador(c = "-") {
    return this.linea(c.repeat(this.cols));
  }
  /** Texto a la izquierda y monto a la derecha en la misma línea. */
  dosColumnas(izq: string, der: string) {
    const ancho = this.cols;
    const d = sinTildes(der);
    const partes = envolver(sinTildes(izq), Math.max(4, ancho - d.length - 1));
    partes.forEach((p, i) => {
      if (i === partes.length - 1) this.linea(p + " ".repeat(Math.max(1, ancho - p.length - d.length)) + d);
      else this.linea(p);
    });
    return this;
  }
  /** Avanza papel y corta (las que no tienen cuchilla lo ignoran). */
  cortar() {
    this.raw(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00);
    return this;
  }
  build() {
    return new Uint8Array(this.bytes);
  }
}

function envolver(t: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of String(t).split("\n")) {
    let actual = "";
    for (const p of parrafo.split(/\s+/)) {
      if (!p) continue;
      if ((actual + " " + p).trim().length > ancho) {
        if (actual) lineas.push(actual);
        actual = p.length > ancho ? p.slice(0, ancho) : p;
      } else actual = (actual + " " + p).trim();
    }
    lineas.push(actual);
  }
  return lineas.length ? lineas : [""];
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
const nombreMetodo = (m: string) => METODO[m] ?? m;

const SERVICIO: Record<string, string> = { para_llevar: "PARA LLEVAR", delivery: "DELIVERY" };

/** Estilo efectivo del ticket: lo que mandó el backend o valores por defecto. */
function estiloDe(p: Record<string, any>) {
  const tipo = p.estilo?.tipo ?? {};
  const campos: Record<string, boolean> = tipo.campos ?? {};
  return {
    general: p.estilo?.general ?? {},
    titulo: (tipo.titulo ?? { tamano: 2, negrita: true }) as Seccion,
    detalle: (tipo.detalle ?? { tamano: 1, negrita: false }) as Seccion,
    total: (tipo.total ?? { tamano: 2, negrita: true }) as Seccion,
    /** Un campo se muestra salvo que esté apagado explícitamente. */
    ver: (c: string) => campos[c] !== false,
    copias: Math.max(1, Number(tipo.copias ?? 1)),
  };
}

export function copiasDe(job: TrabajoImpresion) {
  return estiloDe(job.payload ?? {}).copias;
}

function encabezado(t: Ticket, p: Record<string, any>, e: ReturnType<typeof estiloDe>) {
  const g = e.general;
  t.centro().estilo(e.titulo).parrafo(g.nombre || p.negocio || "").normal();
  if (g.ruc && e.ver("ruc")) t.linea(`RUC ${g.ruc}`);
  const dir = g.direccion || p.direccion;
  if (dir && e.ver("direccion")) t.parrafo(dir);
  const tel = g.telefono || p.telefono;
  if (tel && e.ver("telefono")) t.linea(`Tel. ${tel}`);
  if (g.encabezado) t.parrafo(g.encabezado);
}

function pie(t: Ticket, e: ReturnType<typeof estiloDe>, leyenda: boolean) {
  const g = e.general;
  t.centro().normal();
  if (leyenda && g.leyenda && e.ver("leyenda")) t.linea().parrafo(g.leyenda);
  if (g.pie) t.linea().parrafo(g.pie);
}

function armar(job: TrabajoImpresion, papelMm: number): Ticket {
  const t = new Ticket(papelMm >= 80 ? 48 : 32);
  const p = job.payload ?? {};
  const e = estiloDe(p);
  const s = p.simbolo ?? "S/";

  if (job.kind === "prueba") {
    t.centro().tamano(3).linea("PRUEBA").normal().linea(p.negocio ?? "").linea("Impresora lista").linea(p.hora ?? "");
    return t.cortar();
  }

  if (job.kind === "comanda" || job.kind === "anulacion") {
    const anul = job.kind === "anulacion";
    t.centro().estilo(e.titulo);
    t.parrafo(anul ? "*** ANULACION ***" : String(p.area ?? "COMANDA").toUpperCase());
    if (p.reimpresion) t.normal().negrita(true).linea("(REIMPRESION)");
    if (SERVICIO[p.servicio] && e.ver("servicio")) t.tamano(3).negrita(true).linea(`** ${SERVICIO[p.servicio]} **`);
    t.estilo(e.titulo).parrafo(String(p.mesa ?? "")).normal();
    if (p.cliente) t.linea(p.cliente);
    const datos = [e.ver("hora") ? p.hora : null, p.ronda && e.ver("ronda") ? `Ronda ${p.ronda}` : null].filter(Boolean);
    if (datos.length) t.linea(datos.join("  "));
    if (e.ver("mesero")) t.linea(`${anul ? "Anulo" : "Mozo"}: ${p.mesero ?? ""}`);
    t.izquierda().separador();
    for (const it of p.items ?? []) {
      t.estilo(e.detalle).parrafo(`${it.cantidad} x ${it.nombre}`).normal();
      for (const o of it.opciones ?? []) t.linea(`   + ${o}`);
      if (it.nota) t.negrita(true).parrafo(`   >> ${it.nota}`).negrita(false);
    }
    if (anul && p.motivo) t.separador().parrafo(`Motivo: ${p.motivo}`);
    if (e.ver("cuenta")) t.separador().linea(`Cuenta ${p.cuenta ?? ""}`);
    return t.cortar();
  }

  if (job.kind === "corte_x" || job.kind === "corte_z") return corteCaja(t, job.kind, p, e);
  if (job.kind === "corte_global") return corteGlobal(t, p, e);

  if (job.kind === "cancelacion") {
    encabezado(t, p, e);
    t.separador().estilo(e.titulo).linea("CUENTA CANCELADA").normal();
    t.linea(`${p.mesa ?? ""}  ${p.hora ?? ""}`).izquierda().separador();
    for (const l of p.lineas ?? []) t.estilo(e.detalle).dosColumnas(`${l.cantidad} ${l.nombre}`, dinero(s, l.total)).normal();
    t.separador().estilo(e.total).dosColumnas("TOTAL ANULADO", dinero(s, p.total)).normal();
    t.linea(`Cuenta: ${p.cuenta ?? ""}${p.folio ? `  Folio ${p.folio}` : ""}`).linea(`Cancelo: ${p.canceladoPor ?? ""}`);
    if (e.ver("motivo")) t.parrafo(`Motivo: ${p.motivo ?? ""}`);
    if (e.ver("firma")) t.linea().linea().linea("Autorizo: ____________________");
    return t.cortar();
  }

  // cuenta (precuenta) y nota de venta
  const esNota = job.kind === "nota_venta";
  encabezado(t, p, e);
  t.separador();
  t.estilo(e.titulo).linea(esNota ? "NOTA DE VENTA" : "CUENTA").normal();
  if (p.folio && e.ver("folio")) t.negrita(true).linea(`Folio ${p.folio}`).negrita(false);
  if (p.copia) t.linea("(COPIA)");
  t.izquierda();
  if (SERVICIO[p.servicio]) t.linea(SERVICIO[p.servicio]);
  t.linea(`${p.mesa ?? ""}${e.ver("hora") ? `   ${p.hora ?? ""}` : ""}`);
  if (p.mesero && e.ver("mesero")) t.linea(`Atendio: ${p.mesero}`);
  if (p.comensales && e.ver("comensales")) t.linea(`Personas: ${p.comensales}`);
  if (p.direccionCliente) t.parrafo(`Entregar en: ${p.direccionCliente}`);
  if (p.telefonoCliente) t.linea(`Tel: ${p.telefonoCliente}`);
  t.separador();
  for (const l of p.lineas ?? []) t.estilo(e.detalle).dosColumnas(`${l.cantidad} ${l.nombre}`, dinero(s, l.total)).normal();
  t.separador();
  if (Number(p.descuento) > 0) {
    t.dosColumnas("Subtotal", dinero(s, p.subtotal));
    t.dosColumnas("Descuento", `-${dinero(s, p.descuento)}`);
  }
  if (Number(p.envio) > 0) t.dosColumnas("Envio", dinero(s, p.envio));
  t.estilo(e.total).dosColumnas("TOTAL", dinero(s, p.total)).normal();
  if (esNota) {
    if (e.ver("pagos")) for (const pg of p.pagos ?? []) t.dosColumnas(nombreMetodo(pg.method), dinero(s, pg.amount));
    if (Number(p.vuelto) > 0 && e.ver("vuelto")) t.dosColumnas("Vuelto", dinero(s, p.vuelto));
    if (p.cajero && e.ver("cajero")) t.linea(`Cajero: ${p.cajero}`);
  }
  pie(t, e, true);
  return t.cortar();
}

function corteCaja(t: Ticket, kind: "corte_x" | "corte_z", p: Record<string, any>, e: ReturnType<typeof estiloDe>) {
  const s = p.simbolo ?? "S/";
  const z = kind === "corte_z";
  t.centro().estilo(e.titulo).linea(z ? `CORTE Z #${p.z ?? ""}` : "CORTE X").normal();
  t.linea(p.negocio ?? "").linea(z ? "Cierre de caja" : "Corte parcial (caja sigue abierta)");
  t.izquierda().separador();
  t.linea(`Caja: ${p.caja ?? ""}`).linea(`Cajero: ${p.usuario ?? ""}`);
  t.linea(`Apertura: ${p.apertura ?? ""}`).linea(z ? `Cierre: ${p.cierre ?? ""}` : `Hora: ${p.hora ?? ""}`);
  if (z && p.cerradoPor) t.linea(`Cerro: ${p.cerradoPor}`);
  if (p.ciego) {
    // Cierre a ciegas: solo lo que se contó; el encargado ve la diferencia en el panel.
    t.separador().negrita(true).linea("DECLARADO").negrita(false);
    for (const l of p.lineas ?? []) t.dosColumnas(nombreMetodo(l.metodo), dinero(s, l.declarado));
    if (p.nota) t.parrafo(`Nota: ${p.nota}`);
    if (e.ver("firma")) t.linea().linea().linea("Firma: ____________________");
    return t.cortar();
  }
  t.separador().negrita(true).linea("VENTAS POR METODO").negrita(false);
  for (const m of p.porMetodo ?? []) t.dosColumnas(nombreMetodo(m.metodo), dinero(s, m.monto));
  t.dosColumnas(`Total (${p.ventas ?? 0} ventas)`, dinero(s, p.totalVentas));
  t.separador().negrita(true).linea("EFECTIVO").negrita(false);
  t.dosColumnas("Fondo inicial", dinero(s, p.fondo));
  t.dosColumnas("Ventas en efectivo", dinero(s, (p.porMetodo ?? []).find((m: any) => m.metodo === "efectivo")?.monto ?? 0));
  t.dosColumnas("Ingresos", dinero(s, p.ingresos));
  t.dosColumnas("Retiros", `-${dinero(s, p.retiros)}`);
  t.negrita(true).dosColumnas("Esperado en caja", dinero(s, p.efectivoEsperado)).negrita(false);
  if (z) {
    t.separador().negrita(true).linea("DECLARADO").negrita(false);
    for (const l of p.lineas ?? []) {
      t.linea(nombreMetodo(l.metodo));
      t.dosColumnas("  Esperado", dinero(s, l.esperado));
      t.dosColumnas("  Declarado", dinero(s, l.declarado));
      t.dosColumnas("  Diferencia", dinero(s, l.diferencia));
    }
    const d = Number(p.diferencia);
    t.separador().estilo(e.total).dosColumnas(d < 0 ? "FALTANTE" : d > 0 ? "SOBRANTE" : "CUADRA", dinero(s, d)).normal();
    if (p.nota) t.parrafo(`Nota: ${p.nota}`);
    if (e.ver("firma")) t.linea().linea().linea("Firma: ____________________");
  }
  return t.cortar();
}

function corteGlobal(t: Ticket, p: Record<string, any>, e: ReturnType<typeof estiloDe>) {
  const s = p.simbolo ?? "S/";
  t.centro().estilo(e.titulo).linea("CORTE GLOBAL").normal().negrita(true).linea(`Turno #${p.turno ?? ""}`).negrita(false);
  t.linea(p.negocio ?? "").izquierda().separador();
  t.linea(`Apertura: ${p.apertura ?? ""}`).linea(`Cierre: ${p.cierre ?? ""}`).linea(`Cerro: ${p.cerradoPor ?? ""}`);
  t.separador().negrita(true).linea("CAJAS").negrita(false);
  for (const c of p.sesiones ?? []) {
    t.linea(`Z#${c.z ?? "-"} ${c.caja} - ${c.usuario ?? ""}`);
    t.dosColumnas("  Esperado / declarado", `${Number(c.esperado).toFixed(2)} / ${Number(c.declarado).toFixed(2)}`);
    t.dosColumnas("  Diferencia", dinero(s, c.diferencia));
  }
  t.separador().negrita(true).linea("VENTAS POR METODO").negrita(false);
  for (const m of p.porMetodo ?? []) t.dosColumnas(nombreMetodo(m.metodo), dinero(s, m.monto));
  t.estilo(e.total).dosColumnas("TOTAL", dinero(s, p.total)).normal();
  t.dosColumnas("Ventas", String(p.ventas ?? 0));
  t.dosColumnas("Ticket promedio", dinero(s, p.ticketPromedio));
  t.dosColumnas("Descuentos", dinero(s, p.descuentos));
  t.dosColumnas(`Anulaciones (${p.anulaciones?.cantidad ?? 0})`, dinero(s, p.anulaciones?.monto ?? 0));
  t.dosColumnas("Cuentas canceladas", String(p.cuentasCanceladas ?? 0));
  t.negrita(true).dosColumnas("Diferencia de cajas", dinero(s, p.diferencia)).negrita(false);
  if ((p.top ?? []).length && e.ver("top")) {
    t.separador().negrita(true).linea("MAS VENDIDOS").negrita(false);
    for (const x of p.top) t.dosColumnas(`${x.cantidad} ${x.nombre}`, dinero(s, x.total));
  }
  return t.cortar();
}

/** Bytes ESC/POS de un trabajo. */
export function ticketEscPos(job: TrabajoImpresion, papelMm: number): Uint8Array {
  return armar(job, papelMm).build();
}

/** Líneas del ticket para mostrarlo en pantalla tal como saldrá. */
export function vistaPrevia(job: TrabajoImpresion, papelMm: number): { lineas: LineaVista[]; ancho: number } {
  const t = armar(job, papelMm);
  return { lineas: t.vista, ancho: t.ancho };
}
