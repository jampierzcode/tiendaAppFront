import { useCallback, useEffect, useState } from "react";
import { apiTienda } from "../api/apiTienda";

export interface GalleryImage {
  id: number;
  url: string;
  name?: string | null;
  type?: string;
  sizeBytes?: number | null;
  contentType?: string | null;
}

/**
 * Galería de imágenes del negocio.
 *
 * Todo pasa por `apiTienda`, que ya pone el token y el prefijo de la tienda.
 * Antes la subida iba a un servicio PHP aparte y el borrado se hacía con
 * axios pelado, sin token ni negocio: cualquiera podía borrar imágenes de
 * cualquier tienda.
 */
export const useGallery = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiTienda.get("/business-images");
      setImages(res.data.data || []);
    } catch (err) {
      console.error("Error al cargar imágenes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Sube al bucket y registra en la galería en una sola llamada. */
  const uploadImages = useCallback(
    async (files: File[], type = "producto") => {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      formData.append("type", type);

      try {
        setUploading(true);
        const res = await apiTienda.post("/business-images/upload", formData);
        await fetchImages();
        return res.data as {
          data: GalleryImage[];
          rechazadas: string[];
          message: string;
        };
      } finally {
        setUploading(false);
      }
    },
    [fetchImages]
  );

  const deleteImage = useCallback(async (id: number) => {
    // Optimista, pero se revierte si el servidor rechaza el borrado.
    const anterior = images;
    setImages((prev) => prev.filter((img) => img.id !== id));
    try {
      await apiTienda.delete(`/business-images/${id}`);
    } catch (err) {
      setImages(anterior);
      throw err;
    }
  }, [images]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return { images, loading, uploading, uploadImages, deleteImage, fetchImages };
};
