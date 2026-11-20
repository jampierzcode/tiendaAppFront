import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Input, InputNumber, Modal, Popconfirm, Select, Spin, Tabs, Tag, message } from "antd";
import { TbCopy, TbPlus, TbTrash } from "react-icons/tb";
import PageHeader from "../components/ui/PageHeader";
import { crearApiSalon, mensajeError } from "./api";

interface Config {
  printers: { id: number; name: string; paperWidth: number }[];
  areas: { id: number; name: string; printerId: number | null }[];
  tables: { id: number; name: string; zone: string | null; isActive: boolean }[];
  staff: { id: number; name: string; role: "mesero" | "cajero"; isActive: boolean }[];
  categories: { id: number; name: string; productionAreaId: number | null }[];
  products: { id: number; name: string; productionAreaId: number | null; categoryIds: number[] }[];
}

/**
 * Configuración del salón: mesas, áreas de producción (y a qué impresora
 * va cada una), qué plato sale a qué área y el personal con su PIN.
 */
export default function SalonConfig() {
  const { uuid_business = "" } = useParams();
  const api = useMemo(() => crearApiSalon(uuid_business, "dueno"), [uuid_business]);
  const [c, setC] = useState<Config | null>(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/config");
      setC(data.data);
    } catch (e) {
      message.error(mensajeError(e));
    }
  }, [api]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hacer = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) message.success(ok);
      await cargar();
      return true;
    } catch (e) {
      message.error(mensajeError(e));
      return false;
    }
  };

  if (!c) return <Spin />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titulo="Configurar salón"
        descripcion="Mesas, áreas de producción, a dónde sale cada plato y el personal que comanda desde su celular."
      />
      <Tabs
        items={[
          { key: "mesas", label: "Mesas", children: <TabMesas c={c} api={api} hacer={hacer} /> },
          { key: "areas", label: "Áreas e impresoras", children: <TabAreas c={c} api={api} hacer={hacer} /> },
          { key: "platos", label: "Platos por área", children: <TabPlatos c={c} api={api} hacer={hacer} /> },
          { key: "personal", label: "Personal", children: <TabPersonal c={c} api={api} hacer={hacer} uuid={uuid_business} /> },
        ]}
      />
    </div>
  );
}

type TabProps = {
  c: Config;
  api: ReturnType<typeof crearApiSalon>;
  hacer: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
};

function TabMesas({ c, api, hacer }: TabProps) {
  const [cantidad, setCantidad] = useState<number | null>(10);
  const [zona, setZona] = useState("");
  const [nombre, setNombre] = useState("");
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 font-semibold">Crear varias mesas</div>
        <div className="flex flex-wrap gap-2">
          <InputNumber min={1} max={100} value={cantidad} onChange={setCantidad} addonAfter="mesas" />
          <Input className="max-w-[180px]" placeholder="Zona (opcional): Terraza" value={zona} onChange={(e) => setZona(e.target.value)} />
          <Button
            type="primary"
            icon={<TbPlus />}
            onClick={() => hacer(() => api.post("/tables/bulk", { count: cantidad, zone: zona }), "Mesas creadas")}
          >
            Crear
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="max-w-[180px]" placeholder="O una: Barra 1" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Button
            onClick={() =>
              hacer(() => api.post("/tables", { name: nombre, zone: zona || null }), "Mesa creada").then((ok) => ok && setNombre(""))
            }
          >
            Agregar una
          </Button>
        </div>
      </div>
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {c.tables.map((t) => (
            <Tag key={t.id} className="!px-3 !py-1 text-[14px]">
              {t.name}
              {t.zone ? <span className="text-muted"> · {t.zone}</span> : null}
              <Popconfirm title="¿Borrar la mesa?" onConfirm={() => hacer(() => api.delete(`/tables/${t.id}`))}>
                <TbTrash className="ml-2 inline cursor-pointer text-danger" />
              </Popconfirm>
            </Tag>
          ))}
          {!c.tables.length && <span className="text-muted">Aún no hay mesas.</span>}
        </div>
      </div>
    </div>
  );
}

