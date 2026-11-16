import { useMemo, useState } from "react";
import { AutoComplete, Button, Empty, Input, Modal, Popconfirm, Select, Table, Upload, message } from "antd";
import { TbClipboardText, TbDownload, TbEdit, TbFileSpreadsheet, TbPlus, TbTrash } from "react-icons/tb";
import { crearXlsx, descargar, leerTextoTabla, leerXlsx } from "../../../utilities/xlsx";
import { nuevoId, type Sede } from "./tipos";

const COLUMNAS = ["Departamento", "Provincia", "Distrito", "Nombre de la sede", "Dirección", "Referencia u horario"];
const CAMPOS: (keyof Sede)[] = ["departamento", "provincia", "distrito", "nombre", "direccion", "referencia"];

/** Encabezado del Excel → campo (acepta variaciones comunes). */
function campoDe(encabezado: string): keyof Sede | null {
  const t = encabezado
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (t.includes("depart") || t === "region") return "departamento";
  if (t.includes("provin")) return "provincia";
  if (t.includes("distrit") || t.includes("ciudad")) return "distrito";
  if (t.includes("direc")) return "direccion";
  if (t.includes("refer") || t.includes("horario")) return "referencia";
  if (t.includes("nombre") || t.includes("sede") || t.includes("agencia")) return "nombre";
  return null;
}

/** Convierte filas (Excel o texto pegado) en sedes de una empresa. */
function filasASedes(filas: string[][], empresa: string): Sede[] {
  if (!filas.length) return [];
  const conEncabezado = filas[0].some((c) => campoDe(c));
  const mapa: (keyof Sede | null)[] = conEncabezado ? filas[0].map(campoDe) : CAMPOS;
  return (conEncabezado ? filas.slice(1) : filas)
    .filter((f) => f.some((c) => c?.trim()) && !f.join(" ").toLowerCase().includes("(ejemplo)"))
    .map((f) => {
      const s: Sede = {
        id: nuevoId(),
        empresa,
        departamento: "",
        provincia: "",
        distrito: "",
        nombre: "",
        direccion: "",
        referencia: "",
      };
      f.forEach((valor, i) => {
        const campo = mapa[i];
        if (campo && campo !== "id" && campo !== "empresa") s[campo] = String(valor ?? "").trim();
      });
      return s;
    })
    .filter((s) => s.direccion || s.nombre);
}

interface Props {
  sedes: Sede[];
  onChange: (s: Sede[]) => void;
  /** Nombres de los tipos de entrega por agencia (Shalom, Olva…). */
  empresasSugeridas: string[];
}

/**
 * Sedes de las agencias (Shalom, Olva, Marvisur…). Con ellas, cuando el
 * comprador dice su ciudad, el vendedor le muestra las sedes de ahí con su
 * dirección. Se cargan a mano, desde la plantilla de Excel o pegando celdas.
 */
