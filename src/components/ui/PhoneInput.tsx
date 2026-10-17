import { useEffect, useMemo, useState } from "react";
import { Input, Select } from "antd";

/** Países donde se vende hoy. `len` = dígitos del número nacional. */
export const PAISES = [
  { iso: "PE", nombre: "Perú", dial: "51", len: 9, tz: ["America/Lima"] },
  { iso: "MX", nombre: "México", dial: "52", len: 10, tz: ["America/Mexico_City", "America/Monterrey", "America/Cancun", "America/Tijuana"] },
  { iso: "CL", nombre: "Chile", dial: "56", len: 9, tz: ["America/Santiago"] },
  { iso: "CO", nombre: "Colombia", dial: "57", len: 10, tz: ["America/Bogota"] },
  { iso: "AR", nombre: "Argentina", dial: "54", len: 10, tz: ["America/Argentina/Buenos_Aires", "America/Buenos_Aires"] },
  { iso: "EC", nombre: "Ecuador", dial: "593", len: 9, tz: ["America/Guayaquil"] },
  { iso: "BO", nombre: "Bolivia", dial: "591", len: 8, tz: ["America/La_Paz"] },
  { iso: "UY", nombre: "Uruguay", dial: "598", len: 8, tz: ["America/Montevideo"] },
  { iso: "PY", nombre: "Paraguay", dial: "595", len: 9, tz: ["America/Asuncion"] },
  { iso: "VE", nombre: "Venezuela", dial: "58", len: 10, tz: ["America/Caracas"] },
  { iso: "PA", nombre: "Panamá", dial: "507", len: 8, tz: ["America/Panama"] },
  { iso: "CR", nombre: "Costa Rica", dial: "506", len: 8, tz: ["America/Costa_Rica"] },
  { iso: "BR", nombre: "Brasil", dial: "55", len: 11, tz: ["America/Sao_Paulo"] },
  { iso: "ES", nombre: "España", dial: "34", len: 9, tz: ["Europe/Madrid"] },
  { iso: "US", nombre: "Estados Unidos", dial: "1", len: 10, tz: ["America/New_York", "America/Chicago", "America/Los_Angeles"] },
] as const;

type Pais = (typeof PAISES)[number];

const bandera = (iso: string) =>
  String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** País por defecto: zona horaria del navegador, luego región del idioma, luego Perú. */
function paisDelNavegador(): Pais {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const porZona = PAISES.find((p) => (p.tz as readonly string[]).includes(tz));
    if (porZona) return porZona;
    for (const lang of navigator.languages ?? [navigator.language]) {
      const region = lang.split("-")[1]?.toUpperCase();
      const porIdioma = PAISES.find((p) => p.iso === region);
      if (porIdioma) return porIdioma;
    }
  } catch {
    // Sin acceso a la zona horaria: se usa el valor de fábrica.
  }
  return PAISES[0];
}

// Prefijos más largos primero: 593 antes que 59 o 5.
const POR_PREFIJO = [...PAISES].sort((a, b) => b.dial.length - a.dial.length);

function separar(valor: string | null | undefined): { pais: Pais; nacional: string } | null {
  const d = String(valor ?? "").replace(/\D/g, "");
  if (!d) return null;
  const pais = POR_PREFIJO.find((p) => d.startsWith(p.dial));
  return pais ? { pais, nacional: d.slice(pais.dial.length) } : null;
}

interface Props {
  /** Número completo en dígitos, con código de país: 51987654321. */
  value?: string | null;
  onChange?: (v: string) => void;
  disabled?: boolean;
  /**
   * País fijo (ISO): el número solo acepta ese país y no se ofrece selector.
   * Es lo que usa «Mi tienda», donde el país ya está elegido.
   */
  pais?: string;
}

/**
 * Teléfono con selector de país: la persona elige (o ya viene puesto por su
 * región) y escribe solo su número. Entrega el número completo, sin signos.
 */
export default function PhoneInput({ value, onChange, disabled, pais: paisFijo }: Props) {
  const inicial = useMemo(() => paisDelNavegador(), []);
  const [isoLibre, setIso] = useState<string>(separar(value)?.pais.iso ?? inicial.iso);
  const iso = paisFijo ?? isoLibre;
  const pais = PAISES.find((p) => p.iso === iso) ?? inicial;

  // Si el valor llega de fuera (se carga la configuración), el país lo sigue.
  useEffect(() => {
    const s = separar(value);
    if (s && !paisFijo) setIso(s.pais.iso);
  }, [value, paisFijo]);

  // Con país fijo se quita solo el prefijo de ese país (no se adivina otro).
  const digitos = String(value ?? "").replace(/\D/g, "");
  const nacional = paisFijo
    ? digitos.startsWith(pais.dial)
      ? digitos.slice(pais.dial.length)
      : digitos
    : (separar(value)?.nacional ?? digitos);

  const emitir = (p: Pais, n: string) => onChange?.(n ? `${p.dial}${n}` : "");

  return (
    <Input
      disabled={disabled}
      inputMode="numeric"
      maxLength={pais.len}
      value={nacional}
      placeholder={"9".repeat(pais.len)}
      onChange={(e) => {
        // Sin signos ni el cero de marcado: solo el número nacional.
        const n = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, pais.len);
        emitir(pais, n);
      }}
      addonBefore={
        paisFijo ? (
          <span style={{ padding: "0 4px" }}>
            {bandera(pais.iso)} +{pais.dial}
          </span>
        ) : (
        <Select
          value={iso}
          disabled={disabled}
          style={{ width: 118 }}
          popupMatchSelectWidth={false}
          optionLabelProp="label"
          onChange={(nuevo) => {
            const p = PAISES.find((x) => x.iso === nuevo)!;
            setIso(nuevo);
            emitir(p, nacional.slice(0, p.len));
          }}
          options={PAISES.map((p) => ({
            value: p.iso,
            label: `${bandera(p.iso)} +${p.dial}`,
            // El desplegable muestra el nombre del país.
            title: p.nombre,
          }))}
          optionRender={(o) => {
            const p = PAISES.find((x) => x.iso === o.value)!;
            return (
              <span>
                {bandera(p.iso)} {p.nombre} <span style={{ color: "#7c7a9c" }}>+{p.dial}</span>
              </span>
            );
          }}
        />
        )
      }
    />
  );
}
