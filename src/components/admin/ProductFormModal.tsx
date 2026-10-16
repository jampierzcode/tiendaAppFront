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
import SelectorFoto from "../ui/SelectorFoto";
import { useGallery } from "../../hooks/useGallery";
import { useRecorteImagen } from "../../hooks/useRecorteImagen";
import { PlusOutlined } from "@ant-design/icons";
import { apiTienda } from "../../api/apiTienda";
import { useEsRestaurante } from "../../context/BusinessContext";

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
}) => {
  const [form] = Form.useForm();
  const esRestaurante = useEsRestaurante();
  const [loading, setLoading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const { uploading, uploadImages } = useGallery();
  const { pedirRecorte, modal: modalRecorte } = useRecorteImagen();

  /** Foto subida o tomada desde aquí: se recorta, se sube a la galería y queda elegida. */
  const subirDirecto = async ([original]: File[]) => {
    const file = await pedirRecorte(original);
    if (!file) return;
    try {
      const r = await uploadImages([file]);
      const img = r.data?.[0];
      if (img) setSelectedImage({ id: img.id, url: img.url } as any);
      if (r.rechazadas?.length) message.warning(r.rechazadas.join(" · "));
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo subir la imagen");
    }
  };
  const [selectedImage, setSelectedImage] = useState<{
    id: number;
    url: string;
  } | null>(null);

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [hasVariations, setHasVariations] = useState(false);

  // Ajuste de stock del producto simple (se registra en el kardex).
  const [stockOpen, setStockOpen] = useState(false);
  const [stockActual, setStockActual] = useState(0);
  const [stockNuevo, setStockNuevo] = useState<number | null>(null);
  const [stockNota, setStockNota] = useState("");
  const [stockLoading, setStockLoading] = useState(false);

  const variacionPorDefecto = useMemo(
    () => editData?.variations?.find((v: any) => v.isDefault),
    [editData]
  );
  const yaTieneVariaciones = productoTieneVariaciones(editData);

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

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const tag_ids = esRestaurante ? [] : await resolverEtiquetas(values.tagIds);
      const category_links = (values.categoryKeys ?? []).map(parseKey);

      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description ?? null,
        price: values.price ?? 0,
        cost: values.cost ?? null,
        sku: values.sku?.trim() ? values.sku.trim() : null,
        tax_rate: values.taxRate ?? 18,
        low_stock_threshold: values.lowStockThreshold ?? 5,
        status: values.active ? "activo" : "inactivo",
        business_image_id: selectedImage?.id || null,
        category_links,
        tag_ids,
      };

      // El stock inicial solo existe al crear. Después se ajusta con el botón
      // "Ajustar stock", que deja constancia en el kardex.
      // Un plato no tiene stock propio: lo que se agota son los insumos.
      if (!editData && !hasVariations && !esRestaurante) payload.stock = values.stock ?? 0;
      if (esRestaurante) {
        delete payload.tag_ids;
        delete payload.sku;
        delete payload.low_stock_threshold;
      }

      let saved: any = editData;
      if (editData) {
        await apiTienda.put(`/products/${editData.id}`, payload);
        message.success("Producto actualizado correctamente");
      } else {
        const res = await apiTienda.post(`/products`, payload);
        saved = res.data.data;
        message.success("Producto creado correctamente");
      }

      // Encendió "Tiene variaciones" y aún no tiene ninguna: lo llevamos
      // directo al editor para que las cree.
      const abrir = !esRestaurante && hasVariations && !yaTieneVariaciones ? saved : undefined;
      onSuccess(abrir, !editData && esRestaurante ? saved : undefined);
      onClose();
    } catch (error: any) {
      console.error(error);
      message.error(
        error?.response?.data?.message ?? "Error al guardar el producto"
      );
    } finally {
      setLoading(false);
    }
  };

  const guardarAjusteStock = async () => {
    if (!variacionPorDefecto || stockNuevo == null) return;
    try {
      setStockLoading(true);
      await apiTienda.post("/inventory/adjust", {
        variationId: variacionPorDefecto.id,
        newStock: stockNuevo,
        note: stockNota.trim() || "Ajuste manual desde el producto",
      });
      setStockActual(stockNuevo);
      setStockOpen(false);
      setStockNota("");
      message.success("Stock ajustado y registrado en el kardex");
      onSuccess();
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ?? "No se pudo ajustar el stock"
      );
    } finally {
      setStockLoading(false);
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
                <Button icon={<PlusOutlined />} onClick={() => setGalleryOpen(true)}>
                  {selectedImage ? "Cambiar" : "Galería"}
                </Button>
                <SelectorFoto onFiles={subirDirecto} loading={uploading} />
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
            extra="Marcas y vehículos (Toyota, Aktion…). Escribe una nueva y pulsa Enter para crearla."
          >
            <Select
              mode="tags"
              allowClear
              optionFilterProp="label"
              tokenSeparators={[","]}
              placeholder="Marca, vehículo…"
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
                  ? "Se copia a las variaciones nuevas; cada una puede tener el suyo."
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
                  ? "Prefijo con el que se sugieren los SKU de las variaciones."
                  : undefined
              }
            >
              <Input placeholder="Código interno" />
            </Form.Item>
            )}

            {!esRestaurante && !hasVariations && !editData && (
              <Form.Item label="Stock inicial" name="stock">
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
                  <Button
                    onClick={() => {
                      setStockNuevo(stockActual);
                      setStockOpen(true);
                    }}
                    disabled={!variacionPorDefecto}
                  >
                    Ajustar stock
                  </Button>
                </div>
              </Form.Item>
            )}
          </div>

          {!esRestaurante && hasVariations && (
            <div className="rounded border p-3 mb-4 bg-gray-50">
              {yaTieneVariaciones ? (
                <>
                  <div className="font-medium mb-2">
                    Variaciones ({editData.variations.length})
                  </div>
                  <div className="space-y-1">
                    {editData.variations.map((v: any) => (
                      <div
                        key={v.id}
                        className="flex justify-between text-sm gap-3"
                      >
                        <span>
                          {etiquetaVariacion(v)}{" "}
                          <Text type="secondary">{v.sku}</Text>
                        </span>
                        <span>
                          S/ {Number(v.price).toFixed(2)} ·{" "}
                          <Tag color={v.stock > 0 ? "green" : "red"}>
                            {v.stock}
                          </Tag>
                        </span>
                      </div>
                    ))}
                  </div>
                  <Text type="secondary" className="block mt-2">
                    Para agregar, editar o ajustar el stock de cada una, usa
                    «Variaciones» en la lista de productos.
                  </Text>
                </>
              ) : (
                <Text type="secondary">
                  Al guardar se abrirá el editor de variaciones para que crees
                  cada marca, color o medida con su SKU, precio y stock.
                </Text>
              )}
            </div>
          )}

          {!esRestaurante && (
          <Collapse
            ghost
            items={[
              {
                key: "mas",
                label: "Más opciones (costo, IGV, alerta de stock)",
                children: (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
                    <Form.Item label="Costo" name="cost">
                      <InputNumber
                        min={0}
                        style={{ width: "100%" }}
                        addonBefore="S/"
                      />
                    </Form.Item>
                    <Form.Item label="IGV %" name="taxRate">
                      <InputNumber min={0} max={100} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      label="Avisar con stock bajo de"
                      name="lowStockThreshold"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </div>
                ),
              },
            ]}
          />
          )}
        </Form>
      </Modal>

      <Modal
        title="Ajustar stock"
        open={stockOpen}
        onCancel={() => setStockOpen(false)}
        onOk={guardarAjusteStock}
        okText="Guardar ajuste"
        confirmLoading={stockLoading}
        okButtonProps={{ disabled: stockNuevo == null }}
      >
        <p className="mb-3">
          Stock actual: <b>{stockActual}</b>. Escribe la cantidad que hay
          realmente; la diferencia queda registrada en el kardex.
        </p>
        <Form layout="vertical">
          <Form.Item label="Stock real">
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              value={stockNuevo}
              onChange={(v) => setStockNuevo(v)}
            />
          </Form.Item>
          <Form.Item label="Motivo (opcional)">
            <Input
              value={stockNota}
              onChange={(e) => setStockNota(e.target.value)}
              placeholder="Conteo físico, compra, merma…"
            />
          </Form.Item>
        </Form>
      </Modal>

      {modalRecorte}
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
