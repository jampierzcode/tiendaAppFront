import { useEffect, useMemo, useState } from "react";
import { Button, Empty, InputNumber, Modal, Select, Spin, message } from "antd";
import { TbPlus, TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";

interface Insumo {
  id: number;
  name: string;
  unit: string;
  avgCost: number;
  stock: number;
}

interface Linea {
  ingredientId: number | null;
  quantity: number | null;
  wastePercent: number;
}

interface Props {
  open: boolean;
  producto: { id: number; name: string; price: number } | null;
  onClose: () => void;
  onSaved: () => void;
}

const soles = (v: number) => `S/ ${v.toFixed(2)}`;

/**
 * Receta de un plato: qué insumos lleva y cuánto. Al confirmar un pedido se
 * descuenta esa cantidad (más la merma) del stock de cada insumo, y el costo
 * y el margen se calculan con el costo promedio actual de cada uno.
 */
export default function RecipeModal({ open, producto, onClose, onSaved }: Props) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !producto) return;
    setCargando(true);
    Promise.all([
      apiTienda.get("/ingredients"),
      apiTienda.get(`/products/${producto.id}/recipe`),
    ])
      .then(([i, r]) => {
        setInsumos((i.data.data ?? []).filter((x: any) => x.isActive));
        setLineas(
          (r.data.data.lines ?? []).map((l: any) => ({
            ingredientId: l.ingredientId,
            quantity: l.quantity,
            wastePercent: l.wastePercent,
          }))
        );
      })
      .catch(() => message.error("No se pudo cargar la receta"))
      .finally(() => setCargando(false));
  }, [open, producto]);

  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  const costoLinea = (l: Linea) => {
    const i = l.ingredientId ? porId.get(l.ingredientId) : null;
    if (!i || !l.quantity) return 0;
    return l.quantity * (1 + (l.wastePercent || 0) / 100) * i.avgCost;
  };

  const costo = lineas.reduce((t, l) => t + costoLinea(l), 0);
  const precio = producto?.price ?? 0;
  const margen = precio - costo;
  const margenPct = precio > 0 ? (margen / precio) * 100 : 0;

  const cambiar = (idx: number, parte: Partial<Linea>) =>
    setLineas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...parte } : l)));

  const guardar = async () => {
    if (!producto) return;
    const validas = lineas.filter((l) => l.ingredientId && l.quantity);
    setGuardando(true);
    try {
      await apiTienda.put(`/products/${producto.id}/recipe`, {
        lines: validas.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.quantity,
          wastePercent: l.wastePercent || 0,
        })),
      });
      message.success("Receta guardada");
      onSaved();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar la receta");
    } finally {
      setGuardando(false);
    }
  };

  const usados = new Set(lineas.map((l) => l.ingredientId));

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={guardar}
      okText="Guardar receta"
      confirmLoading={guardando}
      title={producto ? `Receta · ${producto.name}` : "Receta"}
      width={680}
      destroyOnHidden
    >
      {cargando ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : insumos.length === 0 ? (
        <Empty
          description={
            <span>
              Aún no tienes insumos. Créalos primero en <b>Insumos</b> (carne, pan, queso…).
            </span>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted">
            Cantidad que lleva <b>una porción</b>, en la unidad de cada insumo. La merma es lo que se
            pierde al preparar y también se descuenta.
          </p>

          <div className="space-y-2">
            {lineas.map((l, idx) => {
              const i = l.ingredientId ? porId.get(l.ingredientId) : null;
              return (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Insumo"
                    className="min-w-[200px] flex-1"
                    value={l.ingredientId ?? undefined}
                    onChange={(v) => cambiar(idx, { ingredientId: v })}
                    options={insumos.map((x) => ({
                      value: x.id,
                      label: `${x.name} (${x.unit})`,
                      disabled: usados.has(x.id) && x.id !== l.ingredientId,
                    }))}
                  />
                  <InputNumber
                    min={0}
                    step={0.01}
                    className="!w-28"
                    placeholder="Cantidad"
                    addonAfter={i?.unit ?? "—"}
                    value={l.quantity}
                    onChange={(v) => cambiar(idx, { quantity: v })}
                  />
                  <InputNumber
                    min={0}
                    max={100}
                    className="!w-24"
                    addonAfter="% merma"
                    value={l.wastePercent}
                    onChange={(v) => cambiar(idx, { wastePercent: Number(v ?? 0) })}
                  />
                  <span className="w-16 text-right text-[12px] tabular text-ink-soft">
                    {soles(costoLinea(l))}
                  </span>
                  <Button
                    type="text"
                    danger
                    aria-label="Quitar insumo"
                    icon={<TbTrash />}
                    onClick={() => setLineas((ls) => ls.filter((_, k) => k !== idx))}
                  />
                </div>
              );
            })}
          </div>

          <Button
            type="dashed"
            block
            className="mt-3"
            icon={<TbPlus />}
            onClick={() =>
              setLineas((ls) => [...ls, { ingredientId: null, quantity: null, wastePercent: 0 }])
            }
          >
            Agregar insumo
          </Button>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-canvas p-4 text-center">
            <div>
              <p className="eyebrow">Costo</p>
              <p className="text-lg font-bold text-ink tabular">{soles(costo)}</p>
            </div>
            <div>
              <p className="eyebrow">Precio</p>
              <p className="text-lg font-bold text-ink tabular">{soles(precio)}</p>
            </div>
            <div>
              <p className="eyebrow">Margen</p>
              <p
                className={`text-lg font-bold tabular ${margen < 0 ? "text-danger" : "text-ok"}`}
              >
                {soles(margen)} <span className="text-[12px]">({margenPct.toFixed(0)}%)</span>
              </p>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
