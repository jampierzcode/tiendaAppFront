import { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Empty, Input, Modal, Popconfirm, Select, Spin, Switch, Tag, message } from "antd";
import { TbCopy, TbEdit, TbPhoto, TbPlus, TbTrash, TbX } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import GalleryModal from "./GalleryModal";

type Tipo = "billetera" | "transferencia" | "efectivo" | "tarjeta" | "otro";

interface Imagen {
  imageId: number;
  url: string;
  cuando: "al_confirmar" | "si_lo_pide";
}

export interface MetodoPago {
  id: string;
  nombre: string;
  tipo: Tipo;
  numero: string;
  cci: string;
  titular: string;
  instrucciones: string;
  activo: boolean;
  imagenes: Imagen[];
}

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "billetera", label: "Billetera digital" },
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

const ATAJOS: { nombre: string; tipo: Tipo; instrucciones: string }[] = [
  { nombre: "Yape", tipo: "billetera", instrucciones: "Yapea al número y envía la captura del pago." },
  { nombre: "Plin", tipo: "billetera", instrucciones: "Envía por Plin al número y manda la captura." },
  { nombre: "BCP", tipo: "transferencia", instrucciones: "Transfiere a la cuenta y envía la constancia." },
  { nombre: "BBVA", tipo: "transferencia", instrucciones: "Transfiere a la cuenta y envía la constancia." },
  { nombre: "Interbank", tipo: "transferencia", instrucciones: "Transfiere a la cuenta y envía la constancia." },
  { nombre: "Scotiabank", tipo: "transferencia", instrucciones: "Transfiere a la cuenta y envía la constancia." },
  { nombre: "Efectivo", tipo: "efectivo", instrucciones: "Pagas en efectivo al recibir o al recoger." },
  { nombre: "Tarjeta", tipo: "tarjeta", instrucciones: "Pago con tarjeta al recoger en tienda (POS)." },
];

const MAX_IMAGENES = 5;
const nuevoId = () => Math.random().toString(36).slice(2, 10);

/**
 * Métodos de pago de la tienda (como en yavendió!): Yape, Plin, bancos,
 * efectivo… con número, titular, indicaciones y QR. El vendedor IA solo
 * ofrece los activos y manda los QR al confirmar el pedido.
 */
