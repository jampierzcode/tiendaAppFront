import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Tabs,
  message,
} from "antd";
import { TbPlus, TbTrash } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Opcion {
  id?: number;
  name: string;
  priceDelta: number;
  isActive: boolean;
  ingredientId?: number | null;
  ingredientQty?: number;
}

interface InsumoOpt {
  id: number;
  name: string;
  unit: string;
}

interface Grupo {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  productsCount: number;
  options: Opcion[];
}

interface Producto {
  id: number;
  name: string;
}

interface Asignacion {
  modifierGroupId: number;
  minSelect: number;
  maxSelect: number;
}

const soles = (v: number) => `${v >= 0 ? "+" : "−"} S/ ${Math.abs(v).toFixed(2)}`;

/**
 * Modificadores del restaurante.
 *
 * Dos pestañas porque son dos decisiones distintas: primero se definen los
 * grupos reutilizables ("Punto de la carne", "Extras"), después se decide en
 * qué platos aparece cada uno y con qué reglas (obligatorio, hasta cuántos).
 */
export default function ModifiersPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  const [editando, setEditando] = useState<Grupo | "nuevo" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();

  const [insumos, setInsumos] = useState<InsumoOpt[]>([]);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<number, Asignacion>>({});
  const [guardandoAsig, setGuardandoAsig] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [g, p, ing] = await Promise.all([
        apiTienda.get("/modifier-groups"),
        apiTienda.get("/products", { params: { perPage: 500 } }),
        apiTienda.get("/ingredients"),
      ]);
      setInsumos((ing.data.data ?? []).filter((i: any) => i.isActive));
      setGrupos(g.data.data ?? []);
      setProductos(p.data.data ?? p.data.data?.data ?? []);
    } catch {
      message.error("No se pudieron cargar los modificadores");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (g: Grupo | "nuevo") => {
    setEditando(g);
    form.setFieldsValue(
      g === "nuevo"
        ? { name: "", description: "", isActive: true, options: [{ name: "", priceDelta: 0, isActive: true }] }
        : { ...g }
    );
  };

  const guardar = async (v: any) => {
    setGuardando(true);
    try {
      const cuerpo = {
        name: v.name,
        description: v.description || null,
        isActive: v.isActive,
        options: (v.options ?? []).filter((o: Opcion) => o?.name?.trim()),
      };
      if (editando === "nuevo") await apiTienda.post("/modifier-groups", cuerpo);
      else if (editando) await apiTienda.put(`/modifier-groups/${editando.id}`, cuerpo);
      message.success("Grupo guardado");
      setEditando(null);
      cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: number) => {
    try {
      await apiTienda.delete(`/modifier-groups/${id}`);
      message.success("Grupo eliminado");
      cargar();
    } catch {
      message.error("No se pudo eliminar");
    }
  };

  const elegirProducto = async (id: number) => {
    setProductoId(id);
    try {
      const r = await apiTienda.get(`/products/${id}/modifier-groups`);
      const mapa: Record<number, Asignacion> = {};
      for (const a of r.data.data as Asignacion[]) mapa[a.modifierGroupId] = a;
      setAsignaciones(mapa);
    } catch {
      message.error("No se pudieron cargar las asignaciones");
    }
  };

  const alternar = (g: Grupo, activo: boolean) =>
    setAsignaciones((a) => {
      const copia = { ...a };
      if (activo) copia[g.id] = { modifierGroupId: g.id, minSelect: 0, maxSelect: 1 };
      else delete copia[g.id];
      return copia;
    });

  const cambiar = (id: number, campo: "minSelect" | "maxSelect", valor: number) =>
    setAsignaciones((a) => {
      const actual = { ...a[id], [campo]: valor };
      if (actual.minSelect > actual.maxSelect) {
        if (campo === "minSelect") actual.maxSelect = actual.minSelect;
        else actual.minSelect = actual.maxSelect;
      }
      return { ...a, [id]: actual };
    });

  const guardarAsignaciones = async () => {
    if (!productoId) return;
    setGuardandoAsig(true);
    try {
      await apiTienda.put(`/products/${productoId}/modifier-groups`, {
        groups: Object.values(asignaciones),
      });
      message.success("Plato actualizado");
      cargar();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setGuardandoAsig(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Modificadores"
        descripcion="Las elecciones que hace el cliente sobre un plato: punto de la carne, cremas, extras. Cambian el precio pero no el inventario."
        acciones={
          <Button type="primary" icon={<TbPlus />} onClick={() => abrir("nuevo")}>
            Nuevo grupo
          </Button>
        }
      />

      <Tabs
        items={[
          {
            key: "grupos",
            label: `Grupos (${grupos.length})`,
            children:
              grupos.length === 0 ? (
                <div className="card p-10">
                  <Empty description="Aún no hay grupos. Crea uno, por ejemplo «Tipo de carne»." />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {grupos.map((g) => (
                    <div key={g.id} className="card p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-ink">{g.name}</h3>
                          <p className="text-[12px] text-muted">
                            En {g.productsCount} plato{g.productsCount === 1 ? "" : "s"}
                            {!g.isActive && " · desactivado"}
                          </p>
                        </div>
                        <Button size="small" onClick={() => abrir(g)}>
                          Editar
                        </Button>
                      </div>
                      <ul className="mt-3 space-y-1">
                        {g.options.map((o) => (
                          <li
                            key={o.id}
                            className={`flex justify-between text-[13px] ${
                              o.isActive ? "text-ink-soft" : "text-muted line-through"
                            }`}
                          >
                            <span>{o.name}</span>
                            {Number(o.priceDelta) !== 0 && (
                              <span className="tabular">{soles(Number(o.priceDelta))}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ),
          },
          {
            key: "platos",
            label: "Asignar a platos",
            children: (
              <div className="card p-5">
                <label className="eyebrow mb-2 block">Plato</label>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Elige un plato"
                  className="w-full max-w-md"
                  value={productoId ?? undefined}
                  onChange={elegirProducto}
                  options={productos.map((p) => ({ value: p.id, label: p.name }))}
                />

                {productoId && (
                  <div className="mt-5 space-y-3">
                    {grupos.length === 0 && <Empty description="Crea grupos primero" />}
                    {grupos.map((g) => {
                      const a = asignaciones[g.id];
                      return (
                        <div key={g.id} className="rounded-xl border border-line p-4">
                          <Checkbox checked={Boolean(a)} onChange={(e) => alternar(g, e.target.checked)}>
                            <span className="font-semibold">{g.name}</span>
                            <span className="ml-2 text-[12px] text-muted">
                              {g.options.length} opciones
                            </span>
                          </Checkbox>

                          {a && (
                            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 pl-6">
                              <label className="flex items-center gap-2 text-[13px]">
                                Mínimo
                                <InputNumber
                                  min={0}
                                  max={g.options.length}
                                  value={a.minSelect}
                                  onChange={(v) => cambiar(g.id, "minSelect", Number(v ?? 0))}
                                />
                              </label>
                              <label className="flex items-center gap-2 text-[13px]">
                                Máximo
                                <InputNumber
                                  min={1}
                                  max={Math.max(1, g.options.length)}
                                  value={a.maxSelect}
                                  onChange={(v) => cambiar(g.id, "maxSelect", Number(v ?? 1))}
                                />
                              </label>
                              <span className="text-[12px] text-muted">
                                {a.minSelect > 0 ? "Obligatorio" : "Opcional"}
                                {a.maxSelect === 1 ? " · elige uno" : ` · hasta ${a.maxSelect}`}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <Button type="primary" loading={guardandoAsig} onClick={guardarAsignaciones}>
                      Guardar plato
                    </Button>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={editando !== null}
        title={editando === "nuevo" ? "Nuevo grupo" : "Editar grupo"}
        onCancel={() => setEditando(null)}
        onOk={() => form.submit()}
        okText="Guardar"
        confirmLoading={guardando}
        destroyOnHidden
        width={760}
      >
        <Form form={form} layout="vertical" onFinish={guardar}>
          <Form.Item name="name" label="Nombre del grupo" rules={[{ required: true, message: "Pon un nombre" }]}>
            <Input placeholder="Punto de la carne" />
          </Form.Item>
          <Form.Item name="description" label="Ayuda para el cliente (opcional)">
            <Input placeholder="Elige cómo la prefieres" />
          </Form.Item>
          <Form.Item name="isActive" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>

          <p className="eyebrow mb-2">Opciones</p>
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <div className="space-y-2">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Form.Item name={[f.name, "id"]} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item name={[f.name, "name"]} className="!mb-0 flex-1">
                      <Input placeholder="Nombre (Bien cocida)" />
                    </Form.Item>
                    <Form.Item name={[f.name, "priceDelta"]} className="!mb-0">
                      <InputNumber prefix="S/" step={0.5} className="!w-28" />
                    </Form.Item>
                    <Form.Item name={[f.name, "ingredientId"]} className="!mb-0">
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Consume…"
                        className="!w-36"
                        options={insumos.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
                      />
                    </Form.Item>
                    <Form.Item name={[f.name, "ingredientQty"]} className="!mb-0">
                      <InputNumber min={0} step={0.01} placeholder="Cant." className="!w-20" />
                    </Form.Item>
                    <Form.Item name={[f.name, "isActive"]} valuePropName="checked" className="!mb-0">
                      <Switch size="small" />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      aria-label="Quitar opción"
                      icon={<TbTrash />}
                      onClick={() => remove(f.name)}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<TbPlus />}
                  onClick={() => add({ name: "", priceDelta: 0, isActive: true })}
                >
                  Agregar opción
                </Button>
              </div>
            )}
          </Form.List>

          {editando && editando !== "nuevo" && (
            <Popconfirm
              title="¿Eliminar este grupo?"
              description="Se quita de todos los platos. Los pedidos anteriores no cambian."
              onConfirm={() => {
                eliminar(editando.id);
                setEditando(null);
              }}
            >
              <Button danger className="mt-5">
                Eliminar grupo
              </Button>
            </Popconfirm>
          )}
        </Form>
      </Modal>
    </>
  );
}
