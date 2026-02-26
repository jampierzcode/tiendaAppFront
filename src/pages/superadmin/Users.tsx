import { Button, Card, Input, message, Space, Table, Tag } from "antd";
import { UserFormModal } from "../../components/superAdmin/UserFormModal";
import { useEffect, useMemo, useState } from "react";
import type { Business, PageMeta, Role, User } from "../../types/main";
import { apiTienda } from "../../api/apiTienda";
import type { AxiosError } from "axios";
import type { ColumnsType } from "antd/es/table";
import { fmtDate } from "../../utilities/convertString";

export function UsersPage(): React.ReactElement {
  const [data, setData] = useState<User[]>([]);
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
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const [roleOptions, setRoleOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [businessOptions, setBusinessOptions] = useState<
    { value: number; label: string }[]
  >([]);

  const fetchRoles = async () => {
    try {
      const res = await apiTienda.get("/roles");
      const list: Role[] = res.data.data ?? res.data;
      setRoleOptions(
        list.map((r) => ({ value: r.code, label: r.name ?? r.code }))
      );
    } catch (e) {
      console.error(e);
      message.error("No se pudieron cargar roles");
    }
  };

  const fetchBusinesses = async () => {
    try {
      const res = await apiTienda.get("/businesses", {
        params: { perPage: 1000 },
      });
      const list: Business[] = res.data.data ?? res.data;
      setBusinessOptions(list.map((b) => ({ value: b.id, label: b.name })));
    } catch (e) {
      console.error(e);
      message.error("No se pudieron cargar businesses");
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await apiTienda.get("/users", {
        params: { page, perPage: pageSize, search },
      });
      const raw: User[] = res.data.data ?? res.data;
      const m = res.data.meta ?? { total: raw.length, page, perPage: pageSize };
      setData(
        raw.map((u) => ({ ...u, created_at: u.createdAt ?? u["createdAt"] }))
      );
      setMeta({
        total: Number(m.total ?? raw.length),
        page: Number(m.page ?? page),
        perPage: Number(m.perPage ?? pageSize),
      });
    } catch (e) {
      console.error(e);
      message.error("No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [page, pageSize]);
  useEffect(() => {
    fetchRoles();
    fetchBusinesses();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setOpenModal(true);
  };
  const openEdit = (row: User) => {
    setEditing(row);
    setOpenModal(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      setSaving(true);
      const payload = {
        full_name: values.fullName ?? values.name,
        email: values.email,
        role_code: values.roleCode,
        status: values.status,
        restaurant_id: values.businessId ?? undefined,
        password: values.password ?? undefined,
      };
      if (editing) {
        await apiTienda.put(`/users/${editing.id}`, payload);
        message.success("Usuario actualizado");
      } else {
        await apiTienda.post("/users", payload);
        message.success("Usuario creado");
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

  const handleDelete = async (row: User) => {
    try {
      await apiTienda.delete(`/users/${row.id}`);
      message.success("Usuario eliminado");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchList();
    } catch (e) {
      console.error(e);
      message.error("No se pudo eliminar");
    }
  };

  const columns: ColumnsType<User> = useMemo(
    () => [
      {
        title: "Nombre",
        dataIndex: "name",
        key: "name",
        render: (v) => <strong>{v}</strong>,
      },
      { title: "Email", dataIndex: "email", key: "email" },
      {
        title: "Rol",
        key: "role",
        render: (_: any, row) => (
          <Tag>{row.role?.name ?? row["name"] ?? "—"}</Tag>
        ),
      },
      {
        title: "Business",
        key: "business",
        render: (_: any, row) => row.business?.name ?? "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v) =>
          v === "inactivo" ? (
            <Tag color="red">inactivo</Tag>
          ) : (
            <Tag color="green">{v ?? "activo"}</Tag>
          ),
      },
      {
        title: "Creado",
        dataIndex: "created_at",
        key: "created_at",
        render: (v) => fmtDate(v),
      },
      {
        title: "Acciones",
        key: "actions",
        render: (_: any, row) => (
          <Space>
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
      title="Usuarios"
      extra={
        <Space>
          <Input.Search
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={() => {
              setPage(1);
              fetchList();
            }}
            style={{ width: 300 }}
          />
          <Button onClick={() => fetchList()}>Refrescar</Button>
          <Button type="primary" onClick={openCreate}>
            Nuevo usuario
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

      <UserFormModal
        open={openModal}
        loading={saving}
        initialValues={editing ?? undefined}
        roleOptions={roleOptions}
        businessOptions={businessOptions}
        onCancel={() => setOpenModal(false)}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
