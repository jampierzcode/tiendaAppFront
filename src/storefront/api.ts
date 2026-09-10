import axios from "axios";

/**
 * Cliente de la tienda pública.
 *
 * Deliberadamente separado de `apiTienda`: aquí NO se manda token. Quien abre
 * la tienda es un cliente que escaneó un QR, no un usuario del panel, y
 * mezclar los dos clientes es la forma más fácil de filtrar la sesión del
 * dueño a una página pública.
 */
export const storeApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export interface Tienda {
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  currencySymbol: string;
  shippingCost: number;
  freeShippingFrom: number | null;
  aceptaPedidos: boolean;
  phone: string | null;
  address: string | null;
  city: string | null;
  schedule: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

export interface ProductoResumen {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  discount: number;
  currencySymbol: string;
  stock: number;
  disponible: boolean;
  tags: { name: string; slug: string; color: string | null }[];
  colores: { value: string; hexColor: string | null }[];
}

export interface Variacion {
  id: number;
  sku: string | null;
  isDefault: boolean;
  stock: number;
  disponible: boolean;
  price: number;
  originalPrice: number | null;
  label: string;
  attributes: {
    attributeId: number;
    attributeName: string;
    valueId: number;
    value: string;
    hexColor: string | null;
  }[];
}

export interface ProductoDetalle extends ProductoResumen {
  description: string | null;
  variations: Variacion[];
}

export interface Categoria {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  subcategories: { id: number; name: string; slug: string }[];
}

export interface FiltroAtributo {
  id: number;
  name: string;
  type: string;
  values: { id: number; value: string; hexColor: string | null }[];
}

const base = (slug: string) => `/store/${slug}`;

export const obtenerTienda = (slug: string) =>
  storeApi.get<{ data: Tienda }>(base(slug)).then((r) => r.data.data);

export const obtenerCategorias = (slug: string) =>
  storeApi.get<{ data: Categoria[] }>(`${base(slug)}/categories`).then((r) => r.data.data);

export const obtenerFiltros = (slug: string) =>
  storeApi.get<{ data: FiltroAtributo[] }>(`${base(slug)}/filters`).then((r) => r.data.data);

export const obtenerProductos = (slug: string, params: Record<string, unknown>) =>
  storeApi
    .get<{ data: ProductoResumen[]; meta: { total: number; lastPage: number; currentPage: number } }>(
      `${base(slug)}/products`,
      { params }
    )
    .then((r) => r.data);

export const obtenerProducto = (slug: string, productSlug: string) =>
  storeApi
    .get<{ data: ProductoDetalle }>(`${base(slug)}/products/${productSlug}`)
    .then((r) => r.data.data);

export interface RespuestaPedido {
  code: string;
  total: number;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  currencySymbol: string;
  whatsappUrl: string | null;
}

export const crearPedido = (
  slug: string,
  datos: {
    customerName: string;
    customerPhone: string;
    deliveryMethod: "envio" | "recojo";
    deliveryAddress?: string;
    deliveryCity?: string;
    note?: string;
    items: { variationId: number; quantity: number }[];
  }
) =>
  storeApi
    .post<{ data: RespuestaPedido }>(`${base(slug)}/orders`, datos)
    .then((r) => r.data.data);

export const marcarPedidoEnviado = (slug: string, code: string) =>
  storeApi.post(`${base(slug)}/orders/${code}/sent`).catch(() => undefined);
