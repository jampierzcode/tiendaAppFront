import { useState, useEffect } from "react";
import axios from "axios";
import { useBusiness } from "../context/BusinessContext";
import { apiTienda } from "../api/apiTienda";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const UPLOAD_IMAGE_URL = import.meta.env.VITE_UPLOAD_IMAGE_URL;

export interface GalleryImage {
  id: number;
  url: string;
  name?: string;
}

export const useGallery = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const { business } = useBusiness();

  const fetchImages = async () => {
    try {
      setLoading(true);
      const res = await apiTienda.get(
        `/business-images/byBusiness/${business?.id}`
      );
      setImages(res.data.data || []);
    } catch (err) {
      console.error("Error al cargar imágenes:", err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (files: File[]) => {
    const formData = new FormData();

    // Agregar todos los archivos bajo la misma clave "files"
    files.forEach((file) => {
      formData.append("files[]", file);
    });
    formData.append("folder", business?.name ? business?.name : "business");
    try {
      setLoading(true);
      const res = await axios.post(UPLOAD_IMAGE_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchImages();
      return res.data;
    } catch (err) {
      console.error("Error al subir imagen:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (id: number) => {
    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/business-images/${id}`);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err) {
      console.error("Error al eliminar imagen:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  return { images, loading, uploadImage, deleteImage, fetchImages };
};
