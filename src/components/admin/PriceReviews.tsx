import { useCallback, useEffect, useState } from "react";
import { Button, InputNumber, Modal, message } from "antd";
import { TbAlertTriangle } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";

interface Revision {
  id: number;
  productId: number;
  oldCost: number;
  newCost: number;
  currentPrice: number;
  suggestedPrice: number;
  product?: { name: string };
}

const soles = (v: number) => `S/ ${Number(v ?? 0).toFixed(2)}`;

/**
 * Costos que subieron. Solo sugiere: el precio cambia cuando tú lo eliges y
 * confirmas, y nunca afecta las ventas ya hechas.
 */
export default function PriceReviews({ onApplied }: { onApplied?: () => void }) {
  const [lista, setLista] = useState<Revision[]>([]);
  const [editando, setEditando] = useState<Revision | null>(null);
  const [precio, setPrecio] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await apiTienda.get("/price-reviews");
      setLista(r.data.data ?? []);
    } catch {
      /* no bloquea la pantalla de compras */
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (r: Revision) => {
    setEditando(r);
    setPrecio(Number(r.suggestedPrice));
  };

  const aplicar = async () => {
    if (!editando || precio == null) return;
    setGuardando(true);
    try {
      // Primero la vista previa; el cambio real exige confirmación explícita.
      const previa = await apiTienda.post(`/products/${editando.productId}/price`, { price: precio });
      const v = previa.data.data;
      Modal.confirm({
        title: `Cambiar el precio de ${v.producto}`,
        content: (
          <div className="space-y-1 text-[13px]">
            <p>
              De <b>{soles(v.precioActual)}</b> a <b>{soles(v.precioNuevo)}</b>
              {v.margenNuevo != null && ` (margen ${v.margenNuevo}%)`}.
            </p>
            <p>Se aplica a las {v.variacionesAfectadas} variaciones del producto. Las ventas pasadas no cambian.</p>
          </div>
        ),
        okText: "Sí, cambiar precio",
        cancelText: "Volver",
        onOk: async () => {
          await apiTienda.post(`/products/${editando.productId}/price`, { price: precio, confirm: true });
          message.success("Precio actualizado");
          setEditando(null);
          await cargar();
          onApplied?.();
        },
      });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo preparar el cambio");
    } finally {
      setGuardando(false);
    }
  };

  const descartar = async (r: Revision) => {
    try {
      await apiTienda.post(`/price-reviews/${r.id}/dismiss`);
      await cargar();
    } catch {
      message.error("No se pudo descartar");
    }
  };

  if (!lista.length) return null;

  return (
    <div className="card mb-5 border-warn p-4">
      <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-ink">
        <TbAlertTriangle className="text-warn" /> Subió el costo: revisa estos precios
      </p>
      <ul className="divide-y divide-line-soft">
        {lista.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{r.product?.name}</p>
              <p className="text-[11px] text-muted">
                Costo {soles(r.oldCost)} → {soles(r.newCost)} · Precio actual {soles(r.currentPrice)} · Sugerido{" "}
                {soles(r.suggestedPrice)}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button size="small" type="primary" onClick={() => abrir(r)}>
                Revisar precio
              </Button>
              <Button size="small" onClick={() => descartar(r)}>
                Dejar igual
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={!!editando}
        title={`Precio de venta · ${editando?.product?.name ?? ""}`}
        onCancel={() => setEditando(null)}
        onOk={aplicar}
        okText="Continuar"
        cancelText="Cancelar"
        confirmLoading={guardando}
      >
        {editando && (
          <div className="space-y-3 pt-2 text-[13px]">
            <p>
              El costo pasó de {soles(editando.oldCost)} a {soles(editando.newCost)}. Con tu margen actual se sugiere{" "}
              {soles(editando.suggestedPrice)}.
            </p>
            <InputNumber prefix="S/" min={0} precision={2} value={precio} onChange={(v) => setPrecio(v)} style={{ width: 160 }} />
            {precio != null && precio > 0 && (
              <p className="text-[12px] text-muted">
                Margen con este precio: {Math.round(((precio - editando.newCost) / precio) * 100)}%
              </p>
            )}
            <p className="text-[11px] text-muted">No cambia nada todavía: te pediremos confirmar en el siguiente paso.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
