import React, { useState } from "react";
import { Modal, Upload, Button, Spin, Input, Tooltip, message } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleTwoTone,
  SearchOutlined,
} from "@ant-design/icons";
import { useGallery } from "../../hooks/useGallery";
import { apiTienda } from "../../api/apiTienda";

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (image: { id: number; url: string }) => void;
}

const GalleryModal: React.FC<GalleryModalProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { images, loading, uploadImage, deleteImage, fetchImages } =
    useGallery();

  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const handleUpload = async (file: File) => {
    try {
      const images = await uploadImage([file]);
      console.log(images);
      const filesData = images.files;
      for (let index = 0; index < filesData.length; index++) {
        const element = filesData[index];

        await apiTienda.post(`/business-images`, {
          name: element.original_name,
          url: element.url,
          status: "activo",
        });
      }
      message.success("Imagen subida correctamente");
      await fetchImages();
    } catch (error: any) {
      console.log(error);
      message.error("Error al subir imagen");
    }
    return false;
  };

  const handleSelect = () => {
    const img = images.find((i) => i.id === selected);
    if (img) {
      onSelect(img);
      onClose();
    } else {
      message.warning("Selecciona una imagen primero");
    }
  };

  const filtered = images.filter(
    (img) =>
      img.name?.toLowerCase().includes(search.toLowerCase()) ||
      img.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      title="📸 Biblioteca de Imágenes"
      open={open}
      onCancel={onClose}
      onOk={handleSelect}
      okText="Seleccionar"
      cancelText="Cerrar"
      width={800}
    >
      <div className="flex items-center justify-between mb-3">
        <Input
          placeholder="Buscar imagen..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
        />
        <Upload
          beforeUpload={handleUpload}
          showUploadList={false}
          accept="image/*"
        >
          <Button icon={<PlusOutlined />}>Subir Imagen</Button>
        </Upload>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
          {filtered.map((img) => (
            <div
              key={img.id}
              className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all ${
                selected === img.id
                  ? "border-blue-500 shadow-md"
                  : "border-gray-200"
              }`}
              onClick={() => setSelected(img.id)}
            >
              <img
                src={img.url}
                alt={img.name || ""}
                className="object-cover w-full h-36"
              />
              {selected === img.id && (
                <CheckCircleTwoTone
                  twoToneColor="#52c41a"
                  className="absolute top-2 right-2 text-xl"
                />
              )}
              <Tooltip title="Eliminar imagen">
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  type="primary"
                  className="absolute bottom-2 right-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteImage(img.id);
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
