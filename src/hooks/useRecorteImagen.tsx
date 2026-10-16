import { useCallback, useRef, useState, type ReactNode } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button, Modal, Segmented, Slider } from "antd";

/** Gris de fondo de la tienda: rellena los bordes cuando la foto se ajusta completa. */
const FONDO = "#f0f1f3";
const LADO_MAX = 1200;

const FORMATOS = [
  { label: "Cuadrada 1:1", value: 1 },
  { label: "Horizontal 4:3", value: 4 / 3 },
  { label: "Portada 16:9", value: 16 / 9 },
];

const cargar = (src: string) =>
  new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });

/** Dibuja el área elegida (puede salirse de la foto: queda el fondo gris). */
async function recortar(src: string, area: Area, nombre: string): Promise<File> {
  const img = await cargar(src);
  const escala = Math.min(1, LADO_MAX / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * escala);
  canvas.height = Math.round(area.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    img,
    -area.x * escala,
    -area.y * escala,
    img.naturalWidth * escala,
    img.naturalHeight * escala
  );
  const blob: Blob = await new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo recortar"))), "image/webp", 0.92)
  );
  return new File([blob], nombre.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
}

interface Pendiente {
  file: File;
  src: string;
  ancho: number;
  alto: number;
  resolver: (f: File | null) => void;
}

/**
 * Editor de recorte para las subidas de fotos.
 *
 * `pedirRecorte(file)` abre el editor y devuelve el archivo recortado, el
 * original si la persona elige "Subir sin recortar", o `null` si cancela.
 * Si se eligen varias fotos a la vez se editan una tras otra.
 */
export function useRecorteImagen() {
  const [actual, setActual] = useState<Pendiente | null>(null);
  const [aspecto, setAspecto] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [area, setArea] = useState<Area | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const abrir = useCallback(async (file: File) => {
    const src = URL.createObjectURL(file);
    const img = await cargar(src);
    return new Promise<File | null>((resolver) => {
      setAspecto(1);
      setZoom(1);
      setPos({ x: 0, y: 0 });
      setArea(null);
      setActual({ file, src, ancho: img.naturalWidth, alto: img.naturalHeight, resolver });
    });
  }, []);

  const pedirRecorte = useCallback(
    (file: File): Promise<File | null> => {
      // GIF/SVG no se pueden recortar con canvas sin perder algo: pasan tal cual.
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return Promise.resolve(file);
      const turno = cola.current.then(() => abrir(file));
      cola.current = turno.catch(() => undefined);
      return turno;
    },
    [abrir]
  );

  const cerrar = (resultado: File | null) => {
    if (!actual) return;
    URL.revokeObjectURL(actual.src);
    actual.resolver(resultado);
    setActual(null);
  };

  /** Zoom con el que la foto entera cabe dentro del marco (sin cortar nada). */
  const zoomCompleta = () => {
    if (!actual) return 1;
    const rf = actual.ancho / actual.alto;
    return Math.min(rf / aspecto, aspecto / rf, 1);
  };

  const aceptar = async () => {
    if (!actual || !area) return;
    setGuardando(true);
    try {
      cerrar(await recortar(actual.src, area, actual.file.name));
    } finally {
      setGuardando(false);
    }
  };

  const modal: ReactNode = (
    <Modal
      open={actual !== null}
      title="Ajusta tu foto"
      width={560}
      onCancel={() => cerrar(null)}
      maskClosable={false}
      destroyOnHidden
      footer={[
        <Button key="x" onClick={() => cerrar(null)}>
          Cancelar
        </Button>,
        <Button key="o" onClick={() => cerrar(actual!.file)}>
          Subir sin recortar
        </Button>,
        <Button key="ok" type="primary" loading={guardando} onClick={aceptar}>
          Recortar y subir
        </Button>,
      ]}
    >
      {actual && (
        <div className="space-y-3">
          <div className="relative h-[340px] overflow-hidden rounded-lg" style={{ background: FONDO }}>
            <Cropper
              image={actual.src}
              crop={pos}
              zoom={zoom}
              aspect={aspecto}
              minZoom={0.3}
              maxZoom={4}
              restrictPosition={false}
              showGrid
              onCropChange={setPos}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
              style={{ containerStyle: { background: FONDO } }}
            />
          </div>

          <Segmented
            block
            options={FORMATOS}
            value={aspecto}
            onChange={(v) => {
              setAspecto(v as number);
              setZoom(1);
              setPos({ x: 0, y: 0 });
            }}
          />

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Zoom</span>
            <Slider className="flex-1" min={0.3} max={4} step={0.01} value={zoom} onChange={setZoom} tooltip={{ open: false }} />
            <Button
              size="small"
              onClick={() => {
                setZoom(zoomCompleta());
                setPos({ x: 0, y: 0 });
              }}
            >
              Ver completa
            </Button>
            <Button
              size="small"
              onClick={() => {
                setZoom(1);
                setPos({ x: 0, y: 0 });
              }}
            >
              Centrar
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Arrastra para mover y usa el zoom. Si dejas bordes, se rellenan con el gris de la tienda.
          </p>
        </div>
      )}
    </Modal>
  );

  return { pedirRecorte, modal };
}
