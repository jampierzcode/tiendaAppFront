import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  Tag,
  message,
  Popconfirm,
  Dropdown,
  type MenuProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { useBusiness } from "../../context/BusinessContext";
import ProductFormModal from "../../components/admin/ProductFormModal";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import ProductVariationsModal from "../../components/admin/ProductVariationsModal";

interface VariationAttribute {
  id: number;
  name: string;
  value: string;
}

interface Variation {
  id: number;
  sku: string;
  price: number;
  stock: number;
  attributes: VariationAttribute[];
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: string;
  business_image_id?: number;
  image_url?: string;
  variations?: Variation[];
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
}

export default function ProductsPage(): React.ReactElement {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, perPage: 10 });
  const [search, setSearch] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [openVariationsModal, setOpenVariationsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editData, setEditData] = useState<Product | null>(null);
  const { business } = useBusiness();

  const fetchProducts = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const res = await apiTienda("/products", {
        params: { page, perPage: pageSize, search },
      });
      const list: Product[] = res.data.data ?? res.data;
      const metaRes = res.data.meta ?? {
        total: list.length,
        page,
        perPage: pageSize,
      };
      setData(list);
      setMeta({
        total: Number(metaRes.total ?? list.length),
        page: Number(metaRes.page ?? page),
        perPage: Number(metaRes.perPage ?? pageSize),
      });
    } catch (err) {
      console.error(err);
      message.error("Error al cargar los productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (business) fetchProducts();
  }, [business, page, pageSize]);

  const handleDelete = async (row: Product) => {
    try {
      await apiTienda.delete(`/products/${row.id}`, {});
      message.success("Producto eliminado correctamente");
      if (data.length === 1 && page > 1) setPage(page - 1);
      else fetchProducts();
    } catch (err) {
      console.error(err);
      message.error("No se pudo eliminar el producto");
    }
  };

  const handleEdit = (row: Product) => {
    setEditData(row);
    setOpenModal(true);
  };

  const handleCreate = () => {
    setEditData(null);
    setOpenModal(true);
  };

  const handleVariations = (product: Product) => {
    setSelectedProduct(product);
    setOpenVariationsModal(true);
  };

  const columns: ColumnsType<Product> = useMemo(
    () => [
      {
        title: "Imagen",
        dataIndex: ["businessImages", "url"],
        key: "image_url",
        render: (url) =>
          url ? (
            <img
              src={url}
              alt="producto"
              style={{
                width: 60,
                height: 60,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #eee",
              }}
            />
          ) : (
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 8,
                background: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              —
            </div>
          ),
      },
      {
        title: "Nombre",
        dataIndex: "name",
        key: "name",
        render: (text: string) => <strong>{text}</strong>,
      },
      {
        title: "Descripción",
        dataIndex: "description",
        key: "description",
        ellipsis: true,
      },
      {
        title: "Precio",
        dataIndex: "price",
        key: "price",
        render: (v: number) => `S/ ${Number(v).toFixed(2)}`,
      },
      {
        title: "Stock",
        dataIndex: "stock",
        key: "stock",
        render: (v: number) => <Tag color={v > 0 ? "green" : "red"}>{v}</Tag>,
      },
      {
        title: "Variaciones",
        key: "variations",
        render: (_, row) => (
          <Tag
            color={
              row.variations && row.variations.length > 0 ? "blue" : "default"
            }
          >
            {row.variations?.length ?? 0}
          </Tag>
        ),
      },
      {
        title: "Estado",
        dataIndex: "status",
        key: "status",
        render: (v) =>
          v === "inactivo" ? (
            <Tag color="red">Inactivo</Tag>
          ) : (
            <Tag color="green">Activo</Tag>
          ),
      },
      {
        title: "Acciones",
        key: "actions",
        render: (_, row) => {
          const items: MenuProps["items"] = [
            {
              key: "edit",
              label: (
                <button
                  className="w-full text-left px-3 py-1 hover:bg-gray-100 rounded"
                  onClick={() => handleEdit(row)}
                >
                  ✏️ Editar
                </button>
              ),
            },
            {
              key: "variations",
              label: (
                <button
                  className="w-full text-left px-3 py-1 hover:bg-gray-100 rounded"
                  onClick={() => handleVariations(row)}
                >
                  🧩 Variaciones
                </button>
              ),
            },
            {
              key: "delete",
              label: (
                <Popconfirm
                  title="¿Eliminar producto?"
                  okText="Sí"
                  cancelText="No"
                  onConfirm={() => handleDelete(row)}
                >
                  <button className="w-full text-left px-3 py-1 hover:bg-red-50 text-red-600 rounded">
                    🗑️ Eliminar
                  </button>
                </Popconfirm>
              ),
            },
          ];

          return (
            <Dropdown
              menu={{ items }}
              placement="bottomRight"
              trigger={["click"]}
              overlayClassName="rounded-lg shadow-lg"
            >
              <Button
                type="text"
                icon={<HiOutlineDotsVertical size={18} />}
                className="hover:bg-gray-100"
              />
            </Dropdown>
          );
        },
      },
    ],
    [data]
  );

  return (
    <>
      <PageHeader
        titulo="Productos"
        descripcion="Tu catálogo. Cada producto puede tener varias tallas y colores, cada una con su propio stock."
        acciones={
          <Space wrap>
            <Input.Search
              placeholder="Buscar producto…"
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => {
                setPage(1);
                fetchProducts();
              }}
              style={{ width: 280 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchProducts()}
              disabled={loading}
            >
              Refrescar
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              disabled={!business}
            >
              Nuevo producto
            </Button>
          </Space>
        }
      />

      <div className="card overflow-hidden">
      <Table
        className="w-full"
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
      </div>

      {openModal && (
        <ProductFormModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          onSuccess={fetchProducts}
          editData={editData ?? undefined}
        />
      )}

      {openVariationsModal && selectedProduct && (
        <ProductVariationsModal
          open={openVariationsModal}
          onClose={() => setOpenVariationsModal(false)}
          product={selectedProduct}
          refresh={fetchProducts}
        />
      )}
    </>
  );
}
