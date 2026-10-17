import { useEffect, useState } from "react";
import { AutoComplete, InputNumber, Modal, Segmented, message } from "antd";
import { apiTienda } from "../../api/apiTienda";

type Tipo = "entrada" | "salida" | "ajuste";

const motivos: Record<Tipo, string[]> = {
  entrada: ["Stock que ya tenía", "Reposición sin compra registrada", "Corrección de conteo", "Devolución de un cliente"],
  salida: ["Merma o producto dañado", "Pérdida o robo", "Uso interno o muestra", "Corrección de conteo"],
  ajuste: ["Conteo físico", "Inventario inicial", "Corrección de error"],
};

interface Props {
  open: boolean;
  /** Producto simple o variación a la que se le mueve el stock. */
  item: { id: number; nombre: string; stock: number } | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Movimiento manual de inventario para quien no lleva Compras: aumento,
 * disminución o ajuste. El stock no se edita a mano en un campo: siempre es un
 * movimiento con motivo, que queda en el historial.
 */
export default function MovementModal({ open, item, onClose, onDone }: Props) {
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo("entrada");
      setCantidad(null);
      setMotivo("");
    }
  }, [open]);

  if (!item) return null;

  const resultado =
    cantidad == null
      ? null
      : tipo === "entrada"
        ? item.stock + cantidad
        : tipo === "salida"
          ? item.stock - cantidad
          : cantidad;

  const guardar = async () => {
    if (cantidad == null) return;
    setGuardando(true);
    try {
      await apiTienda.post("/inventory/manual", {
        variationId: item.id,
        kind: tipo,
        quantity: cantidad,
        reason: motivo,
      });
      message.success("Movimiento registrado");
      onDone();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo registrar el movimiento");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Registrar movimiento · ${item.nombre}`}
      onCancel={onClose}
      onOk={guardar}
      okText="Registrar"
      cancelText="Cancelar"
      confirmLoading={guardando}
      okButtonProps={{ disabled: cantidad == null || motivo.trim().length < 3 || (resultado ?? 0) < 0 }}
      destroyOnClose
    >
      <div className="space-y-4 pt-2">
        <p className="text-[13px]">
          Stock actual: <b>{item.stock}</b>
        </p>

        <Segmented
          block
          value={tipo}
          onChange={(v) => {
            setTipo(v as Tipo);
            setCantidad(null);
          }}
          options={[
            { label: "Aumento", value: "entrada" },
            { label: "Disminución", value: "salida" },
            { label: "Ajuste", value: "ajuste" },
          ]}
        />

        <div>
          <p className="mb-1 text-[12px] text-muted">
            {tipo === "ajuste" ? "¿Cuántas unidades hay realmente?" : tipo === "entrada" ? "¿Cuántas unidades suman?" : "¿Cuántas unidades restan?"}
          </p>
          <InputNumber min={tipo === "ajuste" ? 0 : 1} precision={0} value={cantidad} onChange={(v) => setCantidad(v)} style={{ width: 160 }} />
          {resultado != null && (
            <p className={`mt-1 text-[12px] ${resultado < 0 ? "text-danger" : "text-muted"}`}>
              {resultado < 0 ? "No puedes dejar el stock bajo cero." : `Quedará en ${resultado}.`}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-[12px] text-muted">Motivo</p>
          <AutoComplete
            style={{ width: "100%" }}
            value={motivo}
            onChange={setMotivo}
            options={motivos[tipo].map((m) => ({ value: m }))}
            placeholder="Elige uno o escribe el tuyo"
          />
        </div>

        <p className="text-[11px] text-muted">
          Si es mercadería nueva que le compraste a un proveedor, regístrala en Compras: así también queda su costo.
        </p>
      </div>
    </Modal>
  );
}