function TabAreas({ c, api, hacer }: TabProps) {
  const [nombre, setNombre] = useState("");
  const [impresora, setImpresora] = useState("");
  const opciones = [{ value: 0, label: "Sin impresora (caja)" }, ...c.printers.map((p) => ({ value: p.id, label: p.name }))];
  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] text-ink-soft">
        Un <b>área</b> es a dónde va un plato: Cocina, Parrilla, Barra… Cada área puede tener su impresora. Varias áreas
        pueden usar la misma impresora (sale un ticket por área). Lo que no tiene área sale por la impresora de caja.
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Impresoras</div>
        {c.printers.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className="flex-1">{p.name}</span>
            <Select
              value={p.paperWidth}
              options={[
                { value: 58, label: "58 mm" },
                { value: 80, label: "80 mm" },
              ]}
              onChange={(v) => hacer(() => api.put(`/printers/${p.id}`, { paperWidth: v }))}
            />
            <Popconfirm title="¿Borrar la impresora?" onConfirm={() => hacer(() => api.delete(`/printers/${p.id}`))}>
              <Button icon={<TbTrash />} danger type="text" />
            </Popconfirm>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Input placeholder="Nombre: Térmica cocina" value={impresora} onChange={(e) => setImpresora(e.target.value)} />
          <Button icon={<TbPlus />} onClick={() => hacer(() => api.post("/printers", { name: impresora }), "Impresora agregada").then((ok) => ok && setImpresora(""))}>
            Agregar
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted">El emparejamiento Bluetooth se hace en «Central de impresión», en el celular Android del local.</p>
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Áreas de producción</div>
        {c.areas.map((a) => (
          <div key={a.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className="flex-1 font-medium">{a.name}</span>
            <span className="text-[12px] text-muted">imprime en</span>
            <Select
              className="w-48"
              value={a.printerId ?? 0}
              options={opciones}
              onChange={(v) => hacer(() => api.put(`/areas/${a.id}`, { printerId: v || null }))}
            />
            <Popconfirm title="¿Borrar el área?" onConfirm={() => hacer(() => api.delete(`/areas/${a.id}`))}>
              <Button icon={<TbTrash />} danger type="text" />
            </Popconfirm>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Input placeholder="Nombre: Cocina, Barra…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Button icon={<TbPlus />} onClick={() => hacer(() => api.post("/areas", { name: nombre }), "Área creada").then((ok) => ok && setNombre(""))}>
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}

function TabPlatos({ c, api, hacer }: TabProps) {
  const opciones = [{ value: 0, label: "—" }, ...c.areas.map((a) => ({ value: a.id, label: a.name }))];
  const areaCat = new Map(c.categories.map((x) => [x.id, x.productionAreaId]));
  const nombreArea = (id: number | null | undefined) => c.areas.find((a) => a.id === id)?.name;

  if (!c.areas.length) return <div className="card p-6 text-muted">Primero crea las áreas en «Áreas e impresoras».</div>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-1 font-semibold">Por categoría</div>
        <p className="mb-3 text-[12.5px] text-muted">Los platos de la categoría salen a esta área, salvo que el plato tenga una propia.</p>
        {c.categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className="flex-1">{cat.name}</span>
            <Select
              className="w-44"
              value={cat.productionAreaId ?? 0}
              options={opciones}
              onChange={(v) => hacer(() => api.put("/area-assignments", { categories: { [cat.id]: v || null } }))}
            />
          </div>
        ))}
      </div>
      <div className="card p-4">
        <div className="mb-1 font-semibold">Por plato</div>
        <p className="mb-3 text-[12.5px] text-muted">Úsalo cuando un plato va a otra área que el resto de su categoría.</p>
        {c.products.map((p) => {
          const heredada = p.categoryIds.map((id) => areaCat.get(id)).find(Boolean) ?? null;
          return (
            <div key={p.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
              <span className="flex-1">
                {p.name}
                {!p.productionAreaId && (
                  <span className="block text-[11.5px] text-muted">
                    {heredada ? `Sale a ${nombreArea(heredada)} (por categoría)` : "Sin área: sale por caja"}
                  </span>
                )}
              </span>
              <Select
                className="w-44"
                value={p.productionAreaId ?? 0}
                options={[{ value: 0, label: "Según categoría" }, ...opciones.slice(1)]}
                onChange={(v) => hacer(() => api.put("/area-assignments", { products: { [p.id]: v || null } }))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabPersonal({ c, api, hacer, uuid }: TabProps & { uuid: string }) {
  const [form, setForm] = useState<{ id?: number; name: string; pin: string; role: "mesero" | "cajero" } | null>(null);
  const link = `${window.location.origin}/pdv/${uuid}`;
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-1 font-semibold">Link del comandero</div>
        <p className="mb-2 text-[12.5px] text-muted">
          Mándalo a tus meseras por WhatsApp. Lo abren en su celular, tocan su nombre y ponen su PIN. Funciona con sus datos
          móviles, sin Wi‑Fi.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={link} />
          <Button
            icon={<TbCopy />}
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              message.success("Link copiado");
            }}
          >
            Copiar
          </Button>
        </div>
      </div>
      <div className="card p-4">
        <div className="mb-2 flex items-center">
          <span className="flex-1 font-semibold">Personal</span>
          <Button type="primary" icon={<TbPlus />} onClick={() => setForm({ name: "", pin: "", role: "mesero" })}>
            Agregar
          </Button>
        </div>
        {c.staff.map((s) => (
          <div key={s.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className={`flex-1 ${s.isActive ? "" : "text-muted line-through"}`}>{s.name}</span>
            <Tag color={s.role === "cajero" ? "purple" : "blue"}>{s.role === "cajero" ? "Caja (cobra y anula)" : "Mesera (solo comanda)"}</Tag>
            <Button size="small" onClick={() => setForm({ id: s.id, name: s.name, pin: "", role: s.role })}>
              Editar
            </Button>
            <Button size="small" onClick={() => hacer(() => api.put(`/staff/${s.id}`, { isActive: !s.isActive }))}>
              {s.isActive ? "Desactivar" : "Activar"}
            </Button>
            <Popconfirm title="¿Borrar a esta persona?" onConfirm={() => hacer(() => api.delete(`/staff/${s.id}`))}>
              <Button size="small" danger icon={<TbTrash />} />
            </Popconfirm>
          </div>
        ))}
        {!c.staff.length && <div className="text-muted">Aún no hay personal.</div>}
      </div>

      <Modal
        open={Boolean(form)}
        title={form?.id ? "Editar persona" : "Nueva persona"}
        onCancel={() => setForm(null)}
        okText="Guardar"
        onOk={() =>
          form &&
          hacer(
            () =>
              form.id
                ? api.put(`/staff/${form.id}`, { name: form.name, role: form.role, ...(form.pin ? { pin: form.pin } : {}) })
                : api.post("/staff", form),
            "Guardado"
          ).then((ok) => ok && setForm(null))
        }
      >
        {form && (
          <div className="space-y-3">
            <Input placeholder="Nombre (Ana, Luis…)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder={form.id ? "Nuevo PIN (déjalo vacío para no cambiarlo)" : "PIN de 4 a 6 números"}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
            />
            <Select
              className="w-full"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={[
                { value: "mesero", label: "Mesera / mozo: abre mesas, comanda y pide precuenta" },
                { value: "cajero", label: "Caja: además cobra, anula y cancela cuentas" },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
