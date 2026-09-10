import { useState } from "react";
import { Button, Empty, Popconfirm, Spin, Upload, message } from "antd";
import { motion } from "motion/react";
import { TbLoader2, TbTrash, TbUpload } from "react-icons/tb";
import { useGallery } from "../../hooks/useGallery";
import PageHeader from "../../components/ui/PageHeader";

const pesoLegible = (b?: number | null) => (b ? `${(b / 1024).toFixed(0)} KB` : "");

export default function GalleryPage() {
  const { images, loading, uploading, uploadImages, deleteImage } = useGallery();
  const [borrando, setBorrando] = useState<number | null>(null);

  const subir = async (file: File) => {
    try {
      const r = await uploadImages([file]);
      if (r.rechazadas?.length) message.warning(r.rechazadas.join(" · "));
      else message.success(r.message);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo subir");
    }
    return false;
  };

  const borrar = async (id: number) => {
    setBorrando(id);
    try {
      await deleteImage(id);
      message.success("Imagen eliminada");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "No se pudo eliminar");
    } finally {
      setBorrando(null);
    }
  };

  return (
    <>
      <PageHeader
        titulo="Galería"
        descripcion="Las fotos de tus productos. Se guardan en tu bucket y se ven en la tienda pública."
        acciones={
          <Upload
            beforeUpload={subir}
            showUploadList={false}
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
          >
            <Button type="primary" icon={<TbUpload />} loading={uploading}>
              Subir imágenes
            </Button>
          </Upload>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : images.length === 0 ? (
        <div className="card py-16">
          <Empty description="Todavía no has subido fotos. Arrastra las de tus productos aquí." />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((img, i) => (
            <motion.figure
              key={img.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              className="card group relative overflow-hidden"
            >
              <img
                src={img.url}
                alt={img.name ?? ""}
                loading="lazy"
                className="aspect-square w-full bg-canvas object-cover"
              />
              <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate text-[12px] text-ink-soft" title={img.name ?? ""}>
                  {img.name ?? "Sin nombre"}
                </span>
                <span className="shrink-0 text-[11px] text-muted">
                  {pesoLegible(img.sizeBytes)}
                </span>
              </figcaption>

              {/* Siempre visible, no solo al pasar el ratón: en una tablet
                  no hay hover y el botón era inalcanzable. El círculo oscuro
                  translúcido lo hace legible sobre cualquier foto. */}
              <Popconfirm
                title="¿Eliminar esta foto?"
                description="Se borra del bucket y quien la use se queda sin imagen."
                okText="Eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
                onConfirm={() => borrar(img.id)}
              >
                <button
                  type="button"
                  aria-label={`Eliminar ${img.name ?? "imagen"}`}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/45 text-white backdrop-blur-sm transition hover:bg-danger focus-visible:bg-danger focus-visible:outline-none"
                >
                  {borrando === img.id ? (
                    <TbLoader2 size={15} className="animate-spin" />
                  ) : (
                    <TbTrash size={15} />
                  )}
                </button>
              </Popconfirm>
            </motion.figure>
          ))}
        </div>
      )}
    </>
  );
}
