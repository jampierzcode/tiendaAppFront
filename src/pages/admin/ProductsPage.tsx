import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  Tag,
  message,
  Modal,
  Dropdown,
  Select,
  type MenuProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  TbColorSwatch,
  TbDotsVertical,
  TbEye,
  TbEyeOff,
  TbPencil,
  TbTrash,
} from "react-icons/tb";
import { useBusiness, useEsRestaurante } from "../../context/BusinessContext";
import RecipeModal from "../../components/admin/RecipeModal";
import { TbChefHat } from "react-icons/tb";
import ProductFormModal from "../../components/admin/ProductFormModal";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import ProductVariationsModal from "../../components/admin/ProductVariationsModal";
import SelectorOrden, { type Orden } from "../../components/ui/SelectorOrden";
import { moverElemento, useFilasArrastrables } from "../../hooks/useFilasArrastrables";

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
  sku?: string | null;
  categoryLinks?: {
    categoryId: number;
    subcategoryId: number | null;
    category?: { name: string };
    subcategory?: { name: string } | null;
  }[];
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
  // Filtros por categoría y subcategoría.
  const [categorias, setCategorias] = useState<
    { id: number; name: string; subcategories?: { id: number; name: string }[] }[]
  >([]);
  const [categoriaId, setCategoriaId] = useState<number | "none" | undefined>();
  const [subcategoriaId, setSubcategoriaId] = useState<number | undefined>();
  // Restaurante: manual (arrastrando) por defecto. Tienda: lo más reciente primero.
  const [orden, setOrden] = useState<Orden>("manual");

  const [openModal, setOpenModal] = useState(false);
  const [openVariationsModal, setOpenVariationsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editData, setEditData] = useState<Product | null>(null);
  const { business } = useBusiness();
  const esRestaurante = useEsRestaurante();

  // Recetas (solo restaurante): costo por plato para mostrar margen en la lista.
  const [recetas, setRecetas] = useState<Record<number, { cost: number; linesCount: number }>>({});
  const [recetaDe, setRecetaDe] = useState<Product | null>(null);

  const cargarRecetas = async () => {
    if (!esRestaurante) return;
    try {
      const r = await apiTienda.get("/recipes");
      const mapa: Record<number, { cost: number; linesCount: number }> = {};
      for (const x of r.data.data ?? []) mapa[x.productId] = { cost: x.cost, linesCount: x.linesCount };
      setRecetas(mapa);
    } catch {
      // sin recetas la lista igual funciona
    }
  };

  useEffect(() => {
    cargarRecetas();
  }, [esRestaurante]);

  const fetchProducts = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const res = await apiTienda("/products", {
        params: {
          page: esRestaurante ? 1 : page,
          perPage: esRestaurante ? 100 : pageSize,
          search,
          categoryId: categoriaId,
          subcategoryId: subcategoriaId,
          sort: orden === "asc" ? "name_asc" : orden === "desc" ? "name_desc" : esRestaurante ? "manual" : undefined,
        },
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
  }, [business, page, pageSize, categoriaId, subcategoriaId, orden, esRestaurante]);

  useEffect(() => {
    if (!business) return;
    apiTienda
      .get("/categories")
      .then((r) => setCategorias(r.data.data ?? []))
      .catch(() => undefined);
  }, [business]);

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

  /**
   * Desactivar no borra: el producto sale de la tienda pública y del buscador
   * de caja, pero conserva su historial de ventas y su stock. Es lo que se
   * quiere cuando algo se agota por temporada y volverá.
   */
  const cambiarEstado = async (row: Product) => {
    const nuevo = row.status === "activo" ? "inactivo" : "activo";
    try {
      await apiTienda.put(`/products/${row.id}`, { status: nuevo });
      message.success(
        nuevo === "activo"
          ? `"${row.name}" vuelve a estar visible en la tienda`
          : `"${row.name}" ya no aparece en la tienda ni en la caja`
      );
      fetchProducts();
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ?? "No se pudo cambiar el estado"
      );
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
      ...(esRestaurante
        ? []
        : [
            {
              title: "SKU",
              dataIndex: "sku",
              key: "sku",
              width: 130,
              render: (v: string | null) => v ?? "—",
            },
          ]),
      {
        title: "Categorías",
        key: "categories",
        render: (_, row) =>
          row.categoryLinks?.length ? (
            <Space size={[4, 4]} wrap>
              {row.categoryLinks.map((l, i) => (
                <Tag key={i}>
                  {l.subcategory?.name
                    ? `${l.category?.name} › ${l.subcategory.name}`
                    : l.category?.name}
                </Tag>
              ))}
            </Space>
          ) : (
            <Tag color="orange">Sin categoría</Tag>
          ),
      },
      {
        title: "Precio",
        dataIndex: "price",
        key: "price",
        render: (v: number) =>
          Number(v) > 0 ? (
            `S/ ${Number(v).toFixed(2)}`
          ) : (
            <Tag color="orange">Sin precio</Tag>
          ),
      },
      ...(esRestaurante
        ? [
            {
              title: "Costo",
              key: "cost",
              render: (_: unknown, row: Product) => {
                const r = recetas[row.id];
                return r && r.linesCount > 0 ? (
                  `S/ ${Number(r.cost).toFixed(2)}`
                ) : (
                  <Tag color="orange">Sin receta</Tag>
                );
              },
            },
            {
              title: "Margen",
              key: "margin",
              render: (_: unknown, row: Product) => {
                const r = recetas[row.id];
                if (!r || r.linesCount === 0 || Number(row.price) <= 0) return "—";
                const m = Number(row.price) - r.cost;
                const pct = (m / Number(row.price)) * 100;
                return (
                  <span style={{ color: m < 0 ? "#c0263a" : "#12805c", fontWeight: 600 }}>
                    S/ {m.toFixed(2)} ({pct.toFixed(0)}%)
                  </span>
                );
              },
            },
          ]
        : [
            {
              title: "Stock",
              dataIndex: "stock",
              key: "stock",
              render: (v: number) => <Tag color={v > 0 ? "green" : "red"}>{v}</Tag>,
            },
            {
              title: "Variaciones",
              key: "variations",
              render: (_: unknown, row: Product) => (
                <Tag
                  color={
                    row.variations && row.variations.length > 0 ? "blue" : "default"
                  }
                >
                  {row.variations?.length ?? 0}
                </Tag>
              ),
            },
          ]),
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
          // Los items van con la API de Antd (icon + label + danger) en vez de
          // botones metidos dentro de la etiqueta: así heredan el tema del
          // panel, el foco por teclado y el rojo de "peligro" sin pintarlo a
          // mano. Los iconos son Tabler, que es el juego que usa el resto.
          const items: MenuProps["items"] = [
            {
              key: "edit",
              icon: <TbPencil size={16} />,
              label: "Editar",
              onClick: () => handleEdit(row),
            },
            esRestaurante
              ? {
                  key: "recipe",
                  icon: <TbChefHat size={16} />,
                  label: "Receta e insumos",
                  onClick: () => setRecetaDe(row),
                }
              : {
                  key: "variations",
                  icon: <TbColorSwatch size={16} />,
                  label: "Variaciones",
                  onClick: () => handleVariations(row),
                },
            {
              key: "status",
              icon:
                row.status === "activo" ? <TbEyeOff size={16} /> : <TbEye size={16} />,
              label: row.status === "activo" ? "Desactivar" : "Activar",
              onClick: () => cambiarEstado(row),
            },
            { type: "divider" },
            {
              key: "delete",
              icon: <TbTrash size={16} />,
              label: "Eliminar",
              danger: true,
              onClick: () =>
                Modal.confirm({
                  title: "¿Eliminar producto?",
                  content: `Se eliminará "${row.name}" con sus variaciones. No se puede deshacer.`,
                  okText: "Eliminar",
                  cancelText: "Cancelar",
                  okButtonProps: { danger: true },
                  onOk: () => handleDelete(row),
                }),
            },
          ];

          return (
            <Dropdown menu={{ items }} placement="bottomRight" trigger={["click"]}>
              <Button type="text" icon={<TbDotsVertical size={18} />} />
            </Dropdown>
          );
        },
      },
    ],
    [data, esRestaurante, recetas]
  );

  // Restaurante: la carta se arma por categorías. Cada categoría es una
  // sección con su cabecera; un plato en dos categorías aparece en ambas.
  const filasAgrupadas = useMemo(() => {
    const grupos = new Map<string, Product[]>();
    for (const p of data) {
      const nombres = p.categoryLinks?.length
        ? [...new Set(p.categoryLinks.map((l) => l.category?.name ?? "Sin categoría"))]
        : ["Sin categoría"];
      for (const n of nombres) grupos.set(n, [...(grupos.get(n) ?? []), p]);
    }
    // Categorías: en el orden manual del panel de categorías, o alfabético.
    const posicion = new Map(categorias.map((c, i) => [c.name, i]));
    const nombres = [...grupos.keys()].sort((a, b) => {
      if (a === "Sin categoría") return 1;
      if (b === "Sin categoría") return -1;
      if (orden === "manual") return (posicion.get(a) ?? 9999) - (posicion.get(b) ?? 9999);
      return orden === "asc" ? a.localeCompare(b, "es") : b.localeCompare(a, "es");
    });
    return nombres.flatMap((cat) => {
      // `data` ya llega ordenado por el servidor (manual o alfabético).
      const platos = grupos.get(cat)!;
      return [
        { id: `g-${cat}`, __key: `g-${cat}`, __grupo: cat, __total: platos.length } as any,
        ...platos.map((p) => ({ ...p, __key: `${cat}-${p.id}`, __cat: cat, __pid: p.id })),
      ];
    });
  }, [data, categorias, orden]);

  // Arrastrar platos dentro de su categoría (solo en orden manual).
  const filasPlatos = useFilasArrastrables<any>({
    habilitado: esRestaurante && orden === "manual" && !search && !categoriaId && !subcategoriaId,
    grupoDe: (f) => (f.__grupo ? "__cabecera" : f.__cat),
    onSoltar: async (desde, hacia) => {
      // Cabeceras: se reordenan las categorías mismas.
      if (String(desde).startsWith("g-")) {
        const de = String(desde).slice(2);
        const a = String(hacia).slice(2);
        const i = categorias.findIndex((c) => c.name === de);
        const j = categorias.findIndex((c) => c.name === a);
        if (i < 0 || j < 0) return;
        const nuevo = moverElemento(categorias, i, j);
        setCategorias(nuevo);
        try {
          await apiTienda.put("/categories/reorder", { ids: nuevo.map((c) => c.id) });
        } catch {
          message.error("No se pudo guardar el orden");
        }
        return;
      }
      const a = filasAgrupadas.find((f: any) => f.__key === desde);
      const b = filasAgrupadas.find((f: any) => f.__key === hacia);
      if (!a || !b || a.__cat !== b.__cat) return;
      const ids = filasAgrupadas.filter((f: any) => f.__cat === a.__cat).map((f: any) => f.__pid as number);
      const nuevo = moverElemento(ids, ids.indexOf(a.__pid), ids.indexOf(b.__pid));
      // Se refleja ya en la lista: los platos de la categoría ocupan los mismos huecos.
      const huecos = data.map((p, i) => (ids.includes(p.id) ? i : -1)).filter((i) => i >= 0);
      const copia = [...data];
      nuevo.forEach((pid, k) => {
        copia[huecos[k]] = data.find((p) => p.id === pid)!;
      });
      setData(copia);
      try {
        await apiTienda.put("/products/reorder", { ids: nuevo });
      } catch {
        message.error("No se pudo guardar el orden");
        fetchProducts();
      }
    },
  });

  const columnasAgrupadas = useMemo(
    () =>
      columns.map((c: any, i: number) => ({
        ...c,
        onCell: (row: any) => (row.__grupo ? { colSpan: i === 0 ? columns.length : 0 } : {}),
        render: (v: any, row: any, idx: number) =>
          row.__grupo ? (
            i === 0 ? (
              <div className="py-1 text-[13px] font-extrabold uppercase tracking-wide text-brand-700">
                {row.__grupo}{" "}
                <span className="font-semibold normal-case text-muted">
                  · {row.__total} {row.__total === 1 ? "plato" : "platos"}
                </span>
              </div>
            ) : null
          ) : c.render ? (
            c.render(v, row, idx)
          ) : (
            v
          ),
      })),
    [columns]
  );

  return (
    <>
      <PageHeader
        titulo={esRestaurante ? "Platos" : "Productos"}
        descripcion={
          esRestaurante
            ? "Tu carta. Cada plato lleva una receta de insumos: al confirmar un pedido se descuenta el inventario."
            : "Tu catálogo. Cada producto puede tener varias tallas y colores, cada una con su propio stock."
        }
        acciones={
          <Space wrap>
            <SelectorOrden
              value={orden}
              onChange={(o) => {
                setOrden(o);
                setPage(1);
              }}
              manualLabel={esRestaurante ? "Manual" : "Recientes"}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Categoría"
              style={{ width: 180 }}
              value={categoriaId}
              onChange={(v) => {
                setCategoriaId(v);
                setSubcategoriaId(undefined);
                setPage(1);
              }}
              options={[
                ...categorias.map((c) => ({ value: c.id as number | "none", label: c.name })),
                { value: "none" as const, label: "Sin categoría" },
              ]}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Subcategoría"
              style={{ width: 180 }}
              disabled={typeof categoriaId !== "number"}
              value={subcategoriaId}
              onChange={(v) => {
                setSubcategoriaId(v);
                setPage(1);
              }}
              options={(categorias.find((c) => c.id === categoriaId)?.subcategories ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
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
              {esRestaurante ? "Nuevo plato" : "Nuevo producto"}
            </Button>
          </Space>
        }
      />

      <div className="card overflow-hidden">
      <Table
        className="w-full"
        rowKey={(r: any) => r.__key ?? r.id}
        rowClassName={(r: any) => (r.__grupo ? "bg-brand-50" : "")}
        onRow={
          esRestaurante
            ? (r: any) =>
                r.__grupo && r.__grupo === "Sin categoría"
                  ? {}
                  : filasPlatos.onRow({ ...r, id: r.__key })
            : undefined
        }
        loading={loading}
        dataSource={esRestaurante ? filasAgrupadas : data}
        columns={esRestaurante ? columnasAgrupadas : columns}
        pagination={esRestaurante ? false : {
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
          onSuccess={(abrirVariaciones, creado) => {
            fetchProducts();
            // Plato recién creado: lo siguiente es su receta.
            if (esRestaurante && creado) {
              setRecetaDe(creado);
              return;
            }
            if (abrirVariaciones) {
              setSelectedProduct(abrirVariaciones);
              setOpenVariationsModal(true);
            }
          }}
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
      <RecipeModal
        open={recetaDe !== null}
        producto={recetaDe ? { id: recetaDe.id, name: recetaDe.name, price: Number(recetaDe.price) } : null}
        onClose={() => setRecetaDe(null)}
        onSaved={cargarRecetas}
      />
    </>
  );
}
