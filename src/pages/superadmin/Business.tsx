import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { Business } from "../../types/main";
import { apiTienda } from "../../api/apiTienda";
import {
  Button,
  Card,
  Dropdown,
  Input,
  InputNumber,
  Modal,
  message,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import dayjs from "dayjs";
import type { AxiosError } from "axios";
import type { ColumnsType } from "antd/es/table";
import { BusinessFormModal } from "../../components/superAdmin/BusinessFormModal";

export function BusinessesPage(): React.ReactElement {
  const [data, setData] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "trial" | "active" | "expired" | "porvencer">(
    "todos"
  );

  // Activar plan: el superadmin cobra fuera del sistema y aquí lo registra.
  const [planTarget, setPlanTarget] = useState<Business | null>(null);
  const [planNombre, setPlanNombre] = useState("Mensual");
  const [planMeses, setPlanMeses] = useState(1);
  const [savingPlan, setSavingPlan] = useState(false);

  const operar = async (row: Business, body: Record<string, unknown>, ok: string) => {
    try {
      await apiTienda.put(`/businesses/${row.id}/subscription`, body);
      message.success(ok);
      fetchList();
    } catch (err) {
      const ax: any = err as AxiosError;
      message.error(ax.response?.data?.message ?? "No se pudo actualizar la suscripción");
    }
  };

  const confirmarPlan = async () => {
    if (!planTarget) return;
    setSavingPlan(true);
    await operar(
      planTarget,
      { action: "activate", plan: planNombre, months: planMeses },
      `Plan activado por ${planMeses} ${planMeses === 1 ? "mes" : "meses"}`
    );
    setSavingPlan(false);
    setPlanTarget(null);
  };

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);

  // Copiar catálogo (productos, insumos, recetas, modificadores) desde un molde.
  const [cloneTarget, setCloneTarget] = useState<Business | null>(null);
  const [cloneSource, setCloneSource] = useState<number | undefined>();
  const [cloning, setCloning] = useState(false);
  const [moldes, setMoldes] = useState<Business[]>([]);

  const openClone = async (row: Business) => {
    setCloneTarget(row);
    setCloneSource(undefined);
    try {
      const res = await apiTienda.get("/businesses", { params: { perPage: 200 } });
      setMoldes((res.data.data ?? res.data) as Business[]);
    } catch {
      message.error("No se pudo cargar la lista de negocios");
    }
  };

  const handleClone = async () => {
    if (!cloneTarget || !cloneSource) return;
    try {
      setCloning(true);
      const res = await apiTienda.post(`/businesses/${cloneTarget.id}/clone-catalog`, {
        source_business_id: cloneSource,
      });
      const d = res.data.data;
      message.success(
        `Copiado: ${d.products} productos, ${d.ingredients} insumos, ${d.recipes} recetas, ${d.modifierGroups} grupos de modificadores`
      );
      setCloneTarget(null);
    } catch (err) {
      const ax: any = err as AxiosError;
      message.error(ax.response?.data?.message ?? "No se pudo copiar el catálogo");
    } finally {
      setCloning(false);
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await apiTienda.get("/businesses", {
        params: { page, perPage: pageSize, search },
      });
      const list: Business[] = res.data.data ?? res.data;
      setData(list);
    } catch (err) {
      console.error(err);
      message.error("No se pudo cargar businesses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [page, pageSize]);

  const openCreate = () => {
    setEditing(null);
    setOpenModal(true);
  };
  const openEdit = (row: Business) => {
    setEditing(row);
    setOpenModal(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      setSaving(true);
      if (editing) {
        await apiTienda.put(`/businesses/${editing.id}`, values);
        message.success("Business actualizado");
      } else {
        await apiTienda.post("/businesses", values);
        message.success("Business creado");
      }
      setOpenModal(false);
      fetchList();
    } catch (err) {
      console.error(err);
      const ax: any = err as AxiosError;
      message.error(ax.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Business) => {
    try {
      await apiTienda.delete(`/businesses/${row.id}`);
      message.success("Business eliminado");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchList();
    } catch (err) {
      console.error(err);
      message.error("No se pudo eliminar");
    }
  };

  const estado = (b: Business) => b.effectiveSubscriptionStatus ?? "active";
  const porVencer = (b: Business) =>
    estado(b) !== "expired" &&
    b.subscriptionDaysLeft != null &&
    b.subscriptionDaysLeft <= 2;

  const conteo = useMemo(
    () => ({
      total: data.length,
      trial: data.filter((b) => estado(b) === "trial").length,
      active: data.filter((b) => estado(b) === "active").length,
      expired: data.filter((b) => estado(b) === "expired").length,
      porvencer: data.filter(porVencer).length,
    }),
    [data]
  );

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((b) => {
      if (filtro === "porvencer" ? !porVencer(b) : filtro !== "todos" && estado(b) !== filtro)
        return false;
      if (!q) return true;
      return [b.name, b.slug, b.user?.name, b.user?.email, b.whatsappPhone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, filtro, search]);

  const columns: ColumnsType<Business> = useMemo(
    () => [
      {
        title: "Negocio",
        key: "name",
        render: (_, b) => (
          <div>
            <strong>{b.name}</strong>
            <div style={{ fontSize: 12, color: "#7c7a9c" }}>
              {b.businessType === "restaurant" ? "Restaurante" : "Tienda"}
              {b.businessSubtype ? ` · ${b.businessSubtype}` : ""}
              {b.slug ? ` · /t/${b.slug}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Dueño",
        key: "user",
        render: (_, b) =>
          b.user ? (
            <div>
              <div>{b.user.name}</div>
              <div style={{ fontSize: 12, color: "#7c7a9c" }}>{b.user.email}</div>
            </div>
          ) : (
            <Tag>Sin asignar</Tag>
          ),
      },
      {
        title: "Suscripción",
        key: "subscription",
        width: 220,
        render: (_, b) => {
          const e = estado(b);
          const dias = b.subscriptionDaysLeft;
          const fin = e === "trial" ? b.trialEndsAt : b.paidUntil;
          return (
            <div>
              {e === "trial" && <Tag color="blue">En prueba</Tag>}
              {e === "active" && <Tag color="green">Activo{b.plan ? ` · ${b.plan}` : ""}</Tag>}
              {e === "expired" && <Tag color="red">Vencido</Tag>}
              <div
                style={{
                  fontSize: 12,
                  color: e === "expired" || porVencer(b) ? "#c0263a" : "#7c7a9c",
                }}
              >
                {e === "expired"
                  ? fin
                    ? `Venció el ${dayjs(fin).format("DD/MM/YYYY")}`
                    : "Suspendido"
                  : fin
                    ? `Vence ${dayjs(fin).format("DD/MM/YYYY")} (${Math.max(dias ?? 0, 0)} d)`
                    : "Sin vencimiento"}
              </div>
            </div>
          );
        },
      },
      {
        title: "Acciones",
        key: "actions",
        width: 300,
        render: (_: any, row) => (
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setPlanTarget(row);
                setPlanNombre(row.plan || "Mensual");
                setPlanMeses(1);
              }}
            >
              Activar plan
            </Button>
            {row.whatsappPhone && (
              <Button
                size="small"
                href={`https://wa.me/${row.whatsappPhone}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </Button>
            )}
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "extend", label: "Regalar +7 días de prueba" },
                  { key: "expire", label: "Suspender ahora", danger: true },
                  { type: "divider" },
                  { key: "clone", label: "Copiar catálogo" },
                  { key: "edit", label: "Editar" },
                  { key: "delete", label: "Eliminar", danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === "extend")
                    operar(row, { action: "extend", days: 7 }, "Se agregaron 7 días de prueba");
                  else if (key === "expire")
                    Modal.confirm({
                      title: `¿Suspender «${row.name}»?`,
                      content: "Su panel quedará en solo lectura y su tienda dejará de recibir pedidos.",
                      okText: "Suspender",
                      cancelText: "Cancelar",
                      okButtonProps: { danger: true },
                      onOk: () => operar(row, { action: "expire" }, "Negocio suspendido"),
                    });
                  else if (key === "clone") openClone(row);
                  else if (key === "edit") openEdit(row);
                  else if (key === "delete")
                    Modal.confirm({
                      title: `¿Eliminar «${row.name}»?`,
                      content: "Se borran sus productos, categorías e imágenes. No se puede deshacer.",
                      okText: "Eliminar",
                      cancelText: "Cancelar",
                      okButtonProps: { danger: true },
                      onOk: () => handleDelete(row),
                    });
                },
              }}
            >
              <Button size="small">Más</Button>
            </Dropdown>
          </Space>
        ),
      },
    ],
    [data]
  );

  const tarjetas: { k: typeof filtro; t: string; n: number; color: string }[] = [
    { k: "todos", t: "Negocios", n: conteo.total, color: "#151243" },
    { k: "trial", t: "En prueba", n: conteo.trial, color: "#1d4ed8" },
    { k: "active", t: "Activos (pagando)", n: conteo.active, color: "#12805c" },
    { k: "porvencer", t: "Vencen en ≤ 2 días", n: conteo.porvencer, color: "#9a6206" },
    { k: "expired", t: "Vencidos", n: conteo.expired, color: "#c0263a" },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {tarjetas.map((c) => (
          <button
            key={c.k}
            type="button"
            onClick={() => setFiltro(c.k)}
            style={{
              textAlign: "left",
              background: "#fff",
              borderRadius: 14,
              padding: "14px 16px",
              cursor: "pointer",
              border: `1px solid ${filtro === c.k ? c.color : "#e6e6f2"}`,
            }}
          >
            <div style={{ fontSize: 12, color: "#7c7a9c" }}>{c.t}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.n}</div>
          </button>
        ))}
      </div>

    <Card
      title="Negocios y suscripciones"
      extra={
        <Space wrap>
          <Segmented
            value={filtro}
            onChange={(v) => setFiltro(v as typeof filtro)}
            options={[
              { label: "Todos", value: "todos" },
              { label: "En prueba", value: "trial" },
              { label: "Activos", value: "active" },
              { label: "Vencidos", value: "expired" },
            ]}
          />
          <Input.Search
            allowClear
            placeholder="Negocio, dueño, correo o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Button onClick={() => fetchList()}>Refrescar</Button>
          <Button onClick={openCreate}>Nuevo</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filtrados}
        columns={columns}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total: filtrados.length,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        open={!!planTarget}
        title={`Activar plan · ${planTarget?.name ?? ""}`}
        okText="Activar"
        cancelText="Cancelar"
        okButtonProps={{ loading: savingPlan }}
        onOk={confirmarPlan}
        onCancel={() => setPlanTarget(null)}
      >
        <p>
          Registra el pago que cobraste. Si el plan sigue vigente, los meses se suman al
          vencimiento actual; si ya venció, cuentan desde hoy.
        </p>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            addonBefore="Plan"
            value={planNombre}
            onChange={(e) => setPlanNombre(e.target.value)}
            placeholder="Mensual, Anual…"
          />
          <InputNumber
            addonBefore="Meses"
            min={1}
            max={36}
            value={planMeses}
            onChange={(v) => setPlanMeses(Number(v) || 1)}
            style={{ width: "100%" }}
          />
        </Space>
      </Modal>

      <Modal
        open={!!cloneTarget}
        title={`Copiar catálogo a «${cloneTarget?.name ?? ""}»`}
        okText="Copiar"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !cloneSource, loading: cloning }}
        onOk={handleClone}
        onCancel={() => setCloneTarget(null)}
      >
        <p>
          Copia categorías, productos, insumos, recetas y modificadores del negocio
          molde. No copia imágenes ni stock. Solo funciona si este negocio está
          vacío.
        </p>
        <Select
          style={{ width: "100%" }}
          showSearch
          optionFilterProp="label"
          placeholder="Negocio molde"
          value={cloneSource}
          onChange={setCloneSource}
          options={moldes
            .filter((b) => b.id !== cloneTarget?.id)
            .map((b) => ({ value: b.id, label: `${b.name} (#${b.id})` }))}
        />
      </Modal>

      <BusinessFormModal
        open={openModal}
        loading={saving}
        initialValues={editing ?? undefined}
        onCancel={() => setOpenModal(false)}
        onSubmit={handleSubmit}
      />
    </Card>
    </>
  );
}
