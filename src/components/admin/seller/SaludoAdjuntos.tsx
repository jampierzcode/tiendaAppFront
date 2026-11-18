import { useEffect, useRef, useState } from "react";
import { Button, Empty, Radio, Select, Spin, Tag, Upload, message } from "antd";
import { TbCheck, TbExternalLink, TbFileText, TbTrash, TbUpload } from "react-icons/tb";
import { apiTienda } from "../../../api/apiTienda";
import { MAX_PRODUCTOS_SALUDO, type Saludo } from "./tipos";

interface ProductoSaludo {
  id: number;
  nombre: string;
  precio: number;
  foto: string | null;
  activo?: boolean;
  vendidos?: number;
}

const ORIGEN_API = (() => {
  try {
    return new URL(import.meta.env.VITE_API_URL).origin;
  } catch {
    return "";
  }
})();
const absoluta = (u: string) => (/^https?:\/\//.test(u) ? u : `${ORIGEN_API}${u}`);

/**
 * Lo que acompaña al saludo: un catálogo en PDF (como archivo o como enlace)
 * y las fotos de hasta 5 productos, con su nombre y precio. Se sugieren los
 * más vendidos para que el dueño elija rápido.
 */
export default function SaludoAdjuntos({
  saludo,
  onChange,
  simbolo,
  disabled,
}: {
  saludo: Saludo;
  onChange: (s: Saludo) => void;
  simbolo: string;
  disabled?: boolean;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [sugeridos, setSugeridos] = useState<ProductoSaludo[] | null>(null);
  // Datos (nombre, foto) de todo producto que se haya visto: sugeridos, elegidos y búsquedas.
  const [conocidos, setConocidos] = useState<Record<number, ProductoSaludo>>({});
  const [busqueda, setBusqueda] = useState<ProductoSaludo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const recordar = (lista: ProductoSaludo[]) =>
    setConocidos((c) => ({ ...c, ...Object.fromEntries(lista.map((p) => [p.id, p])) }));

  useEffect(() => {
    apiTienda
      .get("/seller-config/greeting-products")
      .then((r) => {
        const d = r.data.data as { sugeridos: ProductoSaludo[]; elegidos: ProductoSaludo[] };
        setSugeridos(d.sugeridos);
        recordar([...d.sugeridos, ...d.elegidos]);
      })
      .catch(() => setSugeridos([]));
  }, []);

  const subir = async (file: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("documento", file);
      const r = await apiTienda.post("/seller-config/greeting-document", fd);
      const d = r.data.data as { url: string; nombre: string };
      onChange({ ...saludo, documento: { url: d.url, nombre: d.nombre.replace(/\.[^.]+$/, "") } });
      message.success("Documento listo. Guarda los cambios para usarlo.");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo subir el documento");
    } finally {
      setSubiendo(false);
    }
    return false;
  };

  const elegidos = saludo.productos;
  const lleno = elegidos.length >= MAX_PRODUCTOS_SALUDO;
  const alternar = (id: number) => {
    if (elegidos.includes(id)) {
      onChange({ ...saludo, productos: elegidos.filter((x) => x !== id) });
    } else if (lleno) {
      message.info(`Puedes elegir hasta ${MAX_PRODUCTOS_SALUDO} productos`);
    } else {
      onChange({ ...saludo, productos: [...elegidos, id] });
    }
  };

  const buscar = (q: string) => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setBusqueda([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await apiTienda.get("/products", {
          params: { search: q.trim(), status: "activo", page: 1, perPage: 10 },
        });
        const lista: ProductoSaludo[] = (r.data.data ?? []).map((p: any) => {
          const propias = (p.variations ?? []).filter((v: any) => !v.isDefault);
          const precios = (propias.length ? propias : p.variations ?? []).map((v: any) => Number(v.price));
          return {
            id: p.id,
            nombre: p.name,
            precio: precios.length ? Math.min(...precios) : Number(p.price),
            foto: p.businessImages?.url ?? null,
          };
        });
        setBusqueda(lista);
        recordar(lista);
      } catch {
        setBusqueda([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
  };

  const doc = saludo.documento;

  return (
    <div className={`space-y-5 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Documento */}
      <div>
        <label className="text-[13px] font-semibold text-ink">Catálogo o documento (opcional)</label>
        <p className="mb-2 text-[12px] text-muted">
          Un PDF con tu catálogo, lista de precios o carta (también Word, Excel o PowerPoint; hasta 16 MB).
        </p>
        {doc ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-line-soft p-2">
              <TbFileText className="shrink-0 text-xl text-brand-600" />
              <span className="flex-1 truncate text-[13px]">{doc.nombre}</span>
              <a href={doc.enlace ?? absoluta(doc.url)} target="_blank" rel="noreferrer" className="text-[12px]">
                <TbExternalLink className="inline" /> Ver
              </a>
              <Upload accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" showUploadList={false} beforeUpload={subir}>
                <Button size="small" loading={subiendo}>
                  Cambiar
                </Button>
              </Upload>
              <Button
                size="small"
                type="text"
                danger
                icon={<TbTrash />}
                onClick={() => onChange({ ...saludo, documento: null })}
              />
            </div>
            <Radio.Group
              value={saludo.documentoComo}
              onChange={(e) => onChange({ ...saludo, documentoComo: e.target.value })}
              className="flex flex-col gap-1"
              options={[
                { value: "archivo", label: "Enviar el archivo (le llega el PDF en el chat)" },
                { value: "enlace", label: "Enviar el enlace dentro del saludo (lo abre para verlo)" },
              ]}
            />
          </div>
        ) : (
          <Upload accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" showUploadList={false} beforeUpload={subir}>
            <Button icon={<TbUpload />} loading={subiendo}>
              Subir documento
            </Button>
          </Upload>
        )}
      </div>

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-semibold text-ink">Productos destacados (opcional)</label>
          <span className="text-[12px] text-muted">
            {elegidos.length}/{MAX_PRODUCTOS_SALUDO}
          </span>
        </div>
        <p className="mb-2 text-[12px] text-muted">
          Sus fotos, con nombre y precio, llegan después del saludo. Te sugerimos tus más vendidos: toca para
          elegir.
        </p>

        {sugeridos === null ? (
          <Spin size="small" />
        ) : sugeridos.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no hay productos activos con foto" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sugeridos.map((p) => {
              const on = elegidos.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternar(p.id)}
                  className={`relative overflow-hidden rounded-lg border text-left transition ${
                    on ? "border-brand-500 ring-2 ring-brand-200" : "border-line-soft hover:border-brand-300"
                  } ${!on && lleno ? "opacity-50" : ""}`}
                >
                  {p.foto && <img src={p.foto} alt="" className="h-20 w-full object-cover" />}
                  {on && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
                      <TbCheck size={14} />
                    </span>
                  )}
                  <div className="p-1.5">
                    <p className="truncate text-[12px] font-medium">{p.nombre}</p>
                    <p className="text-[11px] text-muted">
                      {simbolo}
                      {Number(p.precio).toFixed(2)}
                      {p.vendidos ? ` · ${p.vendidos} vendidos` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Select
          className="mt-2 w-full"
          showSearch
          value={null}
          placeholder="Buscar otro producto…"
          filterOption={false}
          onSearch={buscar}
          notFoundContent={buscando ? <Spin size="small" /> : null}
          disabled={lleno}
          onChange={(id: number) => alternar(id)}
          options={busqueda.map((p) => ({
            value: p.id,
            label: `${p.nombre} · ${simbolo}${Number(p.precio).toFixed(2)}${p.foto ? "" : " (sin foto)"}`,
            disabled: !p.foto || elegidos.includes(p.id),
          }))}
        />

        {elegidos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {elegidos.map((id, i) => (
              <Tag key={id} closable onClose={() => alternar(id)} color="purple">
                {i + 1}. {conocidos[id]?.nombre ?? `Producto #${id}`}
                {conocidos[id]?.activo === false ? " (inactivo, no se envía)" : ""}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
