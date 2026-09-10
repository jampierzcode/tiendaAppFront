import axios from "axios";

export const apiTienda = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/**
 * Rutas que NO pertenecen a una tienda concreta.
 *
 * Todo lo demás se prefija con `/b/<uuid>` automáticamente. La lista está al
 * revés a propósito: antes se enumeraba lo que sí llevaba prefijo, y cada
 * módulo nuevo había que acordarse de añadirlo. Nada avisaba si se olvidaba —
 * la petición salía sin prefijo y moría en un 404. Así, olvidarse hace que una
 * ruta de cuenta se rompa en desarrollo, no que una de tienda falle en
 * producción.
 */
const RUTAS_DE_CUENTA = [
  "/login",
  "/register",
  "/logout",
  "/me",
  "/updatePassword",
  "/businesses",
  "/users",
  "/roles",
  // La tienda pública ya trae su propio slug en la URL.
  "/store",
];

/** Lee el uuid de la tienda abierta desde la URL del panel: /b/<uuid>/... */
export function currentBusinessUuid(): string | null {
  const match = window.location.pathname.match(/^\/b\/([^/]+)/);
  return match ? match[1] : null;
}

const perteneceALaCuenta = (url: string) =>
  RUTAS_DE_CUENTA.some(
    (ruta) => url === ruta || url.startsWith(`${ruta}/`) || url.startsWith(`${ruta}?`)
  );

apiTienda.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Con FormData el navegador tiene que poner el Content-Type él mismo,
  // porque incluye el boundary del multipart.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  const url = config.url ?? "";

  // Ya viene con prefijo (o es absoluta): no se toca.
  if (url.startsWith("/b/") || url.startsWith("http")) return config;

  if (!perteneceALaCuenta(url)) {
    const uuid = currentBusinessUuid();

    if (!uuid) {
      return Promise.reject(
        new Error(
          `No hay una tienda abierta: no se puede pedir ${url}. Entra por /b/<uuid>/...`
        )
      );
    }

    config.url = `/b/${uuid}${url}`;
  }

  return config;
});

apiTienda.interceptors.response.use(
  (response) => response,
  (error) => {
    // El token venció o fue revocado: se limpia la sesión y se vuelve al login.
    if (error.response?.status === 401 && sessionStorage.getItem("token")) {
      sessionStorage.removeItem("token");
      if (window.location.pathname !== "/") window.location.href = "/";
    }
    return Promise.reject(error);
  }
);
