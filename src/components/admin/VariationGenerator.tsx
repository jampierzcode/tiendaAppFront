import { useEffect, useMemo, useState } from "react";
import { Button, Input, InputNumber, Select, Table } from "antd";
import { apiTienda } from "../../api/apiTienda";

interface Atributo {
  id: number;
  name: string;
  values: { id: number; value: string }[];
}

export interface ComboNueva {
  key: string;
  valueIds: number[];
  label: string;
  /** Solo si el usuario lo cambió a mano; si no, lo genera el servidor. */
  sku?: string;
  stock: number;
}

interface Props {
  /** Combinaciones que ya existen (clave = ids ordenados) para no repetirlas. */
  existentes?: string[];
  /** SKU del producto, solo para mostrar cómo quedará cada variación. */
  skuProducto?: string;
  conStock?: boolean;
  onChange: (combos: ComboNueva[]) => void;
}

const abrev = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

export const claveCombo = (ids: number[]) => [...ids].sort((a, b) => a - b).join("-");

/**
 * Elige atributos y valores (Talla: S, M · Color: Negro) y arma todas las
 * combinaciones, cada una con su stock inicial y su SKU automático. Es la
 * misma forma de crear variaciones al crear o al editar el producto.
 */
export default function VariationGenerator({ existentes = [], skuProducto, conStock = true, onChange }: Props) {
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [elegidos, setElegidos] = useState<Record<number, number[]>>({});
  const [filas, setFilas] = useState<Record<string, { sku?: string; stock: number; editando?: boolean }>>({});

  useEffect(() => {
    apiTienda
      .get("/product-attributes")
      .then((r) => setAtributos(r.data.data ?? []))
      .catch(() => undefined);
  }, []);

  const combos: ComboNueva[] = useMemo(() => {
    const usados = atributos.filter((a) => (elegidos[a.id] ?? []).length > 0);
    if (!usados.length) return [];
    let acc: { ids: number[]; textos: string[] }[] = [{ ids: [], textos: [] }];
    for (const a of usados) {
      const sig: typeof acc = [];
      for (const base of acc) {
        for (const vid of elegidos[a.id]) {
          sig.push({
            ids: [...base.ids, vid],
            textos: [...base.textos, a.values.find((v) => v.id === vid)?.value ?? ""],
          });
        }
      }
      acc = sig;
    }
    return acc
      .filter((c) => !existentes.includes(claveCombo(c.ids)))
      .map((c) => {
        const key = claveCombo(c.ids);
        const f = filas[key];
        return { key, valueIds: c.ids, label: c.textos.join(" · "), sku: f?.sku, stock: f?.stock ?? 0 };
      });
  }, [atributos, elegidos, filas, existentes]);

  useEffect(() => {
    onChange(combos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combos]);

  const editar = (key: string, cambio: Partial<{ sku?: string; stock: number; editando?: boolean }>) =>
    setFilas((p) => ({ ...p, [key]: { ...(p[key] ?? { stock: 0 }), ...cambio } }));

  const previewSku = (c: ComboNueva) =>
    [skuProducto || "…", ...c.label.split(" · ").map(abrev)].filter(Boolean).join("-");

  if (!atributos.length) {
    return (
      <p className="text-[12px] text-muted">
        Aún no tienes atributos (talla, color…). Créalos en «Atributos» y vuelve aquí para elegirlos.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {atributos.map((a) => (
          <div key={a.id}>
            <p className="mb-1 text-[12px] text-muted">{a.name}</p>
            <Select
              mode="multiple"
              allowClear
              placeholder={`Elige ${a.name.toLowerCase()}`}
              value={elegidos[a.id] ?? []}
              onChange={(vals) => setElegidos((p) => ({ ...p, [a.id]: vals }))}
              options={a.values.map((v) => ({ value: v.id, label: v.value }))}
              style={{ width: "100%" }}
            />
          </div>
        ))}
      </div>

      {combos.length > 0 && (
        <Table
          className="mt-3"
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={combos}
          columns={[
            { title: "Variación", dataIndex: "label" },
            {
              title: "SKU",
              render: (_, c) => {
                const f = filas[c.key];
                return (
                  <div className="flex items-center gap-1">
                    <Input
                      size="small"
                      disabled={!f?.editando}
                      value={f?.editando ? (c.sku ?? "") : previewSku(c)}
                      onChange={(e) => editar(c.key, { sku: e.target.value })}
                      style={{ minWidth: 130 }}
                    />
                    <Button size="small" onClick={() => editar(c.key, { editando: !f?.editando, sku: f?.editando ? undefined : previewSku(c) })}>
                      {f?.editando ? "Auto" : "Editar"}
                    </Button>
                  </div>
                );
              },
            },
            ...(conStock
              ? [
                  {
                    title: "Stock inicial",
                    width: 120,
                    render: (_: unknown, c: ComboNueva) => (
                      <InputNumber
                        size="small"
                        min={0}
                        precision={0}
                        value={c.stock}
                        onChange={(q) => editar(c.key, { stock: Number(q ?? 0) })}
                        style={{ width: 90 }}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {combos.length > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          El precio y el IGV son los del producto; el SKU se arma solo. Si el producto ya tenía stock sin variaciones, pasa a la
          primera variación.
        </p>
      )}
    </div>
  );
}
