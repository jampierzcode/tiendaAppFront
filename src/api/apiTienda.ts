import axios from "axios";

export const apiTienda = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiTienda.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
