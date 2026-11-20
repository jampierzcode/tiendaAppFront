import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import {
  TbAdjustments,
  TbArmchair,
  TbCash,
  TbCopy,
  TbDeviceMobile,
  TbEdit,
  TbFlame,
  TbPlus,
  TbPrinter,
  TbReceipt,
  TbRefresh,
  TbShieldLock,
  TbToolsKitchen2,
  TbTrash,
  TbUsers,
} from "react-icons/tb";
import dayjs from "dayjs";
import PageHeader from "../components/ui/PageHeader";
import { crearApiSalon, mensajeError } from "./api";
import { vistaPrevia, type TrabajoImpresion } from "./escpos";

type Rol = "mesero" | "cajero" | "gerente";
type Permisos = Record<string, boolean | number | string>;

interface DefPermiso {
  grupo: string;
  label: string;
  tipo: "si_no" | "tope" | "alcance";
  opciones?: Record<string, string>;
}

interface Seccion {
  tamano?: 1 | 2 | 3;
  negrita?: boolean;
}

interface EstiloTicket {
  copias: number;
  titulo: Seccion;
  detalle: Seccion;
  total: Seccion;
  campos: Record<string, boolean>;
}

type TipoTicket = "comanda" | "cuenta" | "nota_venta" | "cancelacion" | "corte";

interface Ajustes {
  permisos: Record<Rol, Permisos>;
  inactividadSegundos: number;
  liberarMesaManual: boolean;
  servicios: { comedor: boolean; para_llevar: boolean; delivery: boolean };
  ticket: {
    nombre?: string;
    ruc?: string;
    direccion?: string;
    telefono?: string;
    encabezado?: string;
    pie?: string;
    leyenda?: string;
    tipos: Record<TipoTicket, EstiloTicket>;
  };
}

interface Config {
  printers: { id: number; name: string; paperWidth: number }[];
  areas: { id: number; name: string; printerId: number | null }[];
  tables: { id: number; name: string; zone: string | null; diningAreaId: number | null; isActive: boolean }[];
  areasComedor: { id: number; name: string; sortOrder: number }[];
  staff: { id: number; name: string; role: Rol; isActive: boolean }[];
  categories: { id: number; name: string; productionAreaId: number | null }[];
  products: { id: number; name: string; productionAreaId: number | null; categoryIds: number[] }[];
  registers: { id: number; name: string; folioSeriesId: number | null }[];
  series: { id: number; code: string; name: string | null; nextNumber: number; isActive: boolean }[];
  devices: {
    id: number;
    name: string;
    mode: "pdv" | "monitor";
    areaIds: number[];
    cashRegisterId: number | null;
    lastSeenAt: string | null;
    createdAt: string;
  }[];
  pairingCode: string;
  ajustes: Ajustes;
  catalogoPermisos: Record<string, DefPermiso>;
  roles: Rol[];
}

const NOMBRE_ROL: Record<Rol, string> = { mesero: "Mesero", cajero: "Cajero", gerente: "Gerente" };

type Api = ReturnType<typeof crearApiSalon>;
type Hacer = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
type TabProps = { c: Config; api: Api; hacer: Hacer };

/**
 * Infraestructura del PDV: todo lo que el dueño configura una vez para que
 * el local opere. Cada pestaña es una pieza: dónde se sientan (mesas), a
 * dónde va cada plato (áreas e impresoras), dónde se cobra (cajas y folios),
 * quién opera y qué puede hacer (personal y permisos), desde qué equipos,
 * cómo salen los tickets y opciones generales.
 */
