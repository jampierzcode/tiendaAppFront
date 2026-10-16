import { useRef } from "react";
import { Button } from "antd";
import { TbCamera, TbUpload } from "react-icons/tb";

interface Props {
  /** Se llama una vez por cada foto elegida o tomada. */
  onFiles: (files: File[]) => void;
  loading?: boolean;
  multiple?: boolean;
  size?: "small" | "middle" | "large";
  textoSubir?: string;
}

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif";

/**
 * «Subir imagen» (galería del teléfono o archivos) y «Tomar foto» (abre la
 * cámara en el celular; en computadora abre el selector de archivos).
 */
export default function SelectorFoto({
  onFiles,
  loading,
  multiple = false,
  size = "middle",
  textoSubir = "Subir imagen",
}: Props) {
  const archivo = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);

  const alElegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite elegir la misma foto otra vez
    if (files.length) onFiles(files);
  };

  return (
    <>
      <input ref={archivo} type="file" accept={ACEPTA} multiple={multiple} hidden onChange={alElegir} />
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />
      <Button size={size} icon={<TbUpload />} loading={loading} onClick={() => archivo.current?.click()}>
        {textoSubir}
      </Button>
      <Button size={size} icon={<TbCamera />} disabled={loading} onClick={() => camara.current?.click()}>
        Tomar foto
      </Button>
    </>
  );
}
