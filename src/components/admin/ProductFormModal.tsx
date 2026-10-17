import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Switch,
  Collapse,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import GalleryModal from "./GalleryModal";
import SkuField from "./SkuField";
import MovementModal from "./MovementModal";
import CostoReferencia from "./CostoReferencia";
import VariationGenerator, { claveCombo, type ComboNueva } from "./VariationGenerator";
import { PlusOutlined } from "@ant-design/icons";
import { apiTienda } from "../../api/apiTienda";
import { useBusiness, useEsRestaurante } from "../../context/BusinessContext";
import { impuestoDe } from "../../utilities/paises";

const { Text } = Typography;

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * `abrirVariaciones` viene con el producto cuando el usuario guardó con
   * "Tiene variaciones" encendido y todavía no tiene ninguna: el panel abre
   * el editor de variaciones sin que tenga que buscar el botón.
   */
  onSuccess: (abrirVariaciones?: any, creado?: any) => void;
  editData?: any; // producto si se está editando
  /** Abre el editor de las variaciones que ya existen (precio, SKU, foto…). */
  onEditarVariaciones?: (producto: any) => void;
}

type CategoryNode = {
  id: number;
  name: string;
  subcategories?: { id: number; name: string }[];
};
type TagItem = { id: number; name: string; color?: string | null };

/** Clave de una categoría (o de categoría › subcategoría) dentro del Select. */
const keyOf = (categoryId: number, subcategoryId?: number | null) =>
  subcategoryId ? `c${categoryId}:${subcategoryId}` : `c${categoryId}`;

const parseKey = (key: string) => {
  const [cat, sub] = key.slice(1).split(":");
  return { categoryId: Number(cat), subcategoryId: sub ? Number(sub) : null };
};

/**
 * Un producto "tiene variaciones" cuando alguna lleva atributos (marca,
 * color, medida…) o hay más de una. Un producto simple es una sola variación
 * oculta que el usuario nunca ve: su SKU, precio y stock se editan aquí.
 */
export const productoTieneVariaciones = (p: any) =>
  Boolean(
    p?.variations &&
      (p.variations.length > 1 ||
        p.variations.some((v: any) => v.attributes?.length > 0))
  );

