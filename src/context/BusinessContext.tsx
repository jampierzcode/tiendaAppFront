import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { apiTienda } from "../api/apiTienda";

interface Business {
  id: number;
  uuid: string;
  name: string;
  logo_url?: string;
  business_type?: "retail" | "restaurant";
  businessType?: "retail" | "restaurant";
  slug?: string;
  country?: string;
  whatsappPhone?: string | null;
  planId?: number | null;
  planLabel?: string | null;
  funciones?: string[];
  effectiveSubscriptionStatus?: "trial" | "active" | "expired";
  subscriptionDaysLeft?: number | null;
}

interface BusinessContextType {
  business: Business | null;
  loading: boolean;
  refreshBusiness: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType>({
  business: null,
  loading: true,
  refreshBusiness: async () => {},
});

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const { uuid_business } = useParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusiness = async () => {
    if (!uuid_business) return;
    try {
      const response = await apiTienda.get(
        `/businesses/byUuid/${uuid_business}`
      );
      setBusiness(response.data.data);
    } catch (error) {
      console.error("Error fetching business:", error);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusiness();
  }, [uuid_business]);

  // Marca de la pestaña: Peaky Resto en restaurantes, Peaky Shop en tiendas.
  // Fuera de un negocio (login, superadmin, o mientras carga) es Peaky Tech.
  useEffect(() => {
    const tipo = business?.businessType ?? business?.business_type;
    marcaPestana(tipo === "restaurant" ? "resto" : tipo === "retail" ? "shop" : "tech");
    return () => marcaPestana("tech");
  }, [business?.businessType, business?.business_type]);

  return (
    <BusinessContext.Provider
      value={{ business, loading, refreshBusiness: fetchBusiness }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

const MARCAS = {
  tech: { titulo: "Peaky Tech", icono: "/peaky-tech.svg" },
  resto: { titulo: "Peaky Resto", icono: "/peaky-resto.svg" },
  shop: { titulo: "Peaky Shop", icono: "/peaky-shop.svg" },
};

/** Pone el nombre y el ícono de la pestaña. */
export const marcaPestana = (marca: keyof typeof MARCAS) => {
  document.title = MARCAS[marca].titulo;
  const icono = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (icono) icono.href = MARCAS[marca].icono;
};

export const useBusiness = () => useContext(BusinessContext);

/** ¿El negocio abierto es un restaurante? Cambia productos, menú y pantallas. */
export const useEsRestaurante = () => {
  const { business } = useBusiness();
  return (business?.businessType ?? business?.business_type) === "restaurant";
};

/**
 * Funciones del plan del negocio abierto. Mientras carga se asume que tiene
 * todo, para no pintar candados que desaparecen al segundo.
 */
export const useFunciones = () => {
  const { business, loading } = useBusiness();
  const lista = business?.funciones;
  const tiene = (f: string) => loading || !business || !lista || lista.includes(f);
  return { tiene, funciones: lista ?? [], planLabel: business?.planLabel ?? null };
};