export default function Infraestructura() {
  const { uuid_business = "" } = useParams();
  const [params, setParams] = useSearchParams();
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

  const hacer: Hacer = async (fn, ok) => {
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
  const props = { c, api, hacer };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        titulo="Infraestructura"
        descripcion="Configura el local una vez: mesas, áreas de impresión, cajas y folios, personal y permisos, equipos y tickets."
      />
      <Tabs
        activeKey={params.get("tab") ?? "mesas"}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        items={[
          { key: "mesas", label: <span className="flex items-center gap-1.5"><TbArmchair />Comedor: áreas y mesas</span>, children: <TabMesas {...props} /> },
          { key: "areas", label: <span className="flex items-center gap-1.5"><TbFlame />Áreas de producción</span>, children: <TabAreas {...props} /> },
          { key: "platos", label: <span className="flex items-center gap-1.5"><TbToolsKitchen2 />Platos por área</span>, children: <TabPlatos {...props} /> },
          { key: "cajas", label: <span className="flex items-center gap-1.5"><TbCash />Cajas y folios</span>, children: <TabCajas {...props} /> },
          { key: "personal", label: <span className="flex items-center gap-1.5"><TbUsers />Personal</span>, children: <TabPersonal {...props} /> },
          { key: "permisos", label: <span className="flex items-center gap-1.5"><TbShieldLock />Permisos</span>, children: <TabPermisos {...props} /> },
          { key: "equipos", label: <span className="flex items-center gap-1.5"><TbDeviceMobile />Equipos</span>, children: <TabEquipos {...props} /> },
          { key: "tickets", label: <span className="flex items-center gap-1.5"><TbReceipt />Tickets</span>, children: <TabTickets {...props} /> },
          { key: "opciones", label: <span className="flex items-center gap-1.5"><TbAdjustments />Opciones</span>, children: <TabOpciones {...props} /> },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------- mesas

function TabMesas({ c, api, hacer }: TabProps) {
  const [nueva, setNueva] = useState("");
  const sinArea = c.tables.filter((t) => !t.diningAreaId);
  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] text-ink-soft">
        Las <b>áreas del comedor</b> son los espacios donde están las mesas: Primer piso, Segundo piso, Terraza, Patio… En el Punto de
        venta se filtra por ellas. (Las áreas de <i>producción</i>, como Cocina o Barra, son otra cosa: están en su pestaña).
      </div>
      {c.areasComedor.map((a) => (
        <AreaComedor key={a.id} area={a} mesas={c.tables.filter((t) => t.diningAreaId === a.id)} api={api} hacer={hacer} />
      ))}
      {sinArea.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Mesas sin área</div>
          <div className="flex flex-wrap gap-2">
            {sinArea.map((t) => (
              <Mesa key={t.id} t={t} c={c} api={api} hacer={hacer} />
            ))}
          </div>
        </div>
      )}
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <Input className="max-w-[260px]" placeholder="Nueva área: Primer piso, Terraza…" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <Button type="primary" icon={<TbPlus />} onClick={() => hacer(() => api.post("/dining-areas", { name: nueva }), "Área creada").then((ok) => ok && setNueva(""))}>
          Agregar área
        </Button>
      </div>
    </div>
  );
}

function AreaComedor({
  area,
  mesas,
  api,
  hacer,
}: {
  area: Config["areasComedor"][number];
  mesas: Config["tables"];
  api: Api;
  hacer: Hacer;
}) {
  const [cantidad, setCantidad] = useState<number | null>(4);
  const [prefijo, setPrefijo] = useState("");
  const [una, setUna] = useState("");
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <TbArmchair className="shrink-0 text-[18px] text-brand-600" />
        <Input
          variant="borderless"
          className="min-w-0 flex-1 !max-w-[260px] !px-1 text-[15px] font-bold"
          defaultValue={area.name}
          suffix={<TbEdit className="text-muted" />}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== area.name && hacer(() => api.put(`/dining-areas/${area.id}`, { name: e.target.value }), "Área renombrada")}
        />
        <span className="shrink-0 text-[12px] text-muted">{mesas.length} mesas</span>
        <Popconfirm title="¿Borrar el área?" description="Solo se puede si no tiene mesas." onConfirm={() => hacer(() => api.delete(`/dining-areas/${area.id}`))}>
          <Button className="ml-auto" size="small" type="text" danger icon={<TbTrash />} />
        </Popconfirm>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {mesas.map((t) => (
          <Mesa key={t.id} t={t} api={api} hacer={hacer} />
        ))}
        {!mesas.length && <span className="text-[13px] text-muted">Aún sin mesas.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        <span className="text-[12.5px] text-muted">Agregar</span>
        <InputNumber min={1} max={100} value={cantidad} onChange={setCantidad} addonAfter="mesas" className="w-32" />
        <Input className="min-w-0 flex-1 sm:max-w-[150px] sm:flex-none" placeholder="Prefijo: T (opcional)" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} />
        <Button icon={<TbPlus />} onClick={() => hacer(() => api.post("/tables/bulk", { count: cantidad, prefix: prefijo, diningAreaId: area.id }), "Mesas creadas")}>
          Crear
        </Button>
        <span className="basis-full sm:hidden" />
        <span className="text-[12.5px] text-muted">o una:</span>
        <Input className="min-w-0 flex-1 sm:max-w-[140px] sm:flex-none" placeholder="Barra 1" value={una} onChange={(e) => setUna(e.target.value)} />
        <Button onClick={() => hacer(() => api.post("/tables", { name: una, diningAreaId: area.id }), "Mesa creada").then((ok) => ok && setUna(""))}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

function Mesa({ t, api, hacer, c }: { t: Config["tables"][number]; api: Api; hacer: Hacer; c?: Config }) {
  return (
    <Tag className="!flex !items-center !gap-2 !px-3 !py-1 text-[14px]">
      {t.name}
      {c && (
        <Select
          size="small"
          variant="borderless"
          placeholder="Mover a…"
          className="w-28"
          options={c.areasComedor.map((a) => ({ value: a.id, label: a.name }))}
          onChange={(v) => hacer(() => api.put(`/tables/${t.id}`, { name: t.name, diningAreaId: v }), "Mesa movida")}
        />
      )}
      <Popconfirm title="¿Borrar la mesa?" onConfirm={() => hacer(() => api.delete(`/tables/${t.id}`))}>
        <TbTrash className="cursor-pointer text-danger" />
      </Popconfirm>
    </Tag>
  );
}

// ------------------------------------------------------------ áreas/impresoras

function TabAreas({ c, api, hacer }: TabProps) {
  const [nombre, setNombre] = useState("");
  const [impresora, setImpresora] = useState("");
  const opciones = [{ value: 0, label: "Impresora de caja" }, ...c.printers.map((p) => ({ value: p.id, label: p.name }))];
  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] text-ink-soft">
        Un <b>área</b> es a dónde va un plato: Cocina, Parrilla, Barra… Cada área imprime en una impresora; varias áreas pueden
        compartir la misma (sale un ticket por área). Lo que no tiene área sale por la impresora de caja.
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Impresoras</div>
        {c.printers.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <TbPrinter className="text-brand-600" />
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
        <p className="mt-2 text-[12px] text-muted">El Bluetooth se empareja en «Central de impresión», en el celular Android del local.</p>
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Áreas de producción</div>
        {c.areas.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <Input
              className="max-w-[200px]"
              defaultValue={a.name}
              onBlur={(e) => e.target.value.trim() !== a.name && hacer(() => api.put(`/areas/${a.id}`, { name: e.target.value }))}
            />
            <span className="text-[12px] text-muted">imprime en</span>
            <Select className="w-48" value={a.printerId ?? 0} options={opciones} onChange={(v) => hacer(() => api.put(`/areas/${a.id}`, { printerId: v || null }))} />
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
      <div className="card p-4 text-[13px] text-ink-soft">
        También puedes elegir el área al editar cada plato o categoría en el Catálogo.
      </div>
      <div className="card p-4">
        <div className="mb-1 font-semibold">Por categoría</div>
        <p className="mb-3 text-[12.5px] text-muted">Los platos de la categoría salen a esta área, salvo que el plato tenga una propia.</p>
        {c.categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className="flex-1">{cat.name}</span>
            <Select className="w-44" value={cat.productionAreaId ?? 0} options={opciones} onChange={(v) => hacer(() => api.put("/area-assignments", { categories: { [cat.id]: v || null } }))} />
          </div>
        ))}
      </div>
      <div className="card p-4">
        <div className="mb-1 font-semibold">Por plato</div>
        {c.products.map((p) => {
          const heredada = p.categoryIds.map((id) => areaCat.get(id)).find(Boolean) ?? null;
          return (
            <div key={p.id} className="flex items-center gap-2 border-t border-line-soft py-2 first:border-0">
              <span className="flex-1">
                {p.name}
                {!p.productionAreaId && (
                  <span className="block text-[11.5px] text-muted">{heredada ? `Sale a ${nombreArea(heredada)} (por categoría)` : "Sin área: sale por caja"}</span>
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

// ---------------------------------------------------------------- cajas/folios

function TabCajas({ c, api, hacer }: TabProps) {
  const [caja, setCaja] = useState("");
  const [serie, setSerie] = useState({ code: "", name: "", nextNumber: 1 });
  const opcionesSerie = c.series.filter((s) => s.isActive).map((s) => ({ value: s.id, label: `${s.code}${s.name ? ` · ${s.name}` : ""}` }));
  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] text-ink-soft">
        El <b>folio</b> se asigna al imprimir la cuenta (o al cobrar si nunca se imprimió) y no cambia al reimprimir. Cada caja usa
        una serie; varias cajas pueden compartir la misma serie sin repetir números.
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Cajas</div>
        {c.registers.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <Input
              className="min-w-0 flex-1 sm:max-w-[220px] sm:flex-none"
              defaultValue={r.name}
              onBlur={(e) => e.target.value.trim() !== r.name && hacer(() => api.put(`/registers/${r.id}`, { name: e.target.value }))}
            />
            <span className="basis-full sm:hidden" />
            <span className="text-[12px] text-muted">serie</span>
            <Select
              className="min-w-0 flex-1 sm:w-48 sm:flex-none"
              value={r.folioSeriesId ?? 0}
              options={[{ value: 0, label: "La primera (por defecto)" }, ...opcionesSerie]}
              onChange={(v) => hacer(() => api.put(`/registers/${r.id}`, { name: r.name, folioSeriesId: v || null }))}
            />
            <Popconfirm title="¿Dar de baja la caja?" onConfirm={() => hacer(() => api.delete(`/registers/${r.id}`))}>
              <Button icon={<TbTrash />} danger type="text" />
            </Popconfirm>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Input placeholder="Nueva caja: Barra, Caja 2…" value={caja} onChange={(e) => setCaja(e.target.value)} />
          <Button icon={<TbPlus />} onClick={() => hacer(() => api.post("/registers", { name: caja }), "Caja creada").then((ok) => ok && setCaja(""))}>
            Agregar
          </Button>
        </div>
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Series de folio</div>
        {c.series.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className="w-16 font-mono font-bold">{s.code}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{s.name}</span>
            <span className="basis-full sm:hidden" />
            <span className="text-[12px]">Siguiente folio</span>
            <InputNumber
              min={s.nextNumber}
              defaultValue={s.nextNumber}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v > s.nextNumber) void hacer(() => api.put(`/series/${s.id}`, { nextNumber: v }), "Serie actualizada");
              }}
            />
            <Switch checked={s.isActive} checkedChildren="Activa" unCheckedChildren="Inactiva" onChange={(v) => hacer(() => api.put(`/series/${s.id}`, { isActive: v }))} />
          </div>
        ))}
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="max-w-[100px]" placeholder="B" value={serie.code} onChange={(e) => setSerie({ ...serie, code: e.target.value.toUpperCase() })} />
          <Input className="max-w-[200px]" placeholder="Nombre (opcional)" value={serie.name} onChange={(e) => setSerie({ ...serie, name: e.target.value })} />
          <InputNumber min={1} value={serie.nextNumber} onChange={(v) => setSerie({ ...serie, nextNumber: Number(v) || 1 })} addonBefore="Empieza en" />
          <Button icon={<TbPlus />} onClick={() => hacer(() => api.post("/series", serie), "Serie creada").then((ok) => ok && setSerie({ code: "", name: "", nextNumber: 1 }))}>
            Agregar serie
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted">El siguiente folio solo puede subir: bajarlo repetiría números ya usados.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- personal

function TabPersonal({ c, api, hacer }: TabProps) {
  const [form, setForm] = useState<{ id?: number; name: string; pin: string; role: Rol } | null>(null);
  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] text-ink-soft">
        Cada persona entra con su <b>PIN</b> en un equipo vinculado (no hace falta correo). El PIN no se puede repetir en el negocio.
        Lo que cada rol puede hacer se ajusta en la pestaña <b>Permisos</b>.
      </div>
      <div className="card p-4">
        <div className="mb-2 flex items-center">
          <span className="flex-1 font-semibold">Personal</span>
          <Button type="primary" icon={<TbPlus />} onClick={() => setForm({ name: "", pin: "", role: "mesero" })}>
            Agregar
          </Button>
        </div>
        {c.staff.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <span className={`min-w-0 flex-1 truncate ${s.isActive ? "" : "text-muted line-through"}`}>{s.name}</span>
            <Tag className="!me-0" color={s.role === "gerente" ? "gold" : s.role === "cajero" ? "purple" : "blue"}>{NOMBRE_ROL[s.role]}</Tag>
            {/* En celular las acciones van debajo del nombre, para no cortarlo. */}
            <span className="flex shrink-0 gap-1 max-sm:w-full max-sm:justify-end">
            <Button size="small" onClick={() => setForm({ id: s.id, name: s.name, pin: "", role: s.role })}>
              Editar
            </Button>
            <Button size="small" onClick={() => hacer(() => api.put(`/staff/${s.id}`, { isActive: !s.isActive }))}>
              {s.isActive ? "Desactivar" : "Activar"}
            </Button>
            <Popconfirm title="¿Borrar a esta persona?" onConfirm={() => hacer(() => api.delete(`/staff/${s.id}`))}>
              <Button size="small" danger icon={<TbTrash />} />
            </Popconfirm>
            </span>
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
            () => (form.id ? api.put(`/staff/${form.id}`, { name: form.name, role: form.role, ...(form.pin ? { pin: form.pin } : {}) }) : api.post("/staff", form)),
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
            <Segmented
              block
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v as Rol })}
              options={(["mesero", "cajero", "gerente"] as Rol[]).map((r) => ({ value: r, label: NOMBRE_ROL[r] }))}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function TabPermisos({ c, api, hacer }: TabProps) {
  const [permisos, setPermisos] = useState<Record<Rol, Permisos>>(c.ajustes.permisos);
  useEffect(() => setPermisos(c.ajustes.permisos), [c.ajustes.permisos]);
  const grupos = [...new Set(Object.values(c.catalogoPermisos).map((p) => p.grupo))];
  const cambiar = (rol: Rol, k: string, v: boolean | number | string) => setPermisos({ ...permisos, [rol]: { ...permisos[rol], [k]: v } });
  const sucio = JSON.stringify(permisos) !== JSON.stringify(c.ajustes.permisos);
  /** En celular no caben tres columnas: se elige el rol y se ve una sola. */
  const [rolMovil, setRolMovil] = useState<Rol>(c.roles[0]);
  const control = (r: Rol, k: string, d: (typeof c.catalogoPermisos)[string]) =>
    d.tipo === "si_no" ? (
      <Switch size="small" checked={permisos[r][k] === true} onChange={(v) => cambiar(r, k, v)} />
    ) : d.tipo === "tope" ? (
      <InputNumber size="small" className="!w-24" min={0} max={100} addonAfter="%" value={Number(permisos[r][k] ?? 0)} onChange={(v) => cambiar(r, k, Number(v) || 0)} />
    ) : (
      <Select
        size="small"
        className="w-36"
        value={String(permisos[r][k])}
        options={Object.entries(d.opciones ?? {}).map(([value, label]) => ({ value, label }))}
        onChange={(v) => cambiar(r, k, v)}
      />
    );

  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] text-ink-soft">
        Lo que no tenga permitido una persona, lo puede hacer igual si un encargado escribe su PIN en ese momento («Autorización»):
        queda registrado quién autorizó. El dueño puede todo.
      </div>
      <Segmented
        block
        className="sm:!hidden"
        value={rolMovil}
        onChange={(v) => setRolMovil(v as Rol)}
        options={c.roles.map((r) => ({ value: r, label: NOMBRE_ROL[r] }))}
      />
      {grupos.map((g) => (
        <div key={g} className="card p-4">
          <div className="mb-2 font-semibold">{g}</div>
          <div className="sm:hidden">
            {Object.entries(c.catalogoPermisos)
              .filter(([, d]) => d.grupo === g)
              .map(([k, d]) => (
                <div key={k} className="flex items-center gap-3 border-t border-line-soft py-2 text-[13px] first:border-0">
                  <span className="min-w-0 flex-1">{d.label}</span>
                  <span className="shrink-0">{control(rolMovil, k, d)}</span>
                </div>
              ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-1 font-normal">Permiso</th>
                {c.roles.map((r) => (
                  <th key={r} className="w-40 py-1 text-center font-normal">
                    {NOMBRE_ROL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(c.catalogoPermisos)
                .filter(([, d]) => d.grupo === g)
                .map(([k, d]) => (
                  <tr key={k} className="border-t border-line-soft">
                    <td className="py-2 pr-2">{d.label}</td>
                    {c.roles.map((r) => (
                      <td key={r} className="py-2 text-center">
                        {control(r, k, d)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}
      <div className="sticky bottom-3 ml-auto flex w-fit justify-end gap-2 rounded-xl bg-white/90 p-2 shadow-[0_4px_16px_rgba(20,18,67,0.12)] backdrop-blur">
        {sucio && <Button onClick={() => setPermisos(c.ajustes.permisos)}>Deshacer</Button>}
        <Button type="primary" disabled={!sucio} onClick={() => hacer(() => api.put("/settings", { permisos }), "Permisos guardados. Rigen desde la próxima acción.")}>
          Guardar permisos
        </Button>
      </div>
      <HistorialAutorizaciones api={api} />
    </div>
  );
}

function HistorialAutorizaciones({ api }: { api: Api }) {
  const [filas, setFilas] = useState<{ id: number; permission: string; requested_by_name: string; authorized_by_name: string; context: string; created_at: string }[] | null>(null);
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center">
        <span className="flex-1 font-semibold">Quién autorizó qué</span>
        <Button size="small" icon={<TbRefresh />} onClick={async () => setFilas((await api.get("/authorizations")).data.data)}>
          {filas ? "Actualizar" : "Ver"}
        </Button>
      </div>
      {filas && (
        <Table
          size="small"
          rowKey="id"
          pagination={{ pageSize: 10 }}
          dataSource={filas}
          columns={[
            { title: "Cuándo", dataIndex: "created_at", render: (v: string) => dayjs(v).format("DD/MM HH:mm") },
            { title: "Pidió", dataIndex: "requested_by_name" },
            { title: "Autorizó", dataIndex: "authorized_by_name" },
            { title: "Qué", dataIndex: "context" },
          ]}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------- equipos

function TabEquipos({ c, api, hacer }: TabProps) {
  const link = `${window.location.origin}/pdv`;
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-1 font-semibold">Vincular un celular o tablet</div>
        <ol className="mb-4 list-decimal pl-5 text-[13px] text-ink-soft">
          <li>
            En el equipo abre <b>{link}</b>{" "}
            <Button
              size="small"
              type="link"
              icon={<TbCopy />}
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                message.success("Link copiado");
              }}
            >
              copiar
            </Button>
          </li>
          <li>Escribe este código y ponle un nombre al equipo.</li>
          <li>Listo: desde ahí el personal entra solo con su PIN.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-brand-50 px-5 py-3 font-mono text-[32px] font-bold tracking-[0.3em] text-brand-700">{c.pairingCode}</span>
          <Popconfirm
            title="¿Cambiar el código?"
            description="Los equipos ya vinculados siguen funcionando; el código viejo deja de servir para vincular nuevos."
            onConfirm={() => hacer(() => api.post("/pairing-code"), "Código cambiado")}
          >
            <Button icon={<TbRefresh />}>Cambiar código</Button>
          </Popconfirm>
        </div>
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Equipos vinculados</div>
        {c.devices.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 border-t border-line-soft py-2 first:border-0">
            <Input
              className="max-sm:w-full sm:max-w-[200px]"
              defaultValue={d.name}
              onBlur={(e) => e.target.value.trim() !== d.name && hacer(() => api.put(`/devices/${d.id}`, { name: e.target.value }))}
            />
            <Select
              className="max-sm:w-full sm:w-44"
              value={d.mode}
              options={[
                { value: "pdv", label: "PDV (con PIN)" },
                { value: "monitor", label: "Monitor de producción" },
              ]}
              onChange={(v) => hacer(() => api.put(`/devices/${d.id}`, { mode: v }), v === "monitor" ? "Ahora es monitor: recarga la página en ese equipo" : "Guardado")}
            />
            {d.mode === "monitor" ? (
              <Select
                mode="multiple"
                className="max-sm:w-full sm:min-w-48"
                placeholder="Todas las áreas"
                value={d.areaIds}
                options={c.areas.map((a) => ({ value: a.id, label: a.name }))}
                onChange={(v) => hacer(() => api.put(`/devices/${d.id}`, { areaIds: v }))}
              />
            ) : (
              <span className="flex items-center gap-2 max-sm:w-full">
                <span className="shrink-0 text-[12px] text-muted">cobra en</span>
                <Select
                  className="min-w-0 flex-1 sm:w-44 sm:flex-none"
                  value={d.cashRegisterId ?? 0}
                  options={[{ value: 0, label: "La caja abierta" }, ...c.registers.map((r) => ({ value: r.id, label: r.name }))]}
                  onChange={(v) => hacer(() => api.put(`/devices/${d.id}`, { cashRegisterId: v || null }))}
                />
              </span>
            )}
            <span className="min-w-0 flex-1 text-[12px] text-muted">{d.lastSeenAt ? `Último uso ${dayjs(d.lastSeenAt).format("DD/MM HH:mm")}` : "Sin uso"}</span>
            <Popconfirm title="¿Desvincular el equipo?" description="Se cierran las sesiones abiertas en él." onConfirm={() => hacer(() => api.delete(`/devices/${d.id}`), "Equipo desvinculado")}>
              <Button size="small" danger>
                Desvincular
              </Button>
            </Popconfirm>
          </div>
        ))}
        {!c.devices.length && <div className="text-muted">Aún no hay equipos vinculados.</div>}
        <p className="mt-2 text-[12px] text-muted">
          «Cobra en»: si hay varias cajas abiertas, los cobros hechos desde ese equipo van a esa caja (y su serie de folios).
          Un equipo en modo «Monitor de producción» (una tablet o TV en cocina o barra) muestra los platos de sus áreas sin pedir PIN.
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- tickets

/** Campos que se pueden ocultar, agrupados por la parte del ticket donde salen. */
const CAMPOS: Record<TipoTicket, { k: string; label: string; parte: "titulo" | "pie" }[]> = {
  comanda: [
    { k: "servicio", label: "PARA LLEVAR / DELIVERY en grande", parte: "titulo" },
    { k: "hora", label: "Hora", parte: "titulo" },
    { k: "ronda", label: "Número de ronda", parte: "titulo" },
    { k: "mesero", label: "Mesero", parte: "titulo" },
    { k: "cuenta", label: "Código de cuenta", parte: "pie" },
  ],
  cuenta: [
    { k: "ruc", label: "RUC", parte: "titulo" },
    { k: "direccion", label: "Dirección", parte: "titulo" },
    { k: "telefono", label: "Teléfono", parte: "titulo" },
    { k: "folio", label: "Folio", parte: "titulo" },
    { k: "hora", label: "Fecha y hora", parte: "titulo" },
    { k: "mesero", label: "Mesero", parte: "titulo" },
    { k: "comensales", label: "Personas", parte: "titulo" },
    { k: "leyenda", label: "Leyenda «no es comprobante»", parte: "pie" },
  ],
  nota_venta: [
    { k: "ruc", label: "RUC", parte: "titulo" },
    { k: "direccion", label: "Dirección", parte: "titulo" },
    { k: "telefono", label: "Teléfono", parte: "titulo" },
    { k: "folio", label: "Folio", parte: "titulo" },
    { k: "hora", label: "Fecha y hora", parte: "titulo" },
    { k: "mesero", label: "Mesero", parte: "titulo" },
    { k: "pagos", label: "Métodos de pago", parte: "pie" },
    { k: "vuelto", label: "Vuelto", parte: "pie" },
    { k: "cajero", label: "Cajero", parte: "pie" },
    { k: "leyenda", label: "Leyenda", parte: "pie" },
  ],
  cancelacion: [
    { k: "motivo", label: "Motivo", parte: "pie" },
    { k: "firma", label: "Línea de firma", parte: "pie" },
  ],
  corte: [
    { k: "top", label: "Más vendidos (corte global)", parte: "pie" },
    { k: "firma", label: "Línea de firma", parte: "pie" },
  ],
};

const NOMBRE_TIPO: Record<TipoTicket, string> = {
  comanda: "Comanda",
  cuenta: "Cuenta",
  nota_venta: "Nota de venta",
  cancelacion: "Cancelación",
  corte: "Cortes de caja",
};

/** Ticket de ejemplo para la vista previa. */
function muestra(tipo: TipoTicket, estilo: unknown): TrabajoImpresion {
  const base = { estilo, hora: dayjs().format("DD/MM HH:mm"), simbolo: "S/", negocio: "Mi restaurante" };
  const lineas = [
    { cantidad: 2, nombre: "Lomo saltado", total: 56 },
    { cantidad: 1, nombre: "Chicha morada jarra", total: 12 },
  ];
  if (tipo === "comanda") {
    return {
      id: 0,
      kind: "comanda",
      printerId: null,
      payload: {
        ...base,
        area: "Cocina",
        servicio: "para_llevar",
        mesa: "Orden 7",
        mesero: "Ana",
        ronda: 1,
        cuenta: "P-000123",
        items: [
          { cantidad: 2, nombre: "Lomo saltado", opciones: ["Término medio"], nota: "sin cebolla" },
          { cantidad: 1, nombre: "Ceviche", opciones: [], nota: null },
        ],
      },
    };
  }
  if (tipo === "cancelacion") {
    return { id: 0, kind: "cancelacion", printerId: null, payload: { ...base, mesa: "Mesa 5", cuenta: "P-000123", canceladoPor: "Luis", motivo: "Cliente se retiró", total: 68, lineas } };
  }
  if (tipo === "corte") {
    return {
      id: 0,
      kind: "corte_z",
      printerId: null,
      payload: {
        ...base,
        z: 12,
        caja: "Caja principal",
        usuario: "Rosa",
        apertura: "20/11 08:00",
        cierre: "20/11 16:00",
        fondo: 100,
        porMetodo: [
          { metodo: "efectivo", monto: 420 },
          { metodo: "yape", monto: 180 },
        ],
        totalVentas: 600,
        ventas: 24,
        ingresos: 0,
        retiros: 20,
        efectivoEsperado: 500,
        lineas: [
          { metodo: "efectivo", esperado: 500, declarado: 498, diferencia: -2 },
          { metodo: "yape", esperado: 180, declarado: 180, diferencia: 0 },
        ],
        diferencia: -2,
      },
    };
  }
  return {
    id: 0,
    kind: tipo === "cuenta" ? "precuenta" : "nota_venta",
    printerId: null,
    payload: {
      ...base,
      servicio: "comedor",
      mesa: "Mesa 5",
      mesero: "Ana",
      comensales: 2,
      folio: "A-000123",
      lineas,
      subtotal: 68,
      descuento: 0,
      total: 68,
      pagos: [{ method: "efectivo", amount: 68 }],
      vuelto: 32,
      cajero: "Rosa",
    },
  };
}

const NIVELES = [
  { value: 1, label: "Normal" },
  { value: 2, label: "Alto" },
  { value: 3, label: "Grande" },
];

function TabTickets({ c, api, hacer }: TabProps) {
  const [t, setT] = useState(c.ajustes.ticket);
  const [sel, setSel] = useState<TipoTicket | "negocio">("cuenta");
  const [papel, setPapel] = useState<58 | 80>(58);
  useEffect(() => setT(c.ajustes.ticket), [c.ajustes.ticket]);
  const tipo: TipoTicket = sel === "negocio" ? "cuenta" : sel;
  const e = t.tipos[tipo];
  const setE = (cambios: Partial<EstiloTicket>) => setT({ ...t, tipos: { ...t.tipos, [tipo]: { ...e, ...cambios } } });
  const sucio = JSON.stringify(t) !== JSON.stringify(c.ajustes.ticket);

  const estilo = {
    general: { nombre: t.nombre || "Mi restaurante", ruc: t.ruc, direccion: t.direccion, telefono: t.telefono, encabezado: t.encabezado, pie: t.pie, leyenda: t.leyenda },
    tipo: e,
  };
  const vista = vistaPrevia(muestra(tipo, estilo), papel);

  /** Una parte del ticket: tamaño, negrita y los campos que salen en ella. */
  const Parte = ({ nombre, k, campos }: { nombre: string; k: "titulo" | "detalle" | "total"; campos?: "titulo" | "pie" }) => (
    <div className="border-t border-line-soft py-3 first:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 font-semibold text-ink">{nombre}</span>
        <Select size="small" className="w-28" value={e[k].tamano ?? 1} options={NIVELES} onChange={(v) => setE({ [k]: { ...e[k], tamano: v } })} />
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <Switch size="small" checked={Boolean(e[k].negrita)} onChange={(v) => setE({ [k]: { ...e[k], negrita: v } })} />
          Negrita
        </label>
      </div>
      {campos && CAMPOS[tipo].some((f) => f.parte === campos) && (
        <div className="mt-2 grid gap-1.5 pl-1 sm:grid-cols-2">
          {CAMPOS[tipo]
            .filter((f) => f.parte === campos)
            .map((f) => (
              <label key={f.k} className="flex items-center gap-2 text-[13px]">
                <Switch size="small" checked={e.campos?.[f.k] !== false} onChange={(v) => setE({ campos: { ...e.campos, [f.k]: v } })} />
                {f.label}
              </label>
            ))}
        </div>
      )}
    </div>
  );

  const items: { k: TipoTicket | "negocio"; label: string; nota: string }[] = [
    { k: "negocio", label: "Datos del negocio", nota: "Nombre, RUC, dirección, pie" },
    { k: "comanda", label: "Comanda", nota: "Lo que sale en cocina y barra" },
    { k: "cuenta", label: "Cuenta", nota: "Al imprimir la cuenta (con folio)" },
    { k: "nota_venta", label: "Nota de venta", nota: "Al cobrar" },
    { k: "cancelacion", label: "Cancelación", nota: "Cuenta cancelada" },
    { k: "corte", label: "Cortes de caja", nota: "Corte X, Z y global" },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_1fr_340px]">
      {/* Tipos de ticket */}
      <div className="card h-fit overflow-hidden p-0">
        {items.map((i) => (
          <button
            key={i.k}
            onClick={() => setSel(i.k)}
            className={`block w-full border-b border-line-soft px-4 py-3 text-left last:border-0 ${sel === i.k ? "bg-brand-50" : "hover:bg-canvas"}`}
          >
            <span className={`block text-[13.5px] ${sel === i.k ? "font-bold text-brand-700" : "font-semibold text-ink"}`}>{i.label}</span>
            <span className="block text-[11.5px] text-muted">{i.nota}</span>
          </button>
        ))}
      </div>

      {/* Edición */}
      <div className="card h-fit p-4">
        {sel === "negocio" ? (
          <div className="space-y-2">
            <div className="mb-1 font-bold text-ink">Datos del negocio</div>
            <p className="text-[12.5px] text-muted">Salen arriba de la cuenta, la nota de venta y la cancelación.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Nombre comercial" value={t.nombre} onChange={(ev) => setT({ ...t, nombre: ev.target.value })} />
              <Input placeholder="RUC" value={t.ruc} onChange={(ev) => setT({ ...t, ruc: ev.target.value })} />
              <Input placeholder="Dirección" value={t.direccion} onChange={(ev) => setT({ ...t, direccion: ev.target.value })} />
              <Input placeholder="Teléfono" value={t.telefono} onChange={(ev) => setT({ ...t, telefono: ev.target.value })} />
            </div>
            <Input.TextArea rows={2} maxLength={200} placeholder="Texto de encabezado (opcional)" value={t.encabezado} onChange={(ev) => setT({ ...t, encabezado: ev.target.value })} />
            <Input.TextArea rows={2} maxLength={200} placeholder="Pie: Gracias por su visita…" value={t.pie} onChange={(ev) => setT({ ...t, pie: ev.target.value })} />
            <Input placeholder="Leyenda: Documento no válido como comprobante de pago" value={t.leyenda} onChange={(ev) => setT({ ...t, leyenda: ev.target.value })} />
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex-1 font-bold text-ink">{NOMBRE_TIPO[tipo]}</span>
              <span className="text-[12.5px] text-muted">Copias</span>
              <InputNumber size="small" min={1} max={5} value={e.copias} onChange={(v) => setE({ copias: Number(v) || 1 })} />
            </div>
            <Parte nombre="Encabezado" k="titulo" campos="titulo" />
            <Parte nombre={tipo === "comanda" ? "Platos" : "Detalle"} k="detalle" />
            {tipo !== "comanda" && <Parte nombre="Total" k="total" campos="pie" />}
            {tipo === "comanda" && CAMPOS.comanda.some((f) => f.parte === "pie") && (
              <div className="border-t border-line-soft pt-3">
                <div className="mb-2 font-semibold text-ink">Pie</div>
                {CAMPOS.comanda
                  .filter((f) => f.parte === "pie")
                  .map((f) => (
                    <label key={f.k} className="flex items-center gap-2 text-[13px]">
                      <Switch size="small" checked={e.campos?.[f.k] !== false} onChange={(v) => setE({ campos: { ...e.campos, [f.k]: v } })} />
                      {f.label}
                    </label>
                  ))}
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
          {sucio && <Button onClick={() => setT(c.ajustes.ticket)}>Deshacer</Button>}
          <Button icon={<TbPrinter />} onClick={() => hacer(() => api.post("/print-test", { kind: "muestra" }), "Cuenta de muestra enviada a la central")}>
            Imprimir muestra
          </Button>
          <Button type="primary" disabled={!sucio} onClick={() => hacer(() => api.put("/settings", { ticket: t }), "Estilo de tickets guardado")}>
            Guardar
          </Button>
        </div>
      </div>

      {/* Papel */}
      <div className="xl:sticky xl:top-4 xl:h-fit">
        <div className="mb-2 flex items-center gap-2 text-[12px] text-muted">
          Vista previa
          <Segmented
            size="small"
            value={papel}
            onChange={(v) => setPapel(v as 58 | 80)}
            options={[
              { value: 58, label: "58 mm" },
              { value: 80, label: "80 mm" },
            ]}
          />
        </div>
        <div className="mx-auto rounded-md bg-white p-3 shadow-md" style={{ width: papel === 80 ? 330 : 240 }}>
          {vista.lineas.map((l, i) => (
            <div
              key={i}
              className="whitespace-pre font-mono leading-tight text-black"
              style={{
                fontSize: l.tamano === 3 ? 13 : 7.2,
                lineHeight: l.tamano >= 2 ? 1.9 : 1.35,
                transform: l.tamano === 2 ? "scaleY(1.7)" : undefined,
                fontWeight: l.negrita ? 700 : 400,
                textAlign: l.alinear === "centro" ? "center" : "left",
              }}
            >
              {l.texto || " "}
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11.5px] text-muted">Vista aproximada: el papel real lo dibuja la impresora.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- opciones

function TabOpciones({ c, api, hacer }: TabProps) {
  const a = c.ajustes;
  const guardar = (cambios: Partial<Ajustes>) => hacer(() => api.put("/settings", cambios), "Guardado");
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 font-semibold">Servicios</div>
        <p className="mb-3 text-[12.5px] text-muted">Los botones que aparecen en el PDV. Apaga los que tu local no usa.</p>
        {(["comedor", "para_llevar", "delivery"] as const).map((s) => (
          <label key={s} className="flex items-center gap-2 py-1 text-[13.5px]">
            <Switch checked={a.servicios[s]} onChange={(v) => guardar({ servicios: { ...a.servicios, [s]: v } })} />
            {s === "comedor" ? "Comedor (mesas)" : s === "para_llevar" ? "Para llevar" : "Delivery"}
          </label>
        ))}
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Mesas</div>
        <label className="flex items-start gap-2 text-[13.5px]">
          <Switch checked={a.liberarMesaManual} onChange={(v) => guardar({ liberarMesaManual: v })} />
          <span>
            Liberar mesas a mano
            <span className="block text-[12px] text-muted">
              Encendido: después de cobrar la mesa queda «Por liberar» hasta que alguien confirme que está limpia. Apagado: queda libre al cobrar.
            </span>
          </span>
        </label>
      </div>
      <div className="card p-4">
        <div className="mb-2 font-semibold">Bloqueo por inactividad</div>
        <p className="mb-2 text-[12.5px] text-muted">En los equipos del personal, si nadie toca la pantalla este tiempo, se vuelve a pedir el PIN.</p>
        <Select
          className="w-48"
          value={a.inactividadSegundos}
          onChange={(v) => guardar({ inactividadSegundos: v })}
          options={[
            { value: 0, label: "Nunca" },
            { value: 60, label: "1 minuto" },
            { value: 120, label: "2 minutos" },
            { value: 300, label: "5 minutos" },
            { value: 600, label: "10 minutos" },
            { value: 1800, label: "30 minutos" },
          ]}
        />
      </div>
    </div>
  );
}
