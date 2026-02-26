import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { apiTienda } from "../api/apiTienda";
import type { Business } from "../types/main";

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  rol_id: number;
  status: string;
  role: Role;
}

interface AuthState {
  token: string | null;
  user: User | null;
}

interface AuthContextType {
  auth: AuthState;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  fetchMe: (token: string) => Promise<void>;
  businessesByUser: Business[] | null;
}

export const AuthContext = createContext<AuthContextType>({
  auth: { token: null, user: null },
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  fetchMe: async () => {},
  businessesByUser: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<AuthState>({
    token: sessionStorage.getItem("token") || null,
    user: null,
  });
  const [businessesByUser, setBusinessesByUser] = useState<Business[] | null>(
    null
  );

  // 🔹 LOGIN
  const login = async (email: string, password: string) => {
    try {
      const response = await apiTienda.post("/login", { email, password });
      const data = response.data;

      if (!data?.token) {
        return { success: false, message: "No se recibió token del servidor." };
      }

      sessionStorage.setItem("token", data.token);

      await fetchMe(data.token);
      return { success: true };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ERR_NETWORK") {
          return {
            success: false,
            message: "No se pudo conectar al servidor.",
          };
        }
        return {
          success: false,
          message: error.response?.data?.message || "Credenciales inválidas.",
        };
      }
      return {
        success: false,
        message: "Error desconocido al iniciar sesión.",
      };
    }
  };

  // 🔹 FETCH USER (ME)
  const fetchMe = async (token: string) => {
    try {
      const response = await apiTienda.get("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      console.log(data);
      setBusinessesByUser(data.user.businesses);
      setAuth({ token, user: data.user || data.data || null });
    } catch (error) {
      console.error("Error fetching user", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // 🔹 AUTOLOAD USER ON START
  useEffect(() => {
    if (auth.token) {
      fetchMe(auth.token);
    } else {
      setLoading(false);
    }
  }, [auth.token]);

  // 🔹 LOGOUT
  const logout = () => {
    sessionStorage.removeItem("token");
    setAuth({ token: null, user: null });
  };

  return (
    <AuthContext.Provider
      value={{ auth, loading, login, logout, fetchMe, businessesByUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 🔹 Hook para usar el contexto fácilmente
export const useAuth = () => useContext(AuthContext);
