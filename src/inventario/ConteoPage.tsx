import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Input, InputNumber, Modal, Popconfirm, Select, Spin, Tag, message } from "antd";
import { TbArrowLeft, TbClipboardCheck, TbPlus } from "react-icons/tb";
import dayjs from "dayjs";
import { apiTienda } from "../api/apiTienda";
import PageHeader from "../components/ui/PageHeader";
import { errorDe, num, soles, type Insumo } from "./comun";

interface ConteoResumen {
  id: number;
  estado: "borrador" | "cerrado";
  categoria: string | null;
  nota: string | null;
  creado: string;
  cerrado: string | null;
  diferencia: number | null;
}

interface Conteo extends ConteoResumen {
  lineas: {
    ingredientId: number;
    nombre: string;
    unidad: string;
    categoria: string | null;
    esperado: number;
    contado: number | null;
    diferencia: number | null;
    costo: number;
  }[];
}

/**
 * Conteo físico (toma de inventario): se cuenta lo que hay de verdad y, al
 * cerrar, la diferencia con el sistema se ajusta sola y queda registrada
 * como faltante o sobrante, con su costo.
 */
export default function ConteoPage() {
  const [lista, setLista] = useState<ConteoResumen[] | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await apiTienda.get("/stock/counts");
      setLista(data.data);
    } catch (e) {
      message.error(errorDe(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (abierto) {
    return (
      <HojaConteo
        id={abierto}
        onVolver={() => {
          setAbierto(null);
          void cargar();
        }}
      />
    );
  }

  const enCurso = lista?.find((c) => c.estado === "borrador");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titulo="Conteo físico"
        descripcion="Cuenta lo que hay en tu almacén. Al cerrar el conteo, la diferencia con el sistema se ajusta sola y queda como faltante o sobrante."
        acciones={
          enCurso ? (
            <Button type="primary" icon={<TbClipboardCheck />} onClick={() => setAbierto(enCurso.id)}>
              Seguir contando
            </Button>
          ) : (
            <Button type="primary" icon={<TbPlus />} onClick={() => setNuevo(true)}>
              Nuevo conteo
            </Button>
          )
        }
      />
      {lista && !lista.length && <Empty description="Aún no haces conteos" />}
      <div className="space-y-2">
        {(lista ?? []).map((c) => (
          <button key={c.id} onClick={() => setAbierto(c.id)} className="card flex w-full items-center gap-3 p-4 text-left">
            <TbClipboardCheck className="text-[20px] text-brand-600" />
            <span className="flex-1">
              <span className="block font-semibold text-ink">
                Conteo #{c.id} · {c.categoria ?? "Todo el almacén"}
              </span>
              <span className="block text-[12.5px] text-muted">
                {dayjs(c.creado).format("DD/MM/YYYY HH:mm")}
                {c.cerrado ? ` · cerrado ${dayjs(c.cerrado).format("DD/MM HH:mm")}` : ""}
                {c.nota ? ` · ${c.nota}` : ""}
              </span>
            </span>
            {c.estado === "borrador" ? (
              <Tag color="orange">En curso</Tag>
            ) : (
              <span className={`font-mono font-semibold ${Number(c.diferencia) < 0 ? "text-danger" : "text-ok"}`}>{soles(c.diferencia ?? 0)}</span>
            )}
          </button>
        ))}
      </div>
      {nuevo && (
        <NuevoConteo
          onClose={() => setNuevo(false)}
          onCreado={(id) => {
            setNuevo(false);
            setAbierto(id);
          }}
        />
      )}
    </div>
  );
}

function NuevoConteo({ onClose, onCreado }: { onClose: () => void; onCreado: (id: number) => void }) {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<string>("");
  const [nota, setNota] = useState("");
  useEffect(() => {
    apiTienda.get("/ingredients").then((r) => {
      const cats = [...new Set((r.data.data as Insumo[]).map((i) => i.category).filter((c): c is string => Boolean(c)))];
      setCategorias(cats.sort());
    });
  }, []);
  return (
    <Modal
      open
      title="Nuevo conteo"
      okText="Empezar"
      onCancel={onClose}
      onOk={async () => {
        try {
          const { data } = await apiTienda.post("/stock/counts", { category: categoria || null, note: nota });
          onCreado(data.data.id);
        } catch (e) {
          message.error(errorDe(e));
        }
      }}
    >
      <p className="mb-2 text-[13px] text-muted">Puedes contar todo el almacén o una categoría a la vez (por ejemplo, hoy Bebidas).</p>
      <Select className="w-full" value={categoria} onChange={setCategoria} options={[{ value: "", label: "Todo el almacén" }, ...categorias.map((c) => ({ value: c, label: c }))]} />
      <Input className="mt-2" placeholder="Nota (opcional): cierre de mes…" value={nota} onChange={(e) => setNota(e.target.value)} />
    </Modal>
  );
}

function HojaConteo({ id, onVolver }: { id: number; onVolver: () => void }) {
  const [c, setC] = useState<Conteo | null>(null);
  const [valores, setValores] = useState<Record<number, number | null>>({});
  const [guardando, setGuardando] = useState(false);
  const [buscar, setBuscar] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await apiTienda.get(`/stock/counts/${id}`);
    setC(data.data);
    setValores(Object.fromEntries((data.data.lineas as Conteo["lineas"]).map((l) => [l.ingredientId, l.contado])));
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!c) return <Spin />;
  const borrador = c.estado === "borrador";
  const guardar = async () => {
    setGuardando(true);
    try {
      await apiTienda.put(`/stock/counts/${id}`, { values: valores });
      message.success("Avance guardado");
    } catch (e) {
      message.error(errorDe(e));
    } finally {
      setGuardando(false);
    }
  };
  const contados = Object.values(valores).filter((v) => v !== null && v !== undefined).length;
  const lineas = c.lineas.filter((l) => !buscar || l.nombre.toLowerCase().includes(buscar.toLowerCase()));
  const valorDif = c.lineas.reduce((t, l) => {
    const v = valores[l.ingredientId];
    return v === null || v === undefined ? t : t + (v - l.esperado) * l.costo;
  }, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button icon={<TbArrowLeft />} onClick={onVolver} />
        <div className="flex-1">
          <div className="text-[20px] font-bold text-ink">
            Conteo #{c.id} · {c.categoria ?? "Todo el almacén"}
          </div>
          <div className="text-[12.5px] text-muted">
            {borrador ? `${contados} de ${c.lineas.length} contados · diferencia estimada ${soles(valorDif)}` : `Cerrado · diferencia ${soles(c.diferencia ?? 0)}`}
          </div>
        </div>
        {borrador && (
          <>
            <Popconfirm title="¿Descartar el conteo?" description="No se ajusta nada." onConfirm={async () => {
              await apiTienda.delete(`/stock/counts/${id}`);
              onVolver();
            }}>
              <Button danger type="text">
                Descartar
              </Button>
            </Popconfirm>
            <Button loading={guardando} onClick={guardar}>
              Guardar avance
            </Button>
            <Popconfirm
              title="¿Cerrar el conteo?"
              description="Se ajusta el stock de lo contado. Lo que dejaste vacío no se toca."
              okText="Cerrar y ajustar"
              onConfirm={async () => {
                try {
                  await apiTienda.put(`/stock/counts/${id}`, { values: valores });
                  const { data } = await apiTienda.post(`/stock/counts/${id}/close`);
                  message.success(`Conteo cerrado. Diferencia: ${soles(data.data.diferencia)}`);
                  void cargar();
                } catch (e) {
                  message.error(errorDe(e));
                }
              }}
            >
              <Button type="primary">Cerrar conteo</Button>
            </Popconfirm>
          </>
        )}
      </div>
      <Input.Search className="mb-3 max-w-xs" allowClear placeholder="Buscar insumo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_140px_120px] gap-2 border-b border-line bg-canvas px-4 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
          <span>Insumo</span>
          <span className="text-right">Sistema</span>
          <span className="text-right">Contado</span>
          <span className="text-right">Diferencia</span>
        </div>
        {lineas.map((l) => {
          const v = borrador ? valores[l.ingredientId] : l.contado;
          const dif = v === null || v === undefined ? null : borrador ? v - l.esperado : l.diferencia;
          return (
            <div key={l.ingredientId} className="grid grid-cols-[1fr_120px_140px_120px] items-center gap-2 border-b border-line-soft px-4 py-2 last:border-0">
              <span>
                <span className="font-medium">{l.nombre}</span>
                {l.categoria && <span className="block text-[11.5px] text-muted">{l.categoria}</span>}
              </span>
              <span className="text-right font-mono text-[13px]">
                {num(l.esperado)} {l.unidad}
              </span>
              <span className="text-right">
                {borrador ? (
                  <InputNumber
                    min={0}
                    className="!w-full"
                    placeholder="—"
                    value={valores[l.ingredientId] ?? null}
                    onChange={(n) => setValores({ ...valores, [l.ingredientId]: n === null ? null : Number(n) })}
                  />
                ) : (
                  <span className="font-mono text-[13px]">{v === null ? "—" : `${num(Number(v))} ${l.unidad}`}</span>
                )}
              </span>
              <span className={`text-right font-mono text-[13px] ${dif === null ? "text-muted" : dif < 0 ? "text-danger" : dif > 0 ? "text-ok" : ""}`}>
                {dif === null ? "—" : `${dif > 0 ? "+" : ""}${num(dif)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
