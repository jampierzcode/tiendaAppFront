import { Button, Select, Switch } from "antd";
import { TbPlus, TbX } from "react-icons/tb";
import type { ConfigRestaurante } from "./tipos";

const DIAS: [number, string][] = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [7, "Domingo"],
];

const HORAS = Array.from({ length: 48 }, (_, i) => {
  const v = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
  return { value: v, label: v };
});

type Turno = ConfigRestaurante["horario"][number];

/**
 * Horario de atención por día, con uno o dos turnos (p. ej. 12:00–16:00 y
 * 19:00–23:00). Un turno puede cruzar la medianoche (19:00–02:00).
 */
export default function HorarioEditor({ value, onChange }: { value: Turno[]; onChange: (h: Turno[]) => void }) {
  const delDia = (d: number) => value.filter((t) => t.dia === d);
  const reemplazar = (d: number, turnos: Turno[]) => onChange([...value.filter((t) => t.dia !== d), ...turnos]);

  const copiarATodos = (d: number) => {
    const base = delDia(d);
    onChange([1, 2, 3, 4, 5, 6, 7].flatMap((x) => base.map((t) => ({ ...t, dia: x }))));
  };

  return (
    <div className="divide-y divide-line-soft">
      {DIAS.map(([d, nombre]) => {
        const turnos = delDia(d);
        const abierto = turnos.length > 0;
        return (
          <div key={d} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="flex w-36 items-center gap-2">
              <Switch
                size="small"
                checked={abierto}
                onChange={(v) => reemplazar(d, v ? [{ dia: d, abre: "12:00", cierra: "22:00" }] : [])}
              />
              <span className={`text-[13px] font-medium ${abierto ? "text-ink" : "text-muted"}`}>{nombre}</span>
            </div>
            {abierto ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {turnos.map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Select
                      size="small"
                      className="w-24"
                      options={HORAS}
                      value={t.abre}
                      onChange={(v) => reemplazar(d, turnos.map((x, j) => (j === i ? { ...x, abre: v } : x)))}
                    />
                    <span className="text-muted">a</span>
                    <Select
                      size="small"
                      className="w-24"
                      options={HORAS}
                      value={t.cierra}
                      onChange={(v) => reemplazar(d, turnos.map((x, j) => (j === i ? { ...x, cierra: v } : x)))}
                    />
                    {turnos.length > 1 && (
                      <Button
                        size="small"
                        type="text"
                        icon={<TbX />}
                        onClick={() => reemplazar(d, turnos.filter((_, j) => j !== i))}
                      />
                    )}
                  </div>
                ))}
                {turnos.length < 2 && (
                  <Button
                    size="small"
                    type="text"
                    icon={<TbPlus />}
                    onClick={() => reemplazar(d, [...turnos, { dia: d, abre: "19:00", cierra: "23:00" }])}
                  >
                    Segundo turno
                  </Button>
                )}
                <Button size="small" type="link" onClick={() => copiarATodos(d)}>
                  Copiar a todos los días
                </Button>
              </div>
            ) : (
              <span className="text-[12px] text-muted">Cerrado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
