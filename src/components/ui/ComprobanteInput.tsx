import { useState } from "react";
import { Button, message } from "antd";
import { TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import SelectorFoto from "./SelectorFoto";

export interface Comprobante {
  url: string;
  key: string;
}

interface Props {
  value: Comprobante | null;
  onChange: (v: Comprobante | null) => void;
}

/**
 * Foto del comprobante de un cobro (captura de Yape, voucher). Se sube al
 * instante y queda ligada al pago; no entra en la galería del negocio.
 */
export default function ComprobanteInput({ value, onChange }: Props) {
  const [subiendo, setSubiendo] = useState(false);

  const subir = async ([file]: File[]) => {
    const form = new FormData();
    form.append("file", file);
    setSubiendo(true);
    try {
      const r = await apiTienda.post("/payments/receipt", form);
      onChange(r.data.data);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-canvas">
        {value ? (
          <a href={value.url} target="_blank" rel="noopener noreferrer">
            <img src={value.url} alt="Comprobante" className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="grid h-full place-items-center text-[10px] text-muted">Sin foto</div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <SelectorFoto onFiles={subir} loading={subiendo} textoSubir={value ? "Cambiar" : "Subir captura"} />
        {value && (
          <Button icon={<TbTrash />} danger onClick={() => onChange(null)} aria-label="Quitar foto" />
        )}
      </div>
    </div>
  );
}
