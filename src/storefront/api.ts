import axios from "axios";
import { cabeceraCliente } from "./cliente";

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
  country?: string;
  businessType: "retail" | "restaurant";
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
  paymentPolicy: "none" | "on_confirm" | "on_delivery";
  paymentInstructions: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  address: string | null;
  city: string | null;
  schedule: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

export interface PromoEtiqueta {
  id: number;
  name: string;
  /** «−20%», «S/ 5.00 menos», «2x1»… */
  label: string;
}

export interface ProductoResumen {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  /** Subcategoría (o categoría) principal, para ubicar el producto de un vistazo. */
  categoria: string | null;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  discount: number;
  /** Hay variaciones con precios distintos: el precio mostrado es el más bajo. */
  desde?: boolean;
  promos?: PromoEtiqueta[];
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
  /** Foto propia de la variación. Si es null se usa la del producto. */
  imageUrl: string | null;
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
  categorias: {
    category: { name: string; slug: string };
    subcategory: { name: string; slug: string } | null;
  }[];
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

/** Opciones de filtro con cuántos productos hay detrás de cada una. */
export interface Facetas {
  categories: {
    id: number;
    name: string;
    slug: string;
    count: number;
    subcategories: { id: number; name: string; slug: string; count: number }[];
  }[];
  attributes: {
    id: number;
    name: string;
    type: string;
    values: { id: number; value: string; hexColor: string | null; count: number }[];
  }[];
  tags: { name: string; slug: string; color: string | null; count: number }[];
}

const base = (slug: string) => `/store/${slug}`;

export const obtenerTienda = (slug: string) =>
  storeApi.get<{ data: Tienda }>(base(slug)).then((r) => r.data.data);

export const obtenerCategorias = (slug: string) =>
  storeApi.get<{ data: Categoria[] }>(`${base(slug)}/categories`).then((r) => r.data.data);

export const obtenerFiltros = (slug: string) =>
  storeApi.get<{ data: FiltroAtributo[] }>(`${base(slug)}/filters`).then((r) => r.data.data);

export const obtenerFacetas = (slug: string, params: Record<string, unknown> = {}) =>
  storeApi.get<{ data: Facetas }>(`${base(slug)}/facets`, { params }).then((r) => r.data.data);

export const obtenerRelacionados = (slug: string, productSlug: string) =>
  storeApi
    .get<{ data: ProductoResumen[] }>(`${base(slug)}/products/${productSlug}/related`)
    .then((r) => r.data.data);

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
  /** Código de un solo uso para crear la cuenta y ver este pedido. */
  claimToken?: string;
}

export const crearPedido = (
  slug: string,
  datos: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryMethod: "envio" | "recojo" | "mesa";
    deliveryAddress?: string;
    deliveryCity?: string;
    note?: string;
    couponCode?: string;
    items: { variationId: number; quantity: number }[];
  }
) =>
  storeApi
    .post<{ data: RespuestaPedido }>(`${base(slug)}/orders`, datos, { headers: cabeceraCliente() })
    .then((r) => r.data.data);

export const marcarPedidoEnviado = (slug: string, code: string) =>
  storeApi.post(`${base(slug)}/orders/${code}/sent`).catch(() => undefined);

// --- Menú digital (restaurante) ---

export interface OpcionMenu {
  id: number;
  name: string;
  priceDelta: number;
}

export interface GrupoMenu {
  groupId: number;
  name: string;
  description: string | null;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: OpcionMenu[];
}

export interface PlatoMenu {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  promos?: PromoEtiqueta[];
  categoryIds: number[];
  subcategoryIds: number[];
  tags: { name: string; color: string | null }[];
  modifierGroups: GrupoMenu[];
}

export interface CartaMenu {
  categories: {
    id: number;
    name: string;
    slug: string;
    imageUrl: string | null;
    subcategories: { id: number; name: string }[];
  }[];
  products: PlatoMenu[];
}

export const obtenerMenu = (slug: string) =>
  storeApi.get<{ data: CartaMenu }>(`${base(slug)}/menu`).then((r) => r.data.data);

export const crearPedidoMenu = (
  slug: string,
  datos: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryMethod: "envio" | "recojo" | "mesa";
    deliveryAddress?: string;
    tableLabel?: string;
    note?: string;
    couponCode?: string;
    items: {
      productId: number;
      quantity: number;
      note?: string;
      options: { optionId: number; quantity: number }[];
    }[];
  }
) =>
  storeApi
    .post<{ data: RespuestaPedido }>(`${base(slug)}/orders`, datos, { headers: cabeceraCliente() })
    .then((r) => r.data.data);

export interface SeguimientoPedido {
  code: string;
  status: string;
  deliveryMethod: string;
  tableLabel: string | null;
  total: number;
  paidTotal: number;
  paymentPolicy: "none" | "on_confirm" | "on_delivery";
  paymentInstructions: string | null;
  currencySymbol: string;
  createdAt: string;
  items: {
    name: string;
    quantity: number;
    lineTotal: number;
    modifiers: string[];
    note: string | null;
    imageUrl?: string | null;
    variation?: string | null;
    unitPrice?: number;
  }[];
}

export const obtenerSeguimiento = (slug: string, code: string) =>
  storeApi
    .get<{ data: SeguimientoPedido }>(`${base(slug)}/orders/${code}`)
    .then((r) => r.data.data);

// --- Promociones y cupones ---

export interface PromoPublica extends PromoEtiqueta {
  kind: "percent" | "fixed" | "bundle";
  scope: "all" | "selection";
  /** «Polo, Casaca y 2 más». */
  alcance: string | null;
  /** «viernes y sábado»; null si es todos los días. */
  dias: string | null;
  product: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
  endDate: string | null;
}

export const obtenerPromociones = (slug: string) =>
  storeApi.get<{ data: PromoPublica[] }>(`${base(slug)}/promotions`).then((r) => r.data.data);

export interface Cotizacion {
  /** A precio de lista, antes de promociones. */
  subtotal: number;
  descuento: number;
  cupon: { codigo: string; valido: boolean; mensaje: string } | null;
}

/** Cuánto ahorra el carrito (promociones y cupón). Informativo: el pedido lo recalcula el servidor. */
export const cotizarCarrito = (
  slug: string,
  items: { variationId?: number; productId?: number; quantity: number; extras?: number }[],
  couponCode?: string
) =>
  storeApi
    .post<{ data: Cotizacion }>(`${base(slug)}/quote`, { items, couponCode })
    .then((r) => r.data.data);
