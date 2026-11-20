import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Empty, Input, InputNumber, Modal, Popconfirm, Select, Switch, Tag, message } from "antd";
import { TbPlus, TbTrash } from "react-icons/tb";
import dayjs, { type Dayjs } from "dayjs";
import { apiTienda } from "../api/apiTienda";
import PageHeader from "../components/ui/PageHeader";
import { errorDe, soles, type Insumo } from "./comun";

interface Compra {
  id: number;
  proveedor: string | null;
  documento: string | null;
  fecha: string;
  total: number;
  estado: "registrada" | "anulada";
  nota: string | null;
  lineas: { insumo: string; cantidad: number; unidad: string; precio: number; total: number; base: string }[];
}

interface Linea {
  ingredientId: number | null;
  quantity: number | null;
  inPurchaseUnit: boolean;
  unitPrice: number | null;
}

/**
 * Compras a proveedores: lo que entra al almacén. Cada compra sube el stock
 * y recalcula el costo promedio; se puede registrar por unidad de compra
 * (2 sacos) y el sistema la convierte a la unidad de uso (100 kg).
 */
export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[] | null>(null);
  const [nueva, setNueva] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await apiTienda.get("/stock/purchases");
      setCompras(data.data);
    } catch (e) {
      message.error(errorDe(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        titulo="Compras"
        descripcion="Lo que compras a tus proveedores. Al registrarla sube el stock de cada insumo y se recalcula su costo promedio."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => setNueva(true)}>
            Registrar compra
          </Button>
        }
      />
      {compras && !compras.length && <Empty description="Aún no registras compras" />}
      <div className="space-y-3">
        {(compras ?? []).map((c) => (
          <div key={c.id} className={`card p-4 ${c.estado === "anulada" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink">{c.proveedor ?? "Sin proveedor"}</span>
              {c.documento && <span className="text-[13px] text-muted">· {c.documento}</span>}
              <span className="text-[13px] text-muted">· {dayjs(c.fecha).format("DD/MM/YYYY")}</span>
              {c.estado === "anulada" && <Tag color="red">Anulada</Tag>}
              <span className="ml-auto font-mono font-semibold">{soles(c.total)}</span>
              {c.estado === "registrada" && (
                <Popconfirm
                  title="¿Anular la compra?"
                  description="Se descuenta del stock lo que había entrado."
                  okText="Anular"
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    try {
                      await apiTienda.post(`/stock/purchases/${c.id}/void`);
                      message.success("Compra anulada");
                      void cargar();
                    } catch (e) {
                      message.error(errorDe(e));
                    }
                  }}
                >
                  <Button size="small" danger type="text">
                    Anular
                  </Button>
                </Popconfirm>
              )}
            </div>
            <div className="mt-2 grid gap-1 text-[13px]">
              {c.lineas.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex-1">
                    {l.cantidad} {l.unidad} · {l.insumo} <span className="text-muted">(= {l.base})</span>
                  </span>
                  <span className="font-mono text-muted">
                    {soles(l.precio)} c/u · {soles(l.total)}
                  </span>
                </div>
              ))}
            </div>
            {c.nota && <div className="mt-1 text-[12px] text-muted">{c.nota}</div>}
          </div>
        ))}
      </div>

      {nueva && (
        <NuevaCompra
          onClose={() => setNueva(false)}
          onGuardada={() => {
            setNueva(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function NuevaCompra({ onClose, onGuardada }: { onClose: () => void; onGuardada: () => void }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<{ id: number; name: string }[]>([]);
  const [proveedor, setProveedor] = useState<number | null>(null);
  const [documento, setDocumento] = useState("");
  const [fecha, setFecha] = useState<Dayjs>(dayjs());
  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ ingredientId: null, quantity: null, inPurchaseUnit: true, unitPrice: null }]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    apiTienda.get("/ingredients").then((r) => setInsumos((r.data.data ?? []).filter((i: Insumo) => i.isActive && i.kind !== "preparacion")));
    apiTienda.get("/stock/suppliers").then((r) => setProveedores(r.data.data ?? []));
  }, []);

  const total = lineas.reduce((t, l) => t + Number(l.quantity ?? 0) * Number(l.unitPrice ?? 0), 0);
  const cambiar = (i: number, c: Partial<Linea>) => setLineas(lineas.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const nuevoProveedor = () => {
    let nombre = "";
    let ruc = "";
    Modal.confirm({
      title: "Nuevo proveedor",
      content: (
        <div className="space-y-2">
          <Input placeholder="Nombre" onChange={(e) => (nombre = e.target.value)} />
          <Input placeholder="RUC (opcional)" onChange={(e) => (ruc = e.target.value)} />
        </div>
      ),
      okText: "Crear",
      onOk: async () => {
        const { data } = await apiTienda.post("/stock/suppliers", { name: nombre, ruc });
        setProveedores((p) => [...p, data.data]);
        setProveedor(data.data.id);
      },
    });
  };

  return (
    <Modal
      open
      width={760}
      title="Registrar compra"
      okText={`Registrar ${soles(total)}`}
      confirmLoading={guardando}
      okButtonProps={{ disabled: !lineas.some((l) => l.ingredientId && l.quantity) }}
      onCancel={onClose}
      onOk={async () => {
        setGuardando(true);
        try {
          await apiTienda.post("/stock/purchases", {
            supplierId: proveedor,
            document: documento,
            date: fecha.format("YYYY-MM-DD"),
            note: nota,
            lines: lineas.filter((l) => l.ingredientId && l.quantity).map((l) => ({ ...l, unitPrice: l.unitPrice ?? 0 })),
          });
          message.success("Compra registrada: el stock ya subió");
          onGuardada();
        } catch (e) {
          message.error(errorDe(e));
        } finally {
          setGuardando(false);
        }
      }}
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_160px_150px]">
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Proveedor (opcional)"
          allowClear
          value={proveedor ?? undefined}
          onChange={(v) => setProveedor(v ?? null)}
          options={proveedores.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Button icon={<TbPlus />} onClick={nuevoProveedor}>
          Proveedor
        </Button>
        <Input placeholder="Factura / boleta" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        <DatePicker value={fecha} onChange={(d) => d && setFecha(d)} format="DD/MM/YYYY" />
      </div>
      <div className="mb-1 grid grid-cols-[1fr_110px_120px_120px_32px] gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
        <span>Insumo</span>
        <span>Cantidad</span>
        <span>Unidad</span>
        <span>Precio c/u</span>
        <span />
      </div>
      {lineas.map((l, i) => {
        const ins = insumos.find((x) => x.id === l.ingredientId);
        return (
          <div key={i} className="mb-2 grid grid-cols-[1fr_110px_120px_120px_32px] items-center gap-2">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Insumo"
              value={l.ingredientId ?? undefined}
              onChange={(v) => cambiar(i, { ingredientId: v, inPurchaseUnit: Boolean(insumos.find((x) => x.id === v)?.purchaseUnit) })}
              options={insumos.map((x) => ({ value: x.id, label: x.name }))}
            />
            <InputNumber min={0} value={l.quantity} onChange={(v) => cambiar(i, { quantity: v === null ? null : Number(v) })} />
            {ins?.purchaseUnit ? (
              <span className="flex items-center gap-1 text-[12.5px]">
                <Switch size="small" checked={l.inPurchaseUnit} onChange={(v) => cambiar(i, { inPurchaseUnit: v })} />
                {l.inPurchaseUnit ? ins.purchaseUnit : ins.unit}
              </span>
            ) : (
              <span className="text-[12.5px] text-muted">{ins?.unit ?? "—"}</span>
            )}
            <InputNumber min={0} prefix="S/" value={l.unitPrice} onChange={(v) => cambiar(i, { unitPrice: v === null ? null : Number(v) })} />
            <Button size="small" type="text" icon={<TbTrash />} onClick={() => setLineas(lineas.filter((_, j) => j !== i))} />
            {ins?.purchaseUnit && l.inPurchaseUnit && l.quantity ? (
              <span className="col-span-5 -mt-1 text-[11.5px] text-muted">
                = {(l.quantity * ins.purchaseFactor).toLocaleString("es-PE")} {ins.unit}
              </span>
            ) : null}
          </div>
        );
      })}
      <Button type="dashed" block icon={<TbPlus />} onClick={() => setLineas([...lineas, { ingredientId: null, quantity: null, inPurchaseUnit: true, unitPrice: null }])}>
        Agregar insumo
      </Button>
      <Input className="mt-3" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
    </Modal>
  );
}
