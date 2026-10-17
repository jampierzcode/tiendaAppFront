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

  return (
    <BusinessContext.Provider
      value={{ business, loading, refreshBusiness: fetchBusiness }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);

/** ¿El negocio abierto es un restaurante? Cambia productos, menú y pantallas. */
export const useEsRestaurante = () => {
  const { business } = useBusiness();
  return (business?.businessType ?? business?.business_type) === "restaurant";
};