export default function PaymentMethodsTab() {
  const [metodos, setMetodos] = useState<MetodoPago[] | null>(null);
  const [original, setOriginal] = useState("");
  const [editando, setEditando] = useState<MetodoPago | null>(null);
  const [galeria, setGaleria] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    apiTienda
      .get("/payment-methods")
      .then((r) => {
        setMetodos(r.data.data ?? []);
        setOriginal(JSON.stringify(r.data.data ?? []));
      })
      .catch(() => message.error("No se pudieron cargar los métodos de pago"));
  }, []);

  const totalImagenes = useMemo(
    () => (metodos ?? []).reduce((t, m) => t + (m.id === editando?.id ? 0 : m.imagenes.length), 0) +
      (editando?.imagenes.length ?? 0),
    [metodos, editando]
  );

  if (!metodos) return <Spin />;
  const cambios = JSON.stringify(metodos) !== original;

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await apiTienda.put("/payment-methods", { methods: metodos });
      setMetodos(r.data.data);
      setOriginal(JSON.stringify(r.data.data));
      message.success("Métodos de pago guardados");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const listo = () => {
    if (!editando) return;
    if (!editando.nombre.trim()) {
      message.warning("Ponle un nombre al método");
      return;
    }
    const existe = metodos.some((m) => m.id === editando.id);
    setMetodos(existe ? metodos.map((m) => (m.id === editando.id ? editando : m)) : [...metodos, editando]);
    setEditando(null);
  };

  const nuevo = (atajo?: (typeof ATAJOS)[number]) =>
    setEditando({
      id: nuevoId(),
      nombre: atajo?.nombre ?? "",
      tipo: atajo?.tipo ?? "billetera",
      numero: "",
      cci: "",
      titular: "",
      instrucciones: atajo?.instrucciones ?? "",
      activo: true,
      imagenes: [],
    });

  const esBanco = editando?.tipo === "transferencia";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-muted">
          Cómo te pagan tus clientes. El vendedor IA solo ofrece los <b>activos</b>, con su número y titular, y
          manda el QR cuando se confirma el pedido. Nunca da otro número para pagar.
        </p>
        <div className="flex gap-2">
          <Dropdown
            menu={{
              items: [
                ...ATAJOS.map((a) => ({ key: a.nombre, label: a.nombre })),
                { type: "divider" as const },
                { key: "__otro", label: "Otro método" },
              ],
              onClick: ({ key }) => nuevo(ATAJOS.find((a) => a.nombre === key)),
            }}
          >
            <Button icon={<TbPlus />}>Agregar método</Button>
          </Dropdown>
          <Button type="primary" disabled={!cambios} loading={guardando} onClick={guardar}>
            Guardar métodos
          </Button>
        </div>
      </div>

      {metodos.length === 0 ? (
        <Empty description="Aún no agregaste métodos de pago" />
      ) : (
        <div className="space-y-2">
          {metodos.map((m) => (
            <div
              key={m.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 ${m.activo ? "" : "opacity-60"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{m.nombre}</span>
                  <Tag>{TIPOS.find((t) => t.value === m.tipo)?.label}</Tag>
                  {m.imagenes.length > 0 && <Tag icon={<TbPhoto className="mr-1 inline" />}>{m.imagenes.length} QR</Tag>}
                </div>
                <p className="text-[12px] text-ink-soft">
                  {[m.numero, m.cci && `CCI ${m.cci}`, m.titular].filter(Boolean).join(" · ") || m.instrucciones}
                </p>
              </div>
              <Switch
                size="small"
                checked={m.activo}
                checkedChildren="Activo"
                unCheckedChildren="Pausado"
                onChange={(v) => setMetodos(metodos.map((x) => (x.id === m.id ? { ...x, activo: v } : x)))}
              />
              <Button type="text" icon={<TbEdit />} onClick={() => setEditando(structuredClone(m))} />
              <Button
                type="text"
                icon={<TbCopy />}
                onClick={() => setMetodos([...metodos, { ...structuredClone(m), id: nuevoId(), nombre: `${m.nombre} (copia)`, imagenes: [] }])}
              />
              <Popconfirm
                title="¿Quitar este método?"
                okText="Quitar"
                cancelText="No"
                onConfirm={() => setMetodos(metodos.filter((x) => x.id !== m.id))}
              >
                <Button type="text" icon={<TbTrash />} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editando)}
        title="Método de pago"
        okText="Listo"
        cancelText="Cancelar"
        onOk={listo}
        onCancel={() => setEditando(null)}
        destroyOnHidden
      >
        {editando && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[12px] font-semibold">Nombre</label>
                <Input
                  maxLength={60}
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  placeholder="Yape, BCP soles…"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold">Tipo</label>
                <Select
                  className="w-full"
                  options={TIPOS}
                  value={editando.tipo}
                  onChange={(v) => setEditando({ ...editando, tipo: v })}
                />
              </div>
              {editando.tipo !== "efectivo" && (
                <div>
                  <label className="text-[12px] font-semibold">{esBanco ? "N.° de cuenta" : "Número"}</label>
                  <Input
                    maxLength={60}
                    value={editando.numero}
                    onChange={(e) => setEditando({ ...editando, numero: e.target.value })}
                    placeholder={esBanco ? "191-1234567-0-12" : "987 654 321"}
                  />
                </div>
              )}
              {esBanco && (
                <div>
                  <label className="text-[12px] font-semibold">CCI (opcional)</label>
                  <Input
                    maxLength={40}
                    value={editando.cci}
                    onChange={(e) => setEditando({ ...editando, cci: e.target.value })}
                  />
                </div>
              )}
              {editando.tipo !== "efectivo" && (
                <div className={esBanco ? "sm:col-span-2" : ""}>
                  <label className="text-[12px] font-semibold">Titular</label>
                  <Input
                    maxLength={120}
                    value={editando.titular}
                    onChange={(e) => setEditando({ ...editando, titular: e.target.value })}
                    placeholder="Mi Negocio SAC"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="text-[12px] font-semibold">Instrucciones para el cliente</label>
              <Input.TextArea
                rows={3}
                maxLength={800}
                showCount
                value={editando.instrucciones}
                onChange={(e) => setEditando({ ...editando, instrucciones: e.target.value })}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[12px] font-semibold">QR o imagen</label>
                <span className="text-[11px] text-muted">
                  {totalImagenes}/{MAX_IMAGENES} en total
                </span>
              </div>
              <div className="space-y-2">
                {editando.imagenes.map((img) => (
                  <div key={img.imageId} className="flex items-center gap-3">
                    <img src={img.url} alt="" className="h-14 w-14 rounded border border-line object-cover" />
                    <Select
                      className="flex-1"
                      value={img.cuando}
                      onChange={(v) =>
                        setEditando({
                          ...editando,
                          imagenes: editando.imagenes.map((x) => (x.imageId === img.imageId ? { ...x, cuando: v } : x)),
                        })
                      }
                      options={[
                        { value: "al_confirmar", label: "Enviar al confirmar el pedido" },
                        { value: "si_lo_pide", label: "Enviar solo si el cliente lo pide" },
                      ]}
                    />
                    <Button
                      type="text"
                      icon={<TbX />}
                      onClick={() =>
                        setEditando({ ...editando, imagenes: editando.imagenes.filter((x) => x.imageId !== img.imageId) })
                      }
                    />
                  </div>
                ))}
                {totalImagenes < MAX_IMAGENES && (
                  <Button size="small" icon={<TbPhoto />} onClick={() => setGaleria(true)}>
                    Adjuntar QR o imagen
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                size="small"
                checked={editando.activo}
                onChange={(v) => setEditando({ ...editando, activo: v })}
              />
              <span className="text-[13px] text-ink-soft">
                {editando.activo ? "Activo: el vendedor lo ofrece" : "Pausado: el vendedor no lo menciona"}
              </span>
            </div>
          </div>
        )}
      </Modal>

      <GalleryModal
        open={galeria}
        onClose={() => setGaleria(false)}
        onSelect={(img) => {
          if (!editando || editando.imagenes.some((x) => x.imageId === img.id)) return;
          setEditando({
            ...editando,
            imagenes: [...editando.imagenes, { imageId: img.id, url: img.url, cuando: "al_confirmar" }],
          });
        }}
      />
    </div>
  );
}
