import { useState } from "react";
import { Button, Tooltip } from "antd";
import { TbArrowLeft, TbPlus, TbX } from "react-icons/tb";
import GalleryModal from "./GalleryModal";

export interface Foto {
  id: number;
  url: string;
}

const MAX = 10;

/**
 * Fotos extra (además de la principal): se eligen de la galería de la tienda,
 * se reordenan con la flecha y se quitan con la ×. La tienda online y el
 * vendedor IA las muestran en este orden.
 */
export default function GaleriaFotos({
  value,
  onChange,
  titulo = "Más fotos",
}: {
  value: Foto[];
  onChange: (f: Foto[]) => void;
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  const mover = (i: number) => {
    if (i === 0) return;
    const copia = [...value];
    [copia[i - 1], copia[i]] = [copia[i], copia[i - 1]];
    onChange(copia);
  };

  return (
    <div>
      <p className="mb-1 text-[13px] font-medium text-ink">
        {titulo} <span className="text-[12px] font-normal text-muted">({value.length}/{MAX})</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {value.map((f, i) => (
          <div key={f.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-canvas">
            <img src={f.url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 flex justify-between opacity-0 transition group-hover:opacity-100">
              {i > 0 ? (
                <Tooltip title="Mover antes">
                  <button
                    type="button"
                    className="grid h-5 w-5 place-items-center rounded-br bg-black/60 text-white"
                    onClick={() => mover(i)}
                  >
                    <TbArrowLeft size={12} />
                  </button>
                </Tooltip>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="grid h-5 w-5 place-items-center rounded-bl bg-black/60 text-white"
                onClick={() => onChange(value.filter((x) => x.id !== f.id))}
              >
                <TbX size={12} />
              </button>
            </div>
          </div>
        ))}
        {value.length < MAX && (
          <Button className="!h-16 !w-16" icon={<TbPlus />} onClick={() => setAbierto(true)} />
        )}
      </div>
      <GalleryModal
        open={abierto}
        onClose={() => setAbierto(false)}
        onSelect={(img) => {
          if (!value.some((x) => x.id === img.id)) onChange([...value, img]);
        }}
      />
    </div>
  );
}