export default function SedesEditor({ sedes, onChange, empresasSugeridas }: Props) {
  const empresas = useMemo(
    () => [...new Set([...empresasSugeridas, ...sedes.map((s) => s.empresa)].filter(Boolean))],
    [empresasSugeridas, sedes]
  );
  const [empresa, setEmpresa] = useState(empresas[0] ?? "Shalom");
  const [buscar, setBuscar] = useState("");
  const [editando, setEditando] = useState<Sede | null>(null);
  const [pegando, setPegando] = useState(false);
  const [texto, setTexto] = useState("");
  const [pendiente, setPendiente] = useState<{
    nuevas: Sede[];
    aplicar: (m: "reemplazar" | "agregar") => void;
  } | null>(null);

  const deEmpresa = sedes.filter((s) => s.empresa === empresa);
  const visibles = deEmpresa.filter((s) =>
    `${s.departamento} ${s.provincia} ${s.distrito} ${s.nombre} ${s.direccion}`
      .toLowerCase()
      .includes(buscar.toLowerCase())
  );

  const reemplazar = (nuevas: Sede[]) => {
    if (!nuevas.length) {
      message.warning("No encontramos sedes en el archivo. Revisa que tenga las columnas de la plantilla.");
      return;
    }
    const aplicar = (modo: "reemplazar" | "agregar") => {
      onChange(
        modo === "reemplazar" ? [...sedes.filter((s) => s.empresa !== empresa), ...nuevas] : [...sedes, ...nuevas]
      );
      message.success(`${nuevas.length} sedes de ${empresa} cargadas. Recuerda pulsar «Guardar cambios».`);
    };
    if (!deEmpresa.length) return aplicar("agregar");
    setPendiente({ nuevas, aplicar });
  };

  const plantilla = () => {
    const blob = crearXlsx(
      [
        COLUMNAS,
        ["Cusco", "Cusco", "Wanchaq", `${empresa} Wanchaq (ejemplo)`, "Av. Ejemplo 123", "Lun a Sáb 8am-8pm"],
        ["Cajamarca", "Jaén", "Jaén", `${empresa} Jaén (ejemplo)`, "Jr. Ejemplo 456", "Frente al mercado"],
      ],
      "Sedes",
      [16, 16, 18, 32, 40, 28]
    );
    descargar(blob, `plantilla-sedes-${empresa.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`);
  };

  const importar = async (archivo: File) => {
    try {
      const filas = /\.xlsx$/i.test(archivo.name) ? await leerXlsx(archivo) : leerTextoTabla(await archivo.text());
      reemplazar(filasASedes(filas, empresa));
    } catch (e: any) {
      message.error(e?.message ?? "No se pudo leer el archivo");
    }
    return false;
  };

  const guardarSede = () => {
    if (!editando) return;
    if (!editando.direccion.trim() && !editando.nombre.trim()) {
      message.warning("Escribe al menos el nombre o la dirección de la sede");
      return;
    }
    const existe = sedes.some((s) => s.id === editando.id);
    onChange(existe ? sedes.map((s) => (s.id === editando.id ? editando : s)) : [...sedes, editando]);
    setEditando(null);
  };

  return (
    <section className="card p-5">
      <p className="eyebrow">Sedes de agencias</p>
      <p className="mt-1 max-w-3xl text-[12px] text-muted">
        Cuando el comprador diga «Shalom a Cusco», el vendedor le mostrará las sedes de Cusco con su dirección
        para que elija. El nombre de la empresa debe ser igual al del tipo de entrega (por ejemplo, «Shalom»).
        Descarga la plantilla, llénala en Excel y súbela.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AutoComplete
          className="w-48"
          value={empresa}
          onChange={(v) => setEmpresa(v)}
          options={[...new Set([...empresas, "Shalom", "Olva Courier", "Marvisur"])].map((e) => ({
            value: e,
            label: `${e} (${sedes.filter((s) => s.empresa === e).length})`,
          }))}
          placeholder="Empresa"
        />
        <Button icon={<TbDownload />} onClick={plantilla}>
          Descargar plantilla Excel
        </Button>
        <Upload accept=".xlsx,.csv,.txt" showUploadList={false} beforeUpload={importar}>
          <Button type="primary" icon={<TbFileSpreadsheet />}>
            Importar Excel / CSV
          </Button>
        </Upload>
        <Button icon={<TbClipboardText />} onClick={() => setPegando(true)}>
          Pegar desde Excel
        </Button>
        <Button
          icon={<TbPlus />}
          onClick={() =>
            setEditando({
              id: nuevoId(),
              empresa,
              departamento: "",
              provincia: "",
              distrito: "",
              nombre: "",
              direccion: "",
              referencia: "",
            })
          }
        >
          Agregar sede
        </Button>
        {deEmpresa.length > 0 && (
          <Popconfirm
            title={`¿Borrar las ${deEmpresa.length} sedes de ${empresa}?`}
            okText="Borrar"
            cancelText="No"
            onConfirm={() => onChange(sedes.filter((s) => s.empresa !== empresa))}
          >
            <Button danger type="text" icon={<TbTrash />}>
              Borrar todas
            </Button>
          </Popconfirm>
        )}
      </div>

      {deEmpresa.length === 0 ? (
        <Empty className="my-8" description={`Aún no hay sedes de ${empresa || "esta empresa"}`} />
      ) : (
        <>
          <Input.Search
            className="mt-4 max-w-sm"
            placeholder="Buscar por ciudad, distrito o dirección"
            allowClear
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <Table
            className="mt-3"
            size="small"
            rowKey="id"
            dataSource={visibles}
            pagination={{ pageSize: 15, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 800 }}
            columns={[
              { title: "Departamento", dataIndex: "departamento" },
              { title: "Provincia", dataIndex: "provincia" },
              { title: "Distrito", dataIndex: "distrito" },
              { title: "Sede", dataIndex: "nombre" },
              { title: "Dirección", dataIndex: "direccion" },
              { title: "Referencia", dataIndex: "referencia" },
              {
                title: "",
                key: "acc",
                width: 80,
                render: (_: unknown, s: Sede) => (
                  <div className="flex">
                    <Button type="text" size="small" icon={<TbEdit />} onClick={() => setEditando({ ...s })} />
                    <Button
                      type="text"
                      size="small"
                      icon={<TbTrash />}
                      onClick={() => onChange(sedes.filter((x) => x.id !== s.id))}
                    />
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal
        open={Boolean(editando)}
        title="Sede"
        okText="Listo"
        cancelText="Cancelar"
        onOk={guardarSede}
        onCancel={() => setEditando(null)}
        destroyOnHidden
      >
        {editando && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[12px] font-semibold">Empresa</label>
              <Select
                className="w-full"
                value={editando.empresa}
                onChange={(v) => setEditando({ ...editando, empresa: v })}
                options={[...new Set([...empresas, empresa])].map((e) => ({ value: e, label: e }))}
              />
            </div>
            {CAMPOS.map((campo, i) => (
              <div key={campo} className={campo === "direccion" || campo === "nombre" ? "sm:col-span-2" : ""}>
                <label className="text-[12px] font-semibold">{COLUMNAS[i]}</label>
                <Input
                  value={editando[campo]}
                  maxLength={campo === "direccion" ? 250 : 120}
                  onChange={(e) => setEditando({ ...editando, [campo]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(pendiente)}
        title={`Ya tienes ${deEmpresa.length} sedes de ${empresa}`}
        onCancel={() => setPendiente(null)}
        footer={[
          <Button key="c" onClick={() => setPendiente(null)}>
            Cancelar
          </Button>,
          <Button
            key="a"
            onClick={() => {
              pendiente?.aplicar("agregar");
              setPendiente(null);
            }}
          >
            Agregar
          </Button>,
          <Button
            key="r"
            type="primary"
            onClick={() => {
              pendiente?.aplicar("reemplazar");
              setPendiente(null);
            }}
          >
            Reemplazar
          </Button>,
        ]}
      >
        ¿Reemplazarlas por las {pendiente?.nuevas.length} del archivo, o agregarlas a las que ya tienes?
      </Modal>

      <Modal
        open={pegando}
        title={`Pegar sedes de ${empresa}`}
        okText="Cargar"
        cancelText="Cancelar"
        onCancel={() => setPegando(false)}
        onOk={() => {
          reemplazar(filasASedes(leerTextoTabla(texto), empresa));
          setPegando(false);
          setTexto("");
        }}
      >
        <p className="mb-2 text-[12px] text-muted">
          En Excel selecciona las celdas (con o sin la fila de títulos), cópialas y pégalas aquí. Orden de columnas:{" "}
          {COLUMNAS.join(", ")}.
        </p>
        <Input.TextArea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Modal>
    </section>
  );
}
