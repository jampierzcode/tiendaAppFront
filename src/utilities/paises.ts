/**
 * Países en los que se opera. Igual que en el servidor: el país define el
 * impuesto (no se edita por producto) y el formato del WhatsApp.
 */
export type CodigoPais = "PE" | "MX" | "CL";

export const PAISES_OPERACION: Record<
  CodigoPais,
  { nombre: string; dial: string; largo: number; inicio?: string; impuesto: { nombre: string; tasa: number } }
> = {
  PE: { nombre: "Perú", dial: "51", largo: 9, inicio: "9", impuesto: { nombre: "IGV", tasa: 18 } },
  MX: { nombre: "México", dial: "52", largo: 10, impuesto: { nombre: "IVA", tasa: 16 } },
  CL: { nombre: "Chile", dial: "56", largo: 9, inicio: "9", impuesto: { nombre: "IVA", tasa: 19 } },
};

export const opcionesPais = (Object.keys(PAISES_OPERACION) as CodigoPais[]).map((c) => ({
  value: c,
  label: `${PAISES_OPERACION[c].nombre} · ${PAISES_OPERACION[c].impuesto.nombre} ${PAISES_OPERACION[c].impuesto.tasa}%`,
}));

/** Mensaje de error si el WhatsApp (con código de país) no es de ese país; null si está bien. */
export function errorWhatsapp(pais: string, valor?: string | null): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  const p = PAISES_OPERACION[(pais as CodigoPais) ?? "PE"] ?? PAISES_OPERACION.PE;
  if (!digitos.startsWith(p.dial)) return `Debe ser un número de ${p.nombre} (+${p.dial})`;
  const nacional = digitos.slice(p.dial.length);
  if (nacional.length !== p.largo) return `Un número de ${p.nombre} lleva ${p.largo} dígitos`;
  if (p.inicio && !nacional.startsWith(p.inicio)) return `Los celulares de ${p.nombre} empiezan con ${p.inicio}`;
  return null;
}

export const impuestoDe = (pais?: string | null) =>
  PAISES_OPERACION[(pais as CodigoPais) ?? "PE"]?.impuesto ?? PAISES_OPERACION.PE.impuesto;

/** Códigos de país para teléfonos. Los tres primeros son los países donde la app cobra impuestos propios. */
export const PAISES_TEL = [
  { codigo: "PE", nombre: "Perú", dial: "51", bandera: "🇵🇪" },
  { codigo: "MX", nombre: "México", dial: "52", bandera: "🇲🇽" },
  { codigo: "CL", nombre: "Chile", dial: "56", bandera: "🇨🇱" },
  { codigo: "CO", nombre: "Colombia", dial: "57", bandera: "🇨🇴" },
  { codigo: "AR", nombre: "Argentina", dial: "54", bandera: "🇦🇷" },
  { codigo: "EC", nombre: "Ecuador", dial: "593", bandera: "🇪🇨" },
  { codigo: "BO", nombre: "Bolivia", dial: "591", bandera: "🇧🇴" },
  { codigo: "UY", nombre: "Uruguay", dial: "598", bandera: "🇺🇾" },
  { codigo: "US", nombre: "EE. UU.", dial: "1", bandera: "🇺🇸" },
  { codigo: "ES", nombre: "España", dial: "34", bandera: "🇪🇸" },
] as const;

export const dialDePais = (codigo?: string | null) =>
  PAISES_TEL.find((p) => p.codigo === codigo)?.dial ?? "51";

/** Teléfono completo (solo dígitos) a partir del código de país y lo que escribió el cliente. */
export const telefonoCompleto = (dial: string, escrito: string) => {
  const digitos = escrito.replace(/\D/g, "").replace(/^0+/, "");
  return digitos ? `${dial}${digitos}` : "";
};

/** Separa un teléfono completo (51933735080) en código de país y número. */
export const separarTelefono = (completo?: string | null) => {
  const digitos = String(completo ?? "").replace(/\D/g, "");
  const dial = [...PAISES_TEL].sort((a, b) => b.dial.length - a.dial.length).find((p) => digitos.startsWith(p.dial))?.dial;
  return dial ? { dial, nacional: digitos.slice(dial.length) } : { dial: null, nacional: digitos };
};

/** Motivo si el teléfono (código + número escrito) parece incompleto; null si está bien. */
export const errorTelefono = (dial: string, escrito: string): string | null => {
  const nacional = escrito.replace(/\D/g, "").replace(/^0+/, "");
  if (!nacional) return "Escribe tu WhatsApp";
  const pais = Object.values(PAISES_OPERACION).find((p) => p.dial === dial);
  if (pais) {
    if (nacional.length !== pais.largo) return `Tu WhatsApp parece incompleto: en ${pais.nombre} lleva ${pais.largo} dígitos`;
    if (pais.inicio && !nacional.startsWith(pais.inicio)) return `Los celulares de ${pais.nombre} empiezan con ${pais.inicio}`;
    return null;
  }
  return nacional.length >= 7 && nacional.length <= 12 ? null : "Tu WhatsApp no parece completo";
};

export const correoValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
