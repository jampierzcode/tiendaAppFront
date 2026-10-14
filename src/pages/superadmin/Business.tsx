import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { Business, PageMeta } from "../../types/main";
import { apiTienda } from "../../api/apiTienda";
import { Button, Card, Input, Modal, message, Select, Space, Table, Tag } from "antd";
import type { AxiosError } from "axios";
import type { ColumnsType } from "antd/es/table";
import { BusinessFormModal } from "../../components/superAdmin/BusinessFormModal";

export function BusinessesPage(): React.ReactElement {
  const [data, setData] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PageMeta>({
    total: 0,
    page: 1,
    perPage: 10,
  });
  const [search, setSearch] = useState("");

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
      const m = res.data.meta ?? {
        total: list.length,
        page,
        perPage: pageSize,
      };
      setData(list);
      setMeta({
        total: Number(m.total ?? list.length),
        page: Number(m.page ?? page),
        perPage: Number(m.perPage ?? pageSize),
      });
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

  const columns: ColumnsType<Business> = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id", width: 60 },
      {
        title: "Nombre",
        dataIndex: "name",
        key: "name",
        render: (v) => <strong>{v}</strong>,
      },
      { title: "Descripción", dataIndex: "description", key: "description" },
      {
        title: "Usuario",
        dataIndex: "user",
        key: "user",
        render: (user) =>
          user ? (
            <span>{user.name}</span>
          ) : (
            <Tag color="default">Sin asignar</Tag>
          ),
      },

      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (v) =>
          v === "inactivo" ? (
            <Tag color="red">inactivo</Tag>
          ) : (
            <Tag color="green">{v ?? "activo"}</Tag>
          ),
      },
      {
        title: "Acciones",
        key: "actions",
        width: 330,
        render: (_: any, row) => (
          <Space>
            <Button size="small" onClick={() => openClone(row)}>
              Copiar catálogo
            </Button>
            <Button size="small" onClick={() => openEdit(row)}>
              Editar
            </Button>
            <Button size="small" danger onClick={() => handleDelete(row)}>
              Eliminar
            </Button>
          </Space>
        ),
      },
    ],
    [data]
  );

  return (
    <Card
      title="Businesses"
      extra={
        <Space>
          <Input.Search
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={() => {
              setPage(1);
              fetchList();
            }}
            style={{ width: 280 }}
          />
          <Button onClick={() => fetchList()}>Refrescar</Button>
          <Button type="primary" onClick={openCreate}>
            Nuevo
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total: meta.total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

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
  );
}
