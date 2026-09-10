import React, { useState } from "react";
import { Modal, Upload, Button, Spin, Input, Tooltip, message, Empty } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleTwoTone,
  SearchOutlined,
} from "@ant-design/icons";
import { useGallery } from "../../hooks/useGallery";

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (image: { id: number; url: string }) => void;
}

const pesoLegible = (bytes?: number | null) =>
  bytes ? `${(bytes / 1024).toFixed(0)} KB` : "";

const GalleryModal: React.FC<GalleryModalProps> = ({ open, onClose, onSelect }) => {
  const { images, loading, uploading, uploadImages, deleteImage } = useGallery();

  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  /**
   * Antd llama a `beforeUpload` una vez por archivo. Se sube cada uno y se
   * devuelve `false` para que Antd no intente subirlo por su cuenta.
   */
  const handleUpload = async (file: File) => {
    try {
      const res = await uploadImages([file]);
      if (res.rechazadas?.length) {
        message.warning(res.rechazadas.join(" · "));
      } else {
        message.success(res.message);
      }
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ?? "No se pudo subir la imagen"
      );
    }
    return false;
  };

  const handleSelect = () => {
    const img = images.find((i) => i.id === selected);
    if (!img) {
      message.warning("Selecciona una imagen primero");
      return;
    }
    onSelect(img);
    onClose();
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteImage(id);
      if (selected === id) setSelected(null);
      message.success("Imagen eliminada");
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ?? "No se pudo eliminar la imagen"
      );
    }
  };

  const filtered = images.filter((img) =>
    `${img.name ?? ""} ${img.url}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      title="Biblioteca de imágenes"
      open={open}
      onCancel={onClose}
      onOk={handleSelect}
      okText="Usar esta imagen"
      cancelText="Cerrar"
      okButtonProps={{ disabled: selected === null }}
      width={840}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar por nombre…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Upload
          beforeUpload={handleUpload}
          showUploadList={false}
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
        >
          <Button icon={<PlusOutlined />} type="primary" loading={uploading}>
            Subir imágenes
          </Button>
        </Upload>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        JPG, PNG, WEBP o AVIF, hasta 8 MB cada una. Se guardan en tu bucket y
        quedan visibles en la tienda pública.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          description={
            search
              ? "Ninguna imagen coincide con la búsqueda"
              : "Todavía no has subido imágenes"
          }
          className="py-10"
        />
      ) : (
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((img) => (
            <div
              key={img.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(img.id)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(img.id)}
              className={`relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                selected === img.id
                  ? "border-blue-500 shadow-md"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img
                src={img.url}
                alt={img.name ?? ""}
                loading="lazy"
                className="h-36 w-full bg-gray-100 object-cover"
              />

              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-xs text-gray-600" title={img.name ?? ""}>
                  {img.name ?? "Sin nombre"}
                </span>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {pesoLegible(img.sizeBytes)}
                </span>
              </div>

              {selected === img.id && (
                <CheckCircleTwoTone
                  twoToneColor="#52c41a"
                  className="absolute right-2 top-2 text-xl"
                />
              )}

              <Tooltip title="Eliminar del bucket">
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  type="primary"
                  className="absolute bottom-9 right-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(img.id);
                  }}
                />
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default GalleryModal;
