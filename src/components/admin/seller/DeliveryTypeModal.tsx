import { useEffect, useState } from "react";
import { AutoComplete, Button, Checkbox, Input, InputNumber, Modal, Segmented, Select, Switch } from "antd";
import { TbPlus, TbTrash } from "react-icons/tb";
import { DIAS, type TipoEntrega } from "./tipos";

interface Props {
  abierto: TipoEntrega | null;
  simbolo: string;
  datosSugeridos: string[];
  /** Restaurante: sin agencias ni plazos en días; tiempo en minutos y pedido mínimo. */
  restaurante?: boolean;
  onCancel: () => void;
  onSave: (t: TipoEntrega) => void;
}

const NOMBRES_RESTO = ["Delivery", "Delivery propio", "Rappi / PedidosYa", "Recojo en el local"].map((v) => ({
  value: v,
}));

const NOMBRES = ["Motorizado", "Shalom", "Olva Courier", "Marvisur", "Delivery propio", "Recojo en tienda"].map(
  (v) => ({ value: v })
);

/** Horas cada 30 min para los rangos de horario. */
const HORAS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 ? "30" : "00";
  return { value: `${h}:${m}`, label: `${h}:${m}` };
});

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="text-[13px] font-bold text-ink">{titulo}</p>
      {ayuda && <p className="mb-2 text-[12px] text-muted">{ayuda}</p>}
      <div className={ayuda ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

/** Edición de un tipo de entrega: costo, plazos, pago y datos a pedir. */
export default function DeliveryTypeModal({
  abierto,
  simbolo,
  datosSugeridos,
  restaurante = false,
  onCancel,
  onSave,
}: Props) {
  const [t, setT] = useState<TipoEntrega | null>(abierto);
  useEffect(() => setT(abierto), [abierto]);
  if (!t) return null;

  const set = (cambio: Partial<TipoEntrega>) => setT({ ...t, ...cambio });
  const todos = t.dias.length === 0;

  return (
    <Modal
      open={Boolean(abierto)}
      title="Tipo de entrega"
      width={720}
      onCancel={onCancel}
      okText="Listo"
      cancelText="Cancelar"
      onOk={() => onSave({ ...t, nombre: t.nombre.trim() || "Entrega" })}
      destroyOnHidden
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-[12px] font-semibold text-ink-soft">Nombre (lo verá el cliente)</label>
            <AutoComplete
              className="w-full"
              options={restaurante ? NOMBRES_RESTO : NOMBRES}
              value={t.nombre}
              onChange={(v) => set({ nombre: v })}
              placeholder={restaurante ? "Ej.: Delivery, Recojo en el local" : "Ej.: Motorizado, Shalom"}
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-ink-soft">Tipo</label>
            <Select
              className="w-full"
              value={t.clase}
              onChange={(v) => set({ clase: v })}
              options={
                restaurante
                  ? [
                      { value: "motorizado", label: "Delivery (repartidor propio o app)" },
                      { value: "recojo", label: "Recojo en el local" },
                      { value: "otro", label: "Personalizado / Otro" },
                    ]
                  : [
                      { value: "motorizado", label: "Motorizado / delivery" },
                      { value: "agencia", label: "Agencia (Shalom, Olva…)" },
                      { value: "recojo", label: "Recojo en tienda" },
                      { value: "otro", label: "Personalizado / Otro" },
                    ]
              }
            />
          </div>
        </div>

        {(t.clase === "agencia" || t.clase === "recojo") && (
          <div>
            <label className="text-[12px] font-semibold text-ink-soft">
              {t.clase === "recojo" ? "Dirección del punto de recojo" : "Agencias / direcciones (opcional)"}
            </label>
            <Input.TextArea
              rows={2}
              maxLength={300}
              value={t.direccion}
              onChange={(e) => set({ direccion: e.target.value })}
              placeholder={
                t.clase === "recojo"
                  ? "Ej.: Av. Perú 123, San Martín de Porres"
                  : "Ej.: El cliente elige la agencia Shalom más cercana a su ciudad"
              }
            />
          </div>
        )}

        <Bloque titulo="Costo de envío">
          <Segmented
            value={t.costo.tipo}
            onChange={(v) => set({ costo: { ...t.costo, tipo: v as TipoEntrega["costo"]["tipo"] } })}
            options={[
              { value: "gratis", label: "Gratis" },
              { value: "fijo", label: "Fijo" },
              { value: "rango", label: "Rango" },
              { value: "transportista", label: "Lo cobra el transportista" },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(t.costo.tipo === "fijo" || t.costo.tipo === "rango") && (
              <InputNumber
                min={0}
                addonBefore={simbolo}
                placeholder={t.costo.tipo === "rango" ? "Mínimo" : "Monto"}
                value={t.costo.monto}
                onChange={(v) => set({ costo: { ...t.costo, monto: v } })}
              />
            )}
            {t.costo.tipo === "rango" && (
              <InputNumber
                min={0}
                addonBefore={simbolo}
                placeholder="Máximo"
                value={t.costo.maximo}
                onChange={(v) => set({ costo: { ...t.costo, maximo: v } })}
              />
            )}
            {(t.costo.tipo === "transportista" || t.costo.tipo === "rango") && (
              <Input
                className="max-w-xs"
                maxLength={60}
                placeholder="Referencia: tarifa según destino"
                value={t.costo.referencia}
                onChange={(e) => set({ costo: { ...t.costo, referencia: e.target.value } })}
              />
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[13px]">
            <span className="text-ink-soft">Pedido mínimo</span>
            <InputNumber
              min={0}
              addonBefore={simbolo}
              placeholder="Ej. 25"
              value={t.minimo}
              onChange={(v) => set({ minimo: v })}
            />
            <span className="text-[12px] text-muted">Opcional</span>
          </div>
          {(t.costo.tipo === "fijo" || t.costo.tipo === "rango") && (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <span className="text-ink-soft">Envío gratis desde</span>
              <InputNumber
                min={0}
                addonBefore={simbolo}
                placeholder="Ej. 150"
                value={t.gratisDesde}
                onChange={(v) => set({ gratisDesde: v })}
              />
              <span className="text-[12px] text-muted">Opcional</span>
            </div>
          )}
        </Bloque>

        {restaurante ? (
          <Bloque titulo="Tiempo estimado" ayuda="Lo que el vendedor promete al cliente. Los días y horas de atención van en «Horario».">
            <Input
              maxLength={120}
              placeholder="Ej. 30 a 45 minutos"
              value={t.promesaResto}
              onChange={(e) => set({ promesaResto: e.target.value })}
            />
          </Bloque>
        ) : (
        <Bloque
          titulo="Plazos de entrega"
          ayuda="Lo que el vendedor promete según la hora en que el cliente pide."
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-ink-soft">¿Qué días entregas?</span>
            <Checkbox checked={todos} onChange={(e) => set({ dias: e.target.checked ? [] : [1, 2, 3, 4, 5, 6] })}>
              Todos los días
            </Checkbox>
            {!todos && (
              <Checkbox.Group
                value={t.dias}
                onChange={(v) => set({ dias: (v as number[]).sort() })}
                options={DIAS.map(([n, l]) => ({ value: n, label: l }))}
              />
            )}
          </div>

          <div className="mt-3 space-y-2">
            {t.horarios.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  className="w-24"
                  options={HORAS}
                  value={h.desde}
                  onChange={(v) => set({ horarios: t.horarios.map((x, j) => (j === i ? { ...x, desde: v } : x)) })}
                />
                <span className="text-muted">a</span>
                <Select
                  className="w-24"
                  options={HORAS}
                  value={h.hasta}
                  onChange={(v) => set({ horarios: t.horarios.map((x, j) => (j === i ? { ...x, hasta: v } : x)) })}
                />
                <Input
                  className="min-w-[200px] flex-1"
                  maxLength={120}
                  placeholder="Promesa al cliente: Llega hoy antes de las 6pm"
                  value={h.promesa}
                  onChange={(e) =>
                    set({ horarios: t.horarios.map((x, j) => (j === i ? { ...x, promesa: e.target.value } : x)) })
                  }
                />
                <Button
                  type="text"
                  icon={<TbTrash />}
                  onClick={() => set({ horarios: t.horarios.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <Button
              size="small"
              icon={<TbPlus />}
              onClick={() =>
                set({ horarios: [...t.horarios, { desde: "00:00", hasta: "13:00", promesa: "" }] })
              }
            >
              Agregar horario
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-40 text-[12px] italic text-muted">
                {t.horarios.length ? "Resto de horarios (opcional)" : "Plazo de entrega"}
              </span>
              <Input
                maxLength={120}
                placeholder="Ej. 1-2 días hábiles"
                value={t.promesaResto}
                onChange={(e) => set({ promesaResto: e.target.value })}
              />
            </div>
          </div>
        </Bloque>
        )}

        <Bloque titulo="Forma de pago">
          <Segmented
            value={t.pago.tipo}
            onChange={(v) => set({ pago: { ...t.pago, tipo: v as TipoEntrega["pago"]["tipo"] } })}
            options={[
              { value: "adelantado", label: "Pago adelantado" },
              { value: "contraentrega", label: "Contraentrega" },
              ...(t.clase === "recojo" ? [{ value: "tienda", label: "Pago en tienda" }] : []),
            ]}
          />
          {t.pago.tipo === "adelantado" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Switch
                size="small"
                checked={t.pago.parcial}
                onChange={(v) => set({ pago: { ...t.pago, parcial: v } })}
              />
              <span className="text-[13px] text-ink-soft">Permitir adelanto parcial (separar)</span>
              {t.pago.parcial && (
                <>
                  <span className="text-[13px] text-ink-soft">Mínimo a adelantar</span>
                  <Segmented
                    size="small"
                    value={t.pago.minimoTipo}
                    onChange={(v) => set({ pago: { ...t.pago, minimoTipo: v as "monto" | "porcentaje" } })}
                    options={[
                      { value: "monto", label: simbolo },
                      { value: "porcentaje", label: "%" },
                    ]}
                  />
                  <InputNumber
                    min={0}
                    max={t.pago.minimoTipo === "porcentaje" ? 100 : undefined}
                    value={t.pago.minimo}
                    onChange={(v) => set({ pago: { ...t.pago, minimo: v } })}
                  />
                </>
              )}
            </div>
          )}
        </Bloque>

        <Bloque
          titulo="Datos que el vendedor pide"
          ayuda="No cierra el pedido hasta tenerlos. Puedes escribir uno propio y presionar Enter."
        >
          <Select
            mode="tags"
            className="w-full"
            value={t.datos}
            onChange={(v) => set({ datos: v })}
            options={datosSugeridos.map((d) => ({ value: d, label: d }))}
            placeholder="Nombre completo, DNI, Dirección…"
          />
        </Bloque>

        <Bloque titulo="Reglas adicionales de envío" ayuda="Texto libre que el vendedor seguirá con esta entrega.">
          <Input.TextArea
            rows={2}
            maxLength={1000}
            value={t.reglas}
            onChange={(e) => set({ reglas: e.target.value })}
            placeholder="Ej.: Los pedidos de los sábados salen el lunes. No entregamos en cerros."
          />
          <div className={`mt-3 flex items-center gap-2 ${restaurante ? "hidden" : ""}`}>
            <Switch size="small" checked={t.soloRespaldo} onChange={(v) => set({ soloRespaldo: v })} />
            <span className="text-[13px] text-ink-soft">
              Usar solo como respaldo (se ofrece si ninguna otra opción de la zona le sirve)
            </span>
          </div>
        </Bloque>
      </div>
    </Modal>
  );
}
