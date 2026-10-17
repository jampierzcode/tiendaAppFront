import { useEffect, useState } from "react";
import { Button, InputNumber } from "antd";
import { apiTienda } from "../../api/apiTienda";

interface Props {
  productId?: number;
  variationId?: number;
  /** Costo guardado en el producto (último de compra o estimado). */
  costoActual?: number | null;
  precio?: number | null;
  /** Costo estimado escrito a mano (solo cuando no hay compras). */
  estimado?: number | null;
  onEstimado?: (v: number | null) => void;
}

const soles = (v: number) => `S/ ${Number(v).toFixed(2)}`;

/**
 * El costo no se escribe en el producto: sale de las compras, por proveedor.
 * Si todavía no hay compras (o no recuerdas el proveedor) se puede poner un
 * costo estimado para que el margen no salga inflado.
 */
export default function CostoReferencia({ productId, variationId, costoActual, precio, estimado, onEstimado }: Props) {
  const [proveedores, setProveedores] = useState<{ supplierId: number; supplier: string; ultimoCosto: number | null }[]>([]);
  const [verEstimado, setVerEstimado] = useState(false);

  useEffect(() => {
    if (!productId && !variationId) return;
    apiTienda
      .get("/purchases/cost-history", { params: { productId, variationId } })
      .then((r) => setProveedores((r.data.data.proveedores ?? []).filter((p: any) => p.ultimoCosto != null)))
      .catch(() => undefined);
  }, [productId, variationId]);

  const hayCompras = proveedores.length > 0;
  const costo = estimado ?? costoActual ?? null;
  const margen = costo != null && precio && precio > 0 ? Math.round(((precio - costo) / precio) * 100) : null;

  return (
    <div className="rounded-lg border border-line-soft p-3 text-[12px]">
      <p className="mb-1 font-medium text-ink">Costo de compra</p>

      {hayCompras ? (
        <ul className="space-y-0.5 text-ink-soft">
          {proveedores.map((p) => (
            <li key={p.supplierId}>
              {p.supplier}: último {soles(p.ultimoCosto!)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">
          Aún sin compras registradas. El costo se llena solo cuando registras una compra en Compras, y queda guardado por
          proveedor.
        </p>
      )}

      {costo != null && (
        <p className="mt-1 text-muted">
          Costo que se usa para el margen: {soles(costo)}
          {margen != null && ` · margen ${margen}%`}
        </p>
      )}

      {!hayCompras && onEstimado && (
        <div className="mt-2">
          {verEstimado || estimado != null ? (
            <div className="flex items-center gap-2">
              <InputNumber
                prefix="S/"
                min={0}
                precision={2}
                value={estimado ?? undefined}
                onChange={(v) => onEstimado(v == null ? null : Number(v))}
                style={{ width: 150 }}
              />
              <span className="text-muted">Estimado; se reemplaza con tu primera compra.</span>
            </div>
          ) : (
            <Button size="small" onClick={() => setVerEstimado(true)}>
              No tengo compras: poner un costo estimado
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
