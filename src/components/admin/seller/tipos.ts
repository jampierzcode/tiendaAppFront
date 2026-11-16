/** Tipos de la configuración del vendedor IA (espejo de SellerConfigService). */

export type TipoCosto = "gratis" | "fijo" | "rango" | "transportista";
export type ClaseEntrega = "motorizado" | "agencia" | "recojo" | "otro";
export type TipoPago = "adelantado" | "contraentrega" | "tienda";

export interface Horario {
  desde: string;
  hasta: string;
  promesa: string;
}

export interface TipoEntrega {
  id: string;
  nombre: string;
  clase: ClaseEntrega;
  activo: boolean;
  costo: { tipo: TipoCosto; monto: number | null; maximo: number | null; referencia: string };
  gratisDesde: number | null;
  dias: number[];
  horarios: Horario[];
  promesaResto: string;
  pago: { tipo: TipoPago; parcial: boolean; minimoTipo: "monto" | "porcentaje"; minimo: number | null };
  datos: string[];
  direccion: string;
  reglas: string;
  soloRespaldo: boolean;
}

export interface ZonaEnvio {
  id: string;
  nombre: string;
  activa: boolean;
  regiones: string[];
  tipos: TipoEntrega[];
}

export interface PreguntaFrecuente {
  id: string;
  categoria: string;
  pregunta: string;
  respuesta: string;
  activa: boolean;
}

export interface Sede {
  id: string;
  empresa: string;
  departamento: string;
  provincia: string;
  distrito: string;
  nombre: string;
  direccion: string;
  referencia: string;
}

export interface ConfigVendedor {
  nombre: string;
  publico: string;
  tono: "amigable" | "profesional" | "divertido" | "formal";
  trato: "tu" | "usted";
  largo: "corto" | "medio";
  emojis: "ninguno" | "pocos" | "muchos";
  palabrasEvitar: string;
  fotos: "siempre" | "cuando_ayude" | "nunca";
  saludo: { activo: boolean; modo: "exacto" | "exacto_responde" | "adaptado"; texto: string };
  faqs: PreguntaFrecuente[];
  ejemplo: string;
  derivarCuando: string[];
  descuentos: string;
  sedes: Sede[];
}

export const nuevoId = () => Math.random().toString(36).slice(2, 10);

export const DIAS = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mié"],
  [4, "Jue"],
  [5, "Vie"],
  [6, "Sáb"],
  [7, "Dom"],
] as const;

/** Plantillas al pulsar «Agregar» un tipo de entrega. */
export function plantillaTipo(clase: ClaseEntrega | "shalom"): TipoEntrega {
  const base: TipoEntrega = {
    id: nuevoId(),
    nombre: "Entrega",
    clase: "otro",
    activo: true,
    costo: { tipo: "fijo", monto: null, maximo: null, referencia: "" },
    gratisDesde: null,
    dias: [],
    horarios: [],
    promesaResto: "",
    pago: { tipo: "adelantado", parcial: false, minimoTipo: "monto", minimo: null },
    datos: ["Nombre completo", "Teléfono"],
    direccion: "",
    reglas: "",
    soloRespaldo: false,
  };
  if (clase === "motorizado") {
    return {
      ...base,
      nombre: "Motorizado",
      clase: "motorizado",
      costo: { ...base.costo, monto: 10 },
      horarios: [
        { desde: "00:00", hasta: "13:00", promesa: "Llega hoy antes de las 6pm" },
        { desde: "13:00", hasta: "00:00", promesa: "Llega al día siguiente" },
      ],
      pago: { ...base.pago, tipo: "contraentrega" },
      datos: ["Nombre completo", "Teléfono", "Dirección", "Referencia", "Ubicación GPS"],
    };
  }
  if (clase === "shalom" || clase === "agencia") {
    return {
      ...base,
      nombre: clase === "shalom" ? "Shalom" : "Agencia",
      clase: "agencia",
      costo: { ...base.costo, monto: 12 },
      promesaResto: "1 a 3 días hábiles según la ruta",
      pago: { tipo: "adelantado", parcial: true, minimoTipo: "monto", minimo: 20 },
      datos: ["Nombre completo", "DNI", "Teléfono", "Agencia de recojo"],
    };
  }
  if (clase === "recojo") {
    return {
      ...base,
      nombre: "Recojo en tienda",
      clase: "recojo",
      costo: { ...base.costo, tipo: "gratis" },
      promesaResto: "Listo para recoger el mismo día",
      pago: { ...base.pago, tipo: "tienda" },
      datos: ["Nombre completo"],
    };
  }
  return base;
}

export function resumenCosto(t: TipoEntrega, s: string) {
  const c = t.costo;
  if (c.tipo === "gratis") return "Gratis";
  if (c.tipo === "transportista") return `Lo cobra el transportista${c.referencia ? ` (${c.referencia})` : ""}`;
  if (c.tipo === "rango") return `${s}${c.monto ?? 0} – ${s}${c.maximo ?? c.monto ?? 0}`;
  return `${s}${c.monto ?? 0}${t.gratisDesde != null ? ` (gratis desde ${s}${t.gratisDesde})` : ""}`;
}

export function resumenPago(t: TipoEntrega, s: string) {
  const p = t.pago;
  if (p.tipo === "contraentrega") return "Contraentrega";
  if (p.tipo === "tienda") return "Paga en tienda";
  if (p.parcial && p.minimo != null) {
    return `Adelantado (mín ${p.minimoTipo === "porcentaje" ? `${p.minimo}%` : `${s}${p.minimo}`})`;
  }
  return "Adelantado";
}

export function resumenEntrega(t: TipoEntrega) {
  const partes = t.horarios.map((h) => `${h.desde}–${h.hasta}: ${h.promesa}`);
  if (t.promesaResto) partes.push(t.horarios.length ? `(resto: ${t.promesaResto})` : t.promesaResto);
  return partes.join(" · ") || "Sin plazo definido";
}
