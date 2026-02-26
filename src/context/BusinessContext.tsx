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
      console.log(response);
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