const etiquetaVariacion = (v: any) =>
  v.attributes?.length
    ? v.attributes
        .map((a: any) => a.value?.value)
        .filter(Boolean)
        .join(" · ")
    : "Única";

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  editData,
  onEditarVariaciones,
}) => {
  const [form] = Form.useForm();
  const esRestaurante = useEsRestaurante();
  const { business } = useBusiness();
  const impuesto = impuestoDe((business as any)?.country);
  const [loading, setLoading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    id: number;
    url: string;
  } | null>(null);

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [hasVariations, setHasVariations] = useState(false);

  // Movimiento de stock del producto simple (queda en el kardex).
  const [movOpen, setMovOpen] = useState(false);
  const [stockActual, setStockActual] = useState(0);
  const [combos, setCombos] = useState<ComboNueva[]>([]);
  const [decisionPrecio, setDecisionPrecio] = useState<null | {
    valores: any;
    datos: {
      precioAnterior: number;
      precioNuevo: number;
      total: number;
      variaciones: { id: number; label: string; precio: number }[];
    };
  }>(null);
  const nombreWatch = Form.useWatch("name", form) as string | undefined;
  const skuWatch = Form.useWatch("sku", form) as string | undefined;
  const costoWatch = Form.useWatch("cost", form) as number | undefined;
  const precioWatch = Form.useWatch("price", form) as number | undefined;

  const variacionPorDefecto = useMemo(
    () => editData?.variations?.find((v: any) => v.isDefault),
    [editData]
  );
  const yaTieneVariaciones = productoTieneVariaciones(editData);
  // Las variaciones reales (la oculta del producto simple no cuenta).
  const variacionesReales = (editData?.variations ?? []).filter((v: any) => !v.isDefault);
  const clavesExistentes = variacionesReales.map((v: any) =>
    claveCombo((v.attributes ?? []).map((a: any) => a.attributeValueId ?? a.value?.id).filter(Boolean))
  );

  useEffect(() => {
    if (!open) return;
    Promise.all([apiTienda.get("/categories"), apiTienda.get("/tags")])
      .then(([c, t]) => {
        setCategories(c.data.data ?? []);
        setTags(t.data.data ?? []);
      })
      .catch(() => message.error("No se pudieron cargar categorías y etiquetas"));
  }, [open]);

  useEffect(() => {
    if (editData) {
      form.setFieldsValue({
        name: editData.name,
        description: editData.description,
        price: Number(editData.price),
        cost: editData.cost != null ? Number(editData.cost) : undefined,
        sku: editData.sku,
        taxRate: Number(editData.taxRate ?? 18),
        lowStockThreshold: editData.lowStockThreshold ?? 5,
        active: editData.status !== "inactivo",
        categoryKeys: (editData.categoryLinks ?? []).map((l: any) =>
          keyOf(l.categoryId, l.subcategoryId)
        ),
        tagIds: (editData.tags ?? []).map((t: any) => t.id),
      });
      setHasVariations(productoTieneVariaciones(editData));
      setStockActual(Number(variacionPorDefecto?.stock ?? editData.stock ?? 0));
      if (editData.businessImages) {
        setSelectedImage({
          id: editData.businessImageId,
          url: editData.businessImages.url,
        });
      } else {
        setSelectedImage(null);
      }
    } else {
      form.resetFields();
      form.setFieldsValue({
        active: true,
        taxRate: 18,
        lowStockThreshold: 5,
        stock: 0,
      });
      setHasVariations(false);
      setSelectedImage(null);
    }
  }, [editData, form, variacionPorDefecto]);

  const categoryOptions = useMemo(
    () =>
      categories.flatMap((c) => [
        { value: keyOf(c.id), label: c.name },
        ...(c.subcategories ?? []).map((s) => ({
          value: keyOf(c.id, s.id),
          label: `${c.name} › ${s.name}`,
        })),
      ]),
    [categories]
  );

  /** Convierte lo escrito en el Select de etiquetas en ids, creando las nuevas. */
  const resolverEtiquetas = async (values: (number | string)[]) => {
    const ids: number[] = [];
    for (const v of values ?? []) {
      if (typeof v === "number") {
        ids.push(v);
        continue;
      }
      const nombre = String(v).trim();
      if (!nombre) continue;
      const existente = tags.find(
        (t) => t.name.toLowerCase() === nombre.toLowerCase()
      );
      if (existente) {
        ids.push(existente.id);
      } else {
        const res = await apiTienda.post("/tags", {
          name: nombre,
          color: "#059669",
        });
        ids.push(res.data.data.id);
      }
    }
    return [...new Set(ids)];
  };

  const handleSubmit = async (values: any, priceMode?: "base_only" | "all") => {
    try {
      setLoading(true);

      const tag_ids = esRestaurante ? [] : await resolverEtiquetas(values.tagIds);
      const category_links = (values.categoryKeys ?? []).map(parseKey);

      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description ?? null,
        price: values.price ?? 0,
        // El costo real sale de las compras; esto solo guarda un estimado.
        cost: values.cost ?? null,
        // Vacío = que el servidor genere el SKU por defecto.
        sku: values.sku?.trim() ? values.sku.trim() : undefined,
        low_stock_threshold: values.lowStockThreshold ?? 5,
        status: values.active ? "activo" : "inactivo",
        business_image_id: selectedImage?.id || null,
        category_links,
        tag_ids,
        price_mode: priceMode,
      };

      // El stock inicial solo existe al crear. Después se ajusta con el botón
      // "Ajustar stock", que deja constancia en el kardex.
      // Un plato no tiene stock propio: lo que se agota son los insumos.
      if (!editData && !hasVariations && !esRestaurante) payload.stock = values.stock ?? 0;
      // Atributos elegidos aquí: el producto nace ya con sus variaciones.
      const nuevasVariaciones = combos.map((c) => ({
        attributeValueIds: c.valueIds,
        sku: c.sku?.trim() || undefined,
        stock: c.stock,
      }));
      if (!editData && !esRestaurante && hasVariations) {
        if (!nuevasVariaciones.length) {
          message.warning("Elige al menos una talla, color u otro atributo, o apaga «¿Tiene variaciones?»");
          setLoading(false);
          return;
        }
        payload.variations = nuevasVariaciones;
      }
      if (esRestaurante) {
        delete payload.tag_ids;
        delete payload.sku;
        delete payload.low_stock_threshold;
      }

      let saved: any = editData;
      if (editData) {
        await apiTienda.put(`/products/${editData.id}`, payload);
        if (!esRestaurante && hasVariations && nuevasVariaciones.length) {
          await apiTienda.post(`/products/${editData.id}/variations`, { variations: nuevasVariaciones });
        }
        message.success("Producto actualizado correctamente");
      } else {
        const res = await apiTienda.post(`/products`, payload);
        saved = res.data.data;
        message.success("Producto creado correctamente");
      }

      onSuccess(undefined, !editData && esRestaurante ? saved : undefined);
      onClose();
    } catch (error: any) {
      // Cambió el precio base y hay variaciones con precio propio: el servidor
      // no toca nada hasta que el vendedor decida qué hacer con ellas.
      if (error?.response?.status === 409 && error?.response?.data?.code === "price_decision") {
        setDecisionPrecio({ valores: values, datos: error.response.data.data });
        return;
      }
      console.error(error);
      message.error(
        error?.response?.data?.message ?? "Error al guardar el producto"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        title={
          esRestaurante
            ? editData
              ? "Editar plato"
              : "Nuevo plato"
            : editData
              ? "Editar producto"
              : "Nuevo producto"
        }
        open={open}
        onCancel={onClose}
        okText={editData ? "Guardar cambios" : "Crear"}
        onOk={() => form.submit()}
        confirmLoading={loading}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
            <Form.Item label="Imagen principal">
              {selectedImage && (
                <img
                  src={selectedImage.url}
                  alt="imagen seleccionada"
                  className="mb-2 h-40 w-full rounded border object-contain"
                  style={{ background: "#f0f1f3" }}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {/* Un solo botón: en la galería se sube, se toma una foto o se elige. */}
                <Button icon={<PlusOutlined />} onClick={() => setGalleryOpen(true)}>
                  {selectedImage ? "Cambiar imagen" : "Subir imagen"}
                </Button>
              </div>
            </Form.Item>

            <div>
              <Form.Item
                label="Nombre"
                name="name"
                rules={[
                  { required: true, message: "Ingrese el nombre del producto" },
                ]}
              >
                <Input
                  placeholder={
                    esRestaurante
                      ? "Ej: Hamburguesa clásica"
                      : "Ej: Bobina de encendido Hyundai Accent"
                  }
                />
              </Form.Item>

              <Form.Item label="Descripción" name="description">
                <Input.TextArea
                  rows={3}
                  placeholder={
                    esRestaurante
                      ? "Qué lleva, tamaño, acompañamientos…"
                      : "Aplicación, referencia OEM, notas…"
                  }
                />
              </Form.Item>
            </div>
          </div>

          <Form.Item
            label="Categorías"
            name="categoryKeys"
            extra={
              esRestaurante
                ? "Así se agrupa en tu carta: Hamburguesas, Bebidas, Postres…"
                : "Puede estar en varias: por ejemplo Motor › Lubricación y Repuestos Chevrolet Sail."
            }
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Elige una o varias categorías"
              options={categoryOptions}
            />
          </Form.Item>

          {!esRestaurante && (
          <Form.Item
            label="Etiquetas"
            name="tagIds"
            extra="Para agrupar y filtrar en la tienda: Nuevo, Más vendido, Oferta, Temporada… Escribe una nueva y pulsa Enter para crearla."
          >
            <Select
              mode="tags"
              allowClear
              optionFilterProp="label"
              tokenSeparators={[","]}
              placeholder="Nuevo, Oferta, Temporada…"
              options={tags.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>
          )}

          <div className="flex items-center gap-6 mb-3 flex-wrap">
            <Form.Item
              name="active"
              valuePropName="checked"
              className="mb-0"
              label={esRestaurante ? "Visible en la carta" : "Visible en la tienda"}
            >
              <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
            </Form.Item>

            {!esRestaurante && (
            <Form.Item
              className="mb-0"
              label="¿Tiene variaciones? (marca, color, medida…)"
            >
              <Tooltip
                title={
                  yaTieneVariaciones
                    ? "Para quitarlas, elimina las variaciones desde su editor."
                    : ""
                }
              >
                <Switch
                  checked={hasVariations}
                  disabled={yaTieneVariaciones}
                  onChange={setHasVariations}
                />
              </Tooltip>
            </Form.Item>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Form.Item
              label={hasVariations ? "Precio base" : "Precio"}
              name="price"
              rules={[{ required: true, message: "Ingrese el precio" }]}
              extra={
                hasVariations
                  ? "Es el precio de todas las variaciones; cada una puede cambiarlo si lo necesita."
                  : "Con precio 0 la tienda muestra «Consultar precio»."
              }
            >
              <InputNumber min={0} style={{ width: "100%" }} addonBefore="S/" />
            </Form.Item>

            {!esRestaurante && (
            <Form.Item
              label={hasVariations ? "SKU base" : "SKU"}
              name="sku"
              extra={
                hasVariations
                  ? "Código único del producto; el de cada variación se arma a partir de él."
                  : "Código único. Se propone solo; edítalo si ya usas tus propios códigos."
              }
            >
              <SkuField auto={!editData} params={{ name: nombreWatch }} ready={!!nombreWatch?.trim()} />
            </Form.Item>
            )}

            {!esRestaurante && !hasVariations && !editData && (
              <Form.Item
                label="Stock inicial"
                name="stock"
                extra="Las unidades que ya tienes hoy. Para mercadería nueva que le compras a un proveedor, usa Compras: así queda también el costo."
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            )}

            {!esRestaurante && !hasVariations && editData && (
              <Form.Item label="Stock">
                <div className="flex items-center gap-3">
                  <Tag
                    color={stockActual > 0 ? "green" : "red"}
                    style={{ fontSize: 14, padding: "2px 10px" }}
                  >
                    {stockActual}
                  </Tag>
                  <Button onClick={() => setMovOpen(true)} disabled={!variacionPorDefecto}>
                    Registrar movimiento
                  </Button>
                </div>
              </Form.Item>
            )}
          </div>

          {!esRestaurante && hasVariations && (
            <div className="rounded border p-3 mb-4 bg-gray-50">
              {variacionesReales.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">Variaciones ({variacionesReales.length})</span>
                    {onEditarVariaciones && (
                      <Button size="small" onClick={() => onEditarVariaciones(editData)}>
                        Editar variaciones
                      </Button>
                    )}
                  </div>
                  <div className="mb-3 space-y-1">
                    {variacionesReales.map((v: any) => (
                      <div key={v.id} className="flex justify-between gap-3 text-sm">
                        <span>
                          {etiquetaVariacion(v)} <Text type="secondary">{v.sku}</Text>
                        </span>
                        <Tag color={v.stock > 0 ? "green" : "red"}>{v.stock}</Tag>
                      </div>
                    ))}
                  </div>
                  <div className="mb-1 font-medium">Agregar más</div>
                </>
              )}
              <VariationGenerator
                existentes={clavesExistentes}
                skuProducto={skuWatch}
                conStock
                onChange={setCombos}
              />
            </div>
          )}

          {!esRestaurante && (
          <Collapse
            ghost
            items={[
              {
                key: "mas",
                label: "Más opciones (IGV, alerta de stock, costo)",
                children: (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                      <Form.Item
                        label={`${impuesto.nombre} %`}
                        extra="Lo define el país de tu tienda (Mi tienda › General)."
                      >
                        <InputNumber disabled style={{ width: "100%" }} value={impuesto.tasa} />
                      </Form.Item>
                      <Form.Item
                        label="Avisar con stock bajo de"
                        name="lowStockThreshold"
                        extra={hasVariations ? "Es el valor de partida; cada variación puede tener el suyo." : undefined}
                      >
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                    </div>
                    <Form.Item name="cost" hidden>
                      <InputNumber />
                    </Form.Item>
                    <CostoReferencia
                      productId={editData?.id}
                      costoActual={editData?.cost != null ? Number(editData.cost) : null}
                      precio={precioWatch ?? null}
                      estimado={costoWatch ?? null}
                      onEstimado={(v) => form.setFieldsValue({ cost: v ?? undefined })}
                    />
                  </div>
                ),
              },
            ]}
          />
          )}
        </Form>
      </Modal>

      <Modal
        open={!!decisionPrecio}
        title="Cambiaste el precio base"
        onCancel={() => setDecisionPrecio(null)}
        footer={[
          <Button key="c" onClick={() => setDecisionPrecio(null)}>
            Cancelar
          </Button>,
          <Button
            key="b"
            onClick={() => {
              const v = decisionPrecio!.valores;
              setDecisionPrecio(null);
              handleSubmit(v, "base_only");
            }}
          >
            Solo las que usan el precio base
          </Button>,
          <Button
            key="a"
            type="primary"
            onClick={() => {
              const v = decisionPrecio!.valores;
              setDecisionPrecio(null);
              handleSubmit(v, "all");
            }}
          >
            Cambiar todas
          </Button>,
        ]}
      >
        {decisionPrecio && (
          <div className="space-y-3 text-[13px]">
            <p>
              El precio pasa de <b>S/ {decisionPrecio.datos.precioAnterior.toFixed(2)}</b> a{" "}
              <b>S/ {decisionPrecio.datos.precioNuevo.toFixed(2)}</b>. Estas{" "}
              {decisionPrecio.datos.variaciones.length} de {decisionPrecio.datos.total} variaciones tienen un precio
              propio:
            </p>
            <ul className="space-y-1 rounded border border-line-soft p-2">
              {decisionPrecio.datos.variaciones.map((v) => (
                <li key={v.id} className="flex justify-between">
                  <span>{v.label}</span>
                  <span className="font-semibold">S/ {v.precio.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted">
              «Solo las que usan el precio base» deja estas como están. «Cambiar todas» las pisa con el precio nuevo.
              Tus clientes ven en la tienda el precio más bajo con «Desde».
            </p>
          </div>
        )}
      </Modal>

      <MovementModal
        open={movOpen}
        item={
          variacionPorDefecto
            ? { id: variacionPorDefecto.id, nombre: editData?.name ?? "Producto", stock: stockActual }
            : null
        }
        onClose={() => setMovOpen(false)}
        onDone={() => {
          apiTienda
            .get(`/products/${editData.id}`)
            .then((r) => {
              const v = (r.data.data.variations ?? []).find((x: any) => x.isDefault);
              setStockActual(Number(v?.stock ?? 0));
            })
            .catch(() => undefined);
          onSuccess();
        }}
      />

      {/* Modal de Galería */}
      <GalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(img) => setSelectedImage(img)}
      />
    </>
  );
};

export default ProductFormModal;
