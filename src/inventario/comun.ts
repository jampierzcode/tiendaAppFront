/** Tipos y utilidades compartidas por las pantallas de Inventario. */
export interface Insumo {
  id: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  avgCost: number;
  isActive: boolean;
  category: string | null;
  kind: "insumo" | "preparacion";
  purchaseUnit: string | null;
  purchaseFactor: number;
}

export const soles = (n: number) => `S/ ${Number(n ?? 0).toFixed(2)}`;
export const num = (v: number, d = 3) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: d });

export function errorDe(e: unknown, porDefecto = "No se pudo completar") {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto;
}

export const TIPO_MOVIMIENTO: Record<string, { texto: string; color: string }> = {
  inicial: { texto: "Stock inicial", color: "blue" },
  compra: { texto: "Compra", color: "green" },
  consumo: { texto: "Venta (receta)", color: "default" },
  devolucion: { texto: "Devolución", color: "cyan" },
  merma: { texto: "Merma", color: "red" },
  ajuste: { texto: "Ajuste", color: "orange" },
  conteo: { texto: "Conteo físico", color: "gold" },
  produccion: { texto: "Producción", color: "purple" },
};
