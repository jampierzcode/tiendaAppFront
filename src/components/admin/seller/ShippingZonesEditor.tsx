import { useState } from "react";
import { Button, Dropdown, Empty, Input, Popconfirm, Select, Switch, Tag, Tooltip } from "antd";
import {
  TbCalendarTime,
  TbCash,
  TbChevronDown,
  TbChevronUp,
  TbCopy,
  TbCreditCard,
  TbEdit,
  TbListCheck,
  TbPlus,
  TbTrash,
} from "react-icons/tb";
import DeliveryTypeModal from "./DeliveryTypeModal";
import { GRUPOS_OTROS, GRUPOS_PRINCIPALES, type GrupoRegiones } from "./regionesPeru";
import {
  nuevoId,
  plantillaTipo,
  resumenCosto,
  resumenEntrega,
  resumenMinimo,
  resumenPago,
  type TipoEntrega,
  type ZonaEnvio,
} from "./tipos";

interface Props {
  zonas: ZonaEnvio[];
  onChange: (z: ZonaEnvio[]) => void;
  simbolo: string;
  datosSugeridos: string[];
  mostrarPeru: boolean;
  /** Restaurante: zonas de reparto en la ciudad, sin agencias ni provincias. */
  restaurante?: boolean;
}

/** Zonas de envío con sus regiones y tipos de entrega (Envíos y plazos). */
export default function ShippingZonesEditor({
  zonas,
  onChange,
  simbolo,
  datosSugeridos,
  mostrarPeru,
  restaurante = false,
}: Props) {
  const grupos = restaurante
    ? GRUPOS_PRINCIPALES.filter((g) => g.clave === "lima" || g.clave === "callao")
    : GRUPOS_PRINCIPALES;
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [editando, setEditando] = useState<{ zonaId: string; tipo: TipoEntrega } | null>(null);

  const cambiarZona = (id: string, cambio: Partial<ZonaEnvio>) =>
    onChange(zonas.map((z) => (z.id === id ? { ...z, ...cambio } : z)));

  const agregarZona = () => {
    const z: ZonaEnvio = { id: nuevoId(), nombre: "", activa: true, regiones: [], tipos: [] };
    onChange([...zonas, z]);
    setAbiertas((a) => ({ ...a, [z.id]: true }));
  };

  const duplicarZona = (z: ZonaEnvio) => {
    const copia: ZonaEnvio = {
      ...structuredClone(z),
      id: nuevoId(),
      nombre: `${z.nombre || "Zona"} (copia)`,
      tipos: z.tipos.map((t) => ({ ...structuredClone(t), id: nuevoId() })),
    };
    onChange([...zonas, copia]);
    setAbiertas((a) => ({ ...a, [copia.id]: true }));
  };

  const alternarGrupo = (z: ZonaEnvio, g: GrupoRegiones) => {
    const todas = g.regiones.every((r) => z.regiones.includes(r));
    cambiarZona(z.id, {
      regiones: todas
        ? z.regiones.filter((r) => !g.regiones.includes(r))
        : [...z.regiones, ...g.regiones.filter((r) => !z.regiones.includes(r))],
    });
  };

  const guardarTipo = (zonaId: string, t: TipoEntrega) => {
    const z = zonas.find((x) => x.id === zonaId);
    if (!z) return;
    const existe = z.tipos.some((x) => x.id === t.id);
    cambiarZona(zonaId, { tipos: existe ? z.tipos.map((x) => (x.id === t.id ? t : x)) : [...z.tipos, t] });
    setEditando(null);
  };

  return (
    <div className="space-y-4">
      {zonas.length === 0 && (
        <div className="card p-6">
          <Empty
            description={
              <span className="text-[13px] text-muted">
                {restaurante ? (
                  <>
                    Sin zonas, el vendedor usa el envío general de <b>Mi tienda</b>. Crea zonas de reparto (por
                    distritos) con su costo, pedido mínimo y tiempo; el recojo en el local y la mesa funcionan siempre.
                  </>
                ) : (
                  <>
                    Sin zonas, el vendedor usa el envío general de <b>Mi tienda</b>. Crea zonas para ofrecer
                    motorizado en Lima, agencia a provincias, recojo en tienda…
                  </>
                )}
              </span>
            }
          />
        </div>
      )}

      {zonas.map((z) => {
        const abierta = abiertas[z.id] ?? !z.nombre;
        return (
          <section key={z.id} className={`card p-5 ${z.activa ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                {abierta ? (
                  <Input
                    variant="borderless"
                    className="!px-0 text-[16px] font-bold"
                    placeholder={restaurante ? "Ponle un nombre: Zona cercana, Zona 2…" : "Ponle un nombre: Lima, Provincias…"}
                    value={z.nombre}
                    maxLength={80}
                    onChange={(e) => cambiarZona(z.id, { nombre: e.target.value })}
                  />
                ) : (
                  <p className="text-[16px] font-bold text-ink">{z.nombre || "Sin nombre"}</p>
                )}
                {!abierta && (
                  <p className="text-[12px] text-muted">
                    {z.regiones.length} regiones · {z.tipos.length} tipos de entrega
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip title="Duplicar">
                  <Button type="text" icon={<TbCopy />} onClick={() => duplicarZona(z)} />
                </Tooltip>
                <Tag color={z.activa ? "green" : "default"}>{z.activa ? "Activo" : "Pausado"}</Tag>
                <Button
                  type="text"
                  icon={abierta ? <TbChevronUp /> : <TbChevronDown />}
                  onClick={() => setAbiertas((a) => ({ ...a, [z.id]: !abierta }))}
                />
              </div>
            </div>

            {abierta && (
              <div className="mt-4 space-y-5">
                <div>
                  <p className="text-[13px] font-bold text-ink">Regiones cubiertas</p>
                  <p className="mb-2 text-[12px] text-muted">
                    Distritos, provincias o ciudades donde entregas. Escribe y presiona Enter para agregar.
                  </p>
                  <Select
                    mode="tags"
                    className="w-full"
                    value={z.regiones}
                    onChange={(v) => cambiarZona(z.id, { regiones: v })}
                    placeholder="Ej.: Miraflores"
                    open={false}
                    suffixIcon={null}
                    tokenSeparators={[","]}
                  />
                  {mostrarPeru && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {grupos.map((g) => {
                        const todas = g.regiones.every((r) => z.regiones.includes(r));
                        return (
                          <Button
                            key={g.clave}
                            size="small"
                            type={todas ? "primary" : "default"}
                            ghost={todas}
                            icon={todas ? undefined : <TbPlus />}
                            onClick={() => alternarGrupo(z, g)}
                          >
                            {todas ? "✓ " : ""}
                            {g.nombre} ({g.regiones.length})
                          </Button>
                        );
                      })}
                      <Dropdown
                        menu={{
                          items: GRUPOS_OTROS.map((g) => ({
                            key: g.clave,
                            label: `${g.regiones.every((r) => z.regiones.includes(r)) ? "✓ " : ""}${g.nombre} (${g.regiones.length})`,
                          })),
                          onClick: ({ key }) => {
                            const g = GRUPOS_OTROS.find((x) => x.clave === key);
                            if (g) alternarGrupo(z, g);
                          },
                        }}
                      >
                        <Button size="small" icon={<TbPlus />}>
                          Otros <TbChevronDown className="inline" />
                        </Button>
                      </Dropdown>
                      {z.regiones.length > 0 && (
                        <Button size="small" type="link" danger onClick={() => cambiarZona(z.id, { regiones: [] })}>
                          Quitar todas
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[13px] font-bold text-ink">Tipos de entrega</p>
                    <Dropdown
                      menu={{
                        items: restaurante
                          ? [
                              { key: "delivery_resto", label: "Delivery (costo, tiempo y pedido mínimo)" },
                              { key: "recojo_resto", label: "Recojo en el local" },
                              { key: "otro", label: "Personalizado / Otro" },
                            ]
                          : [
                              { key: "motorizado", label: "Motorizado (contraentrega, por horario)" },
                              { key: "shalom", label: "Agencia Shalom (adelanto parcial)" },
                              { key: "agencia", label: "Otra agencia (Olva, Marvisur…)" },
                              { key: "recojo", label: "Recojo en tienda" },
                              { key: "otro", label: "Personalizado / Otro" },
                            ],
                        onClick: ({ key }) =>
                          setEditando({ zonaId: z.id, tipo: plantillaTipo(key as Parameters<typeof plantillaTipo>[0]) }),
                      }}
                    >
                      <Button type="primary" icon={<TbPlus />}>
                        Agregar
                      </Button>
                    </Dropdown>
                  </div>
                  {z.tipos.length === 0 && (
                    <p className="text-[12px] text-muted">Aún no agregaste tipos de entrega.</p>
                  )}
                  <div className="space-y-2">
                    {z.tipos.map((t) => (
                      <div
                        key={t.id}
                        className={`rounded-xl border border-line p-3 ${t.activo ? "" : "opacity-60"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[14px] font-semibold text-ink">
                            <span className="mr-1.5 text-brand-600">•</span>
                            {t.nombre}
                            {t.soloRespaldo && (
                              <Tag className="ml-2" color="orange">
                                Respaldo
                              </Tag>
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            <Switch
                              size="small"
                              checked={t.activo}
                              onChange={(v) =>
                                cambiarZona(z.id, {
                                  tipos: z.tipos.map((x) => (x.id === t.id ? { ...x, activo: v } : x)),
                                })
                              }
                            />
                            <Button
                              type="text"
                              icon={<TbEdit />}
                              onClick={() => setEditando({ zonaId: z.id, tipo: structuredClone(t) })}
                            >
                              Editar
                            </Button>
                            <Tooltip title="Duplicar">
                              <Button
                                type="text"
                                icon={<TbCopy />}
                                onClick={() =>
                                  cambiarZona(z.id, {
                                    tipos: [...z.tipos, { ...structuredClone(t), id: nuevoId(), nombre: `${t.nombre} (copia)` }],
                                  })
                                }
                              />
                            </Tooltip>
                            <Popconfirm
                              title="¿Quitar este tipo de entrega?"
                              okText="Quitar"
                              cancelText="No"
                              onConfirm={() => cambiarZona(z.id, { tipos: z.tipos.filter((x) => x.id !== t.id) })}
                            >
                              <Button type="text" icon={<TbTrash />} />
                            </Popconfirm>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] text-ink-soft md:grid-cols-2">
                          <span className="flex items-center gap-1.5">
                            <TbCash /> Costo envío: {resumenCosto(t, simbolo)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <TbCalendarTime /> Entrega: {resumenEntrega(t)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <TbCreditCard /> Pago: {resumenPago(t, simbolo)}
                            {resumenMinimo(t, simbolo) && ` · ${resumenMinimo(t, simbolo)}`}
                          </span>
                          {t.datos.length > 0 && (
                            <span className="flex items-center gap-1.5">
                              <TbListCheck /> El vendedor pide: {t.datos.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-line pt-3">
                  <Button onClick={() => cambiarZona(z.id, { activa: !z.activa })}>
                    {z.activa ? "Pausar" : "Activar"}
                  </Button>
                  <Popconfirm
                    title="¿Eliminar esta zona y sus tipos de entrega?"
                    okText="Eliminar"
                    cancelText="No"
                    onConfirm={() => onChange(zonas.filter((x) => x.id !== z.id))}
                  >
                    <Button danger icon={<TbTrash />}>
                      Eliminar
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <button
        type="button"
        onClick={agregarZona}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white py-4 text-[14px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-600"
      >
        <TbPlus /> Agregar zona de envío
      </button>

      <DeliveryTypeModal
        abierto={editando?.tipo ?? null}
        simbolo={simbolo}
        datosSugeridos={datosSugeridos}
        restaurante={restaurante}
        onCancel={() => setEditando(null)}
        onSave={(t) => editando && guardarTipo(editando.zonaId, t)}
      />
    </div>
  );
}
