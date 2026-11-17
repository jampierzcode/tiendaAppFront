export type Role = { id: number; name: string };

export type User = {
  id: number;
  name?: string;
  full_name?: string;
  email: string;
  rol_id?: number;
  role?: Role;
  roleCode: string;
  status?: "activo" | "inactivo" | string;
  createdAt?: string;
  business?: Business | null;
  businessId?: number;
};

export type Business = {
  id: number;
  uuid?: string;
  name: string;
  description?: string;
  logo_url?: string;
  user_id?: number | null;
  status?: "activo" | "inactivo" | string;
  slug?: string;
  businessType?: "retail" | "restaurant";
  businessSubtype?: string | null;
  whatsappPhone?: string | null;
  createdAt?: string;
  // Suscripción
  subscriptionStatus?: "trial" | "active" | "expired";
  effectiveSubscriptionStatus?: "trial" | "active" | "expired";
  trialEndsAt?: string | null;
  paidUntil?: string | null;
  /** Nombre del plan vigente. */
  planLabel?: string | null;
  planId?: number | null;
  currentPlan?: Plan | null;
  /** Funciones que incluye su plan (todas si no tiene plan asignado). */
  funciones?: string[];
  subscriptionDaysLeft?: number | null;
  user?: { id: number; name: string; email?: string } | null;
};

export type Product = {
  id: number;
  business_id?: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  status?: "activo" | "inactivo" | string;
};

export type PageMeta = { total: number; page: number; perPage: number };

export type PlanPrice = {
  id: number;
  planId: number;
  interval: "month" | "year";
  price: number;
  currency: string;
  isActive: boolean;
};

export type Plan = {
  id: number;
  key: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  businessType?: "restaurant" | "retail" | null;
  features: string[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  prices?: PlanPrice[];
  businessesCount?: number;
};

export type FuncionCatalogo = { key: string; label: string; detalle: string };

export type Suscripcion = {
  id: number;
  businessId?: number;
  planId?: number | null;
  planName: string;
  interval: "trial" | "month" | "year";
  quantity: number;
  unitPrice: number;
  total: number;
  currency: string;
  startsAt: string;
  endsAt: string;
  status: "trial" | "active" | "cancelled";
  state: "vigente" | "programada" | "vencida" | "anulada";
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  createdAt?: string;
  business?: { id: number; name: string; slug?: string; uuid?: string } | null;
  creator?: { id: number; name: string } | null;
};
