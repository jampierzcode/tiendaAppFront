export type Role = { id: number; code: string; name: string };

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
