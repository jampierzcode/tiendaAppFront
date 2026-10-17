import { useEffect, useRef, useState } from "react";
import { Button, ColorPicker, InputNumber, Modal, Segmented, Slider, Spin, message } from "antd";
import { TbDownload } from "react-icons/tb";
import { PAPELES, crearCartel, maxLogoCm, maxQrCm, maxTarjetaCm, type PapelId } from "../../utilities/qrPoster";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  url: string;
  slug: string;
  nombre: string;
  logoUrl: string | null;
  portadaUrl: string | null;
  colorPrincipal: string;
  colorSecundario: string;
}

const cm = (mm: number) => Number((mm / 10).toFixed(1));

/**
 * Hoja en PDF con una tarjeta del tamaño que pide el dueño (en cm), rodeada de
 * una línea punteada para recortar. Logo arriba, nombre, QR y portada al pie.
 */
export default function QrPosterModal(p: Props) {
  const [papel, setPapel] = useState<PapelId>("a4");
  const [anchoCm, setAnchoCm] = useState(10);
  const [altoCm, setAltoCm] = useState(15);
  const [qrCm, setQrCm] = useState(7);
  const [logoCm, setLogoCm] = useState(4);
  const [colorPct, setColorPct] = useState(70);
  const [colorFondo, setColorFondo] = useState("#FFFFFF");
  const [colorPortada, setColorPortada] = useState(p.colorPrincipal || "#4F46E5");
  const [colorTexto, setColorTexto] = useState("#151243");
  const [vista, setVista] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [generando, setGenerando] = useState(false);
  const urlVista = useRef<string | null>(null);

  const tope = maxTarjetaCm(papel);
  const anchoEf = Math.min(anchoCm, tope.ancho);
  const altoEf = Math.min(altoCm, tope.alto);
  const maximo = maxQrCm(anchoEf, altoEf);
  const efectivo = Math.min(qrCm, maximo);
  const maxLogo = maxLogoCm(anchoEf);
  const logoEf = Math.min(logoCm, maxLogo);

  const opciones = () => ({
    papel,
    tarjetaAnchoCm: anchoEf,
    tarjetaAltoCm: altoEf,
    qrCm: efectivo,
    logoAnchoCm: logoEf,
    portadaColor: colorPct / 100,
    colorFondo,
    colorPortada,
    colorTexto,
    url: p.url,
    nombre: p.nombre,
    logoUrl: p.logoUrl,
    portadaUrl: p.portadaUrl,
    colorPrincipal: p.colorPrincipal,
    colorSecundario: p.colorSecundario,
  });

  // Vista previa: se regenera con un pequeño retraso al cambiar algo.
  useEffect(() => {
    if (!p.abierto) return;
    let vivo = true;
    setGenerando(true);
    const t = setTimeout(async () => {
      try {
        const notas: string[] = [];
        const doc = await crearCartel({ ...opciones(), avisos: notas });
        if (!vivo) return;
        setAvisos(notas);
        const nueva = URL.createObjectURL(doc.output("blob"));
        if (urlVista.current) URL.revokeObjectURL(urlVista.current);
        urlVista.current = nueva;
        setVista(`${nueva}#toolbar=0&navpanes=0&view=Fit`);
      } catch {
        if (vivo) message.error("No se pudo generar la vista previa");
      } finally {
        if (vivo) setGenerando(false);
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.abierto, papel, anchoEf, altoEf, efectivo, logoEf, colorPct, colorFondo, colorPortada, colorTexto, p.url, p.logoUrl, p.portadaUrl]);

  useEffect(
    () => () => {
      if (urlVista.current) URL.revokeObjectURL(urlVista.current);
    },
    []
  );

  const descargar = async () => {
    try {
      const doc = await crearCartel(opciones());
      doc.save(`mostrador-${p.slug}-${PAPELES[papel].nombre.toLowerCase()}.pdf`);
    } catch {
      message.error("No se pudo generar el PDF");
    }
  };

  const hoja = PAPELES[papel];

  return (
    <Modal
      open={p.abierto}
      onCancel={p.onCerrar}
      title="Descargar para mostrador"
      width="calc(100vw - 24px)"
      style={{ top: 12, maxWidth: "none", paddingBottom: 0 }}
      styles={{ body: { height: "calc(100vh - 160px)" } }}
      destroyOnHidden
      footer={[
        <Button key="c" onClick={p.onCerrar}>
          Cerrar
        </Button>,
        <Button key="d" type="primary" icon={<TbDownload />} onClick={descargar}>
          Descargar PDF
        </Button>,
      ]}
    >
      <div className="grid h-full gap-6 md:grid-cols-[320px_1fr]">
        <div className="space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="eyebrow mb-1.5">Tamaño de hoja</p>
            <Segmented
              block
              value={papel}
              onChange={(v) => setPapel(v as PapelId)}
              options={Object.entries(PAPELES).map(([id, h]) => ({ value: id, label: h.nombre }))}
            />
            <p className="mt-1.5 text-[12px] text-muted">
              {cm(hoja.ancho)} × {cm(hoja.alto)} cm. El PDF sale en esa hoja, listo para imprimir sin escalar.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Tamaño de la tarjeta</p>
            <div className="space-y-2">
              <InputNumber
                min={4}
                max={tope.ancho}
                step={0.5}
                value={anchoEf}
                onChange={(v) => setAnchoCm(Number(v ?? 4))}
                addonBefore="Ancho"
                addonAfter="cm"
                className="w-full"
              />
              <InputNumber
                min={6}
                max={tope.alto}
                step={0.5}
                value={altoEf}
                onChange={(v) => setAltoCm(Number(v ?? 6))}
                addonBefore="Alto"
                addonAfter="cm"
                className="w-full"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Máximo en {hoja.nombre}: {tope.ancho} × {tope.alto} cm. Se recorta por la línea punteada.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Ancho máximo del logo</p>
            <InputNumber
              min={1}
              max={maxLogo}
              step={0.5}
              value={logoEf}
              onChange={(v) => setLogoCm(Number(v ?? 1))}
              addonAfter="cm"
              className="w-full"
            />
            <p className="mt-1.5 text-[12px] text-muted">
              Hasta {maxLogo} cm. Un logo horizontal admite más ancho; uno cuadrado se limita por su altura.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Colores</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <label className="flex items-center gap-2">
                <ColorPicker
                  value={colorFondo}
                  onChange={(c) => setColorFondo(c.toHexString())}
                  showText
                  disabledAlpha
                />
                Fondo
              </label>
              <label className="flex items-center gap-2">
                <ColorPicker
                  value={colorTexto}
                  onChange={(c) => setColorTexto(c.toHexString())}
                  showText
                  disabledAlpha
                />
                Letras
              </label>
              <label className="flex items-center gap-2">
                <ColorPicker
                  value={colorPortada}
                  onChange={(c) => setColorPortada(c.toHexString())}
                  showText
                  disabledAlpha
                />
                Portada
              </label>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Color sobre la portada</p>
            <Slider min={0} max={100} step={5} value={colorPct} onChange={setColorPct} tooltip={{ formatter: (v) => `${v}%` }} />
            <p className="-mt-1 text-[12px] text-muted">
              {colorPct}% del color de portada. 0% deja la foto tal cual; 100% la tiñe por completo.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Tamaño del QR</p>
            <InputNumber
              min={2}
              max={maximo}
              step={0.5}
              value={efectivo}
              onChange={(v) => setQrCm(Number(v ?? 2))}
              addonAfter="cm"
              className="w-full"
            />
            <p className="mt-1.5 text-[12px] text-muted">
              Máximo en esta tarjeta: {maximo} cm. Si pides más, se ajusta solo para que no se corte.
            </p>
          </div>

          <p className="text-[12px] leading-relaxed text-muted">
            La tarjeta lleva tu logo, tu nombre, el QR y tu portada al pie. El QR va en vectores, así se ve nítido
            aunque lo imprimas grande.
          </p>
        </div>

        <div className="relative grid h-full min-h-[420px] place-items-center rounded-xl bg-canvas p-2 ring-1 ring-line">
          {generando && (
            <div className="absolute right-3 top-3 z-10">
              <Spin size="small" />
            </div>
          )}
          {avisos.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-warn-bg px-3 py-2 text-[12px] font-medium text-warn">
              {avisos.join(" · ")}
            </div>
          )}
          {vista ? (
            <iframe
              title="Vista previa del cartel"
              src={vista}
              className="h-full w-full rounded-lg bg-white"
            />
          ) : (
            <Spin />
          )}
        </div>
      </div>
    </Modal>
  );
}
