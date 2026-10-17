import { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Select, Table, message } from "antd";
import { apiTienda } from "../../api/apiTienda";

interface Atributo {
  id: number;
  name: string;
  values: { id: number; value: string }[];
}

/** Línea lista para la orden de compra. */
export interface LineaNueva {
  variationId: number;
  quantity: number;
  unitCost: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Si viene, solo se agregan tallas/colores a este producto existente. */
  producto?: { id: number; name: string; price: number } | null;
  onCreated: (lineas: LineaNueva[]) => void;
}

interface Combinacion {
  key: string;
  valueIds: number[];
  label: string;
  quantity: number;
  unitCost: number | null;
}

/**
 * Crea un producto nuevo (o agrega tallas a uno existente) sin salir de
 * Compras. El precio de venta es uno solo, el del producto; lo que se escribe
 * por variante es el costo de esta compra.
 */
export default function QuickProductModal({ open, onClose, producto, onCreated }: Props) {
  const [form] = Form.useForm();
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [elegidos, setElegidos] = useState<Record<number, number[]>>({});
  const [filas, setFilas] = useState<Record<string, { quantity: number; unitCost: number | null }>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setElegidos({});
    setFilas({});
    apiTienda
      .get("/product-attributes")
      .then((r) => setAtributos(r.data.data ?? []))
      .catch(() => message.error("No se pudieron cargar los atributos"));
  }, [open, form]);

  const costoComun = Form.useWatch("cost", form) as number | undefined;

  // Producto cartesiano de los valores elegidos por atributo.
  const combinaciones: Combinacion[] = useMemo(() => {
    const usados = atributos.filter((a) => (elegidos[a.id] ?? []).length > 0);
    if (!usados.length) return [];
    let acc: { ids: number[]; textos: string[] }[] = [{ ids: [], textos: [] }];
    for (const a of usados) {
      const siguiente: typeof acc = [];
      for (const base of acc) {
        for (const vid of elegidos[a.id]) {
          const valor = a.values.find((v) => v.id === vid)?.value ?? "";
          siguiente.push({ ids: [...base.ids, vid], textos: [...base.textos, valor] });
        }
      }
      acc = siguiente;
    }
    return acc.map((c) => {
      const key = c.ids.join("-");
      const fila = filas[key];
      return {
        key,
        valueIds: c.ids,
        label: c.textos.join(" · "),
        quantity: fila?.quantity ?? 1,
        unitCost: fila?.unitCost ?? costoComun ?? null,
      };
    });
  }, [atributos, elegidos, filas, costoComun]);

  const editarFila = (key: string, cambio: Partial<{ quantity: number; unitCost: number | null }>) =>
    setFilas((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { quantity: 1, unitCost: null }), ...cambio },
    }));

  const guardar = async (v: any) => {
    const nuevo = !producto;
    if (!nuevo && !combinaciones.length) {
      message.error("Elige al menos una talla, color u otro atributo");
      return;
    }
    if (combinaciones.some((c) => c.unitCost == null)) {
      message.error("Falta el costo de alguna variación");
      return;
    }

    setGuardando(true);
    try {
      const lineas: LineaNueva[] = [];

      if (nuevo) {
        const res = await apiTienda.post("/products/quick", {
          name: v.name,
          price: v.price,
          cost: v.cost ?? undefined,
          sku: v.sku || undefined,
          variations: combinaciones.map((c) => ({ attributeValueIds: c.valueIds })),
        });
        const creadas: { id: number; attributes?: any[] }[] = res.data.data.variations ?? [];
        if (!combinaciones.length) {
          lineas.push({ variationId: creadas[0].id, quantity: 1, unitCost: v.cost ?? 0 });
        } else {
          // El servidor devuelve las variaciones en el orden enviado.
          combinaciones.forEach((c, i) =>
            lineas.push({ variationId: creadas[i].id, quantity: c.quantity, unitCost: c.unitCost ?? 0 })
          );
        }
      } else {
        // Una por una: cada alta es atómica y la primera traslada el stock del
        // producto simple. Si una falla, las anteriores ya quedaron creadas.
        for (const c of combinaciones) {
          const res = await apiTienda.post("/product-variations", {
            product_id: producto!.id,
            attributeValueIds: c.valueIds,
            cost: c.unitCost,
            stock: 0,
          });
          lineas.push({ variationId: res.data.data.id, quantity: c.quantity, unitCost: c.unitCost ?? 0 });
        }
      }

      onCreated(lineas);
      message.success(nuevo ? "Producto creado y agregado a la orden" : "Variaciones agregadas a la orden");
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={producto ? `Nueva talla o color · ${producto.name}` : "Producto nuevo"}
      okText={producto ? "Agregar a la orden" : "Crear y agregar a la orden"}
      cancelText="Cancelar"
      onOk={() => form.submit()}
      confirmLoading={guardando}
      width={680}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={guardar} className="pt-2">
        {!producto && (
          <>
            <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "Escribe el nombre" }]}>
              <Input placeholder="Casaca denim" />
            </Form.Item>
            <div className="grid gap-x-4 sm:grid-cols-3">
              <Form.Item
                name="price"
                label="Precio de venta"
                extra="Uno solo, para todas las variaciones."
                rules={[{ required: true, message: "Falta el precio" }]}
              >
                <InputNumber prefix="S/" min={0} precision={2} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="cost" label="Costo de compra" extra="Lo que pagas por unidad.">
                <InputNumber prefix="S/" min={0} precision={2} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="sku" label="SKU (opcional)">
                <Input />
              </Form.Item>
            </div>
          </>
        )}

        {producto && (
          <p className="mb-3 rounded-lg bg-info-bg px-3 py-2 text-[12px] text-info">
            Se vende a S/ {Number(producto.price).toFixed(2)} (precio base del producto). Aquí solo
            escribes el costo de esta compra.
            <Form.Item name="cost" label="Costo por defecto" className="!mb-0 mt-2">
              <InputNumber prefix="S/" min={0} precision={2} style={{ width: 160 }} />
            </Form.Item>
          </p>
        )}

        <p className="eyebrow mb-2">{producto ? "Tallas, colores…" : "Variaciones (opcional)"}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {atributos.map((a) => (
            <div key={a.id}>
              <p className="mb-1 text-[12px] text-muted">{a.name}</p>
              <Select
                mode="multiple"
                allowClear
                placeholder={`Elige ${a.name.toLowerCase()}`}
                value={elegidos[a.id] ?? []}
                onChange={(vals) => setElegidos((prev) => ({ ...prev, [a.id]: vals }))}
                options={a.values.map((v) => ({ value: v.id, label: v.value }))}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
        {atributos.length === 0 && (
          <p className="text-[12px] text-muted">
            Aún no tienes atributos (talla, color…). Créalos en «Atributos» para vender por variaciones.
          </p>
        )}

        {combinaciones.length > 0 && (
          <Table
            className="mt-4"
            size="small"
            rowKey="key"
            pagination={false}
            dataSource={combinaciones}
            columns={[
              { title: "Variación", dataIndex: "label" },
              {
                title: "Cantidad",
                width: 110,
                render: (_, c) => (
                  <InputNumber
                    min={1}
                    value={c.quantity}
                    onChange={(q) => editarFila(c.key, { quantity: Number(q ?? 1) })}
                    style={{ width: 90 }}
                  />
                ),
              },
              {
                title: "Costo unit.",
                width: 140,
                render: (_, c) => (
                  <InputNumber
                    prefix="S/"
                    min={0}
                    precision={2}
                    value={c.unitCost}
                    onChange={(q) => editarFila(c.key, { unitCost: q == null ? null : Number(q) })}
                    style={{ width: 120 }}
                  />
                ),
              },
            ]}
          />
        )}

        {!producto && combinaciones.length === 0 && (
          <p className="mt-3 text-[12px] text-muted">
            Sin variaciones se crea como producto simple (una sola cantidad y costo).
          </p>
        )}

        <Button htmlType="submit" className="hidden" />
      </Form>
    </Modal>
  );
}
