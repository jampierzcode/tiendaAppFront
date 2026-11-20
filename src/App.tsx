import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import { antdTheme } from "./theme/antdTheme";
import Login from "./pages/Login";
import Subscribe from "./pages/Subscribe";
import { UsersPage } from "./pages/superadmin/Users";
import { BusinessesPage } from "./pages/superadmin/Business";
import AiUsagePage from "./pages/superadmin/AiUsage";
import PlansPage from "./pages/superadmin/Plans";
import SubscriptionsPage from "./pages/superadmin/Subscriptions";
import Notfound from "./pages/Notfound";
import PrivateRoute from "./layouts/PrivateRoute";
import SuperAdminLayout from "./components/superAdmin/Layout";
import AdminLayout from "./components/admin/Layout";
import { BusinessProvider } from "./context/BusinessContext";
import { CategoriesPage } from "./pages/admin/CategoryProduct";
import ProductAttributesPage from "./pages/admin/ProductAttributesPage";
import TagsPage from "./pages/admin/TagsPage";
import ProductsPage from "./pages/admin/ProductsPage";
import DashboardAdmin from "./pages/admin/DashboardAdmin";
import MiPlanPage from "./pages/admin/MiPlanPage";
import ConFuncion from "./components/admin/ConFuncion";
import OrdersPage from "./pages/admin/OrdersPage";
import CustomersPage from "./pages/admin/CustomersPage";
import PosPage from "./pages/admin/PosPage";
import PurchasesPage from "./pages/admin/PurchasesPage";
import ReportsPage from "./pages/admin/ReportsPage";
import StoreSettingsPage from "./pages/admin/StoreSettingsPage";
import GalleryPage from "./pages/admin/GalleryPage";
import InventoryPage from "./pages/admin/InventoryPage";
import DiscountsPage from "./pages/admin/DiscountsPage";
import { StoreProvider } from "./storefront/StoreContext";
import ProductDetail from "./storefront/ProductDetail";
import StoreGate, { StoreIndex } from "./storefront/StoreGate";
import OrderTracking from "./storefront/menu/OrderTracking";
import ClienteLayout from "./storefront/cuenta/ClienteLayout";
import PedidosCuenta from "./storefront/cuenta/PedidosCuenta";
import MensajesCuenta from "./storefront/cuenta/MensajesCuenta";
import PerfilCuenta from "./storefront/cuenta/PerfilCuenta";
import DetallePedidoCuenta from "./storefront/cuenta/DetallePedidoCuenta";
import MisPedidosRedirect from "./storefront/MisPedidosRedirect";
import ModifiersPage from "./pages/admin/ModifiersPage";
import KitchenPage from "./pages/admin/KitchenPage";
import ChatPage from "./pages/admin/ChatPage";
import WhatsappPage from "./pages/admin/WhatsappPage";
import SellerAgentPage from "./pages/admin/SellerAgentPage";
import IngredientsPage from "./pages/admin/IngredientsPage";
import SalonPanel from "./salon/SalonPanel";
import Infraestructura from "./salon/Infraestructura";
import CentralImpresion from "./salon/CentralImpresion";
import PdvPersonal from "./salon/PdvPersonal";
import CajaPage from "./salon/CajaPage";
import MonitorPage from "./salon/MonitorPage";

/**
 * Es una SPA: cambiar de página no reinicia el scroll. Al entrar a otra ruta
 * se vuelve arriba (solo cambia con la ruta, no con filtros o búsquedas).
 */
function ScrollAlInicio() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={esES}>
      <AuthProvider>
        <BrowserRouter>
        <ScrollAlInicio />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/suscripcion" element={<Subscribe />} />
          <Route path="/mis-pedidos" element={<MisPedidosRedirect />} />
          {/* Comandero del personal (meseras): entra con nombre y PIN, sin correo */}
          <Route path="/pdv" element={<PdvPersonal />} />
          <Route path="/pdv/:uuid" element={<Navigate to="/pdv" replace />} />

          {/* Tienda pública: sin sesión, es lo que abre el cliente del QR */}
          <Route
            path="/t/:slug"
            element={
              <StoreProvider>
                <StoreGate />
              </StoreProvider>
            }
          >
            <Route index element={<StoreIndex />} />
            <Route path="p/:productSlug" element={<ProductDetail />} />
            <Route path="pedido/:code" element={<OrderTracking />} />
          </Route>

          {/* App del cliente: fuera del diseño de la tienda, con su propia navegación */}
          <Route
            path="/t/:slug/cuenta"
            element={
              <StoreProvider>
                <ClienteLayout />
              </StoreProvider>
            }
          >
            <Route index element={<PedidosCuenta />} />
            <Route path="mensajes" element={<MensajesCuenta />} />
            <Route path="perfil" element={<PerfilCuenta />} />
            <Route path="pedido/:storeSlug/:code" element={<DetallePedidoCuenta />} />
          </Route>

          {/* Superadmin */}
          <Route
            path="/users"
            element={
              <PrivateRoute roles={["superadmin"]}>
                <SuperAdminLayout>
                  <UsersPage />
                </SuperAdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-usage"
            element={
              <PrivateRoute roles={["superadmin"]}>
                <SuperAdminLayout>
                  <AiUsagePage />
                </SuperAdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/plans"
            element={
              <PrivateRoute roles={["superadmin"]}>
                <SuperAdminLayout>
                  <PlansPage />
                </SuperAdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/cobros"
            element={
              <PrivateRoute roles={["superadmin"]}>
                <SuperAdminLayout>
                  <SubscriptionsPage />
                </SuperAdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/businesses"
            element={
              <PrivateRoute roles={["superadmin"]}>
                <SuperAdminLayout>
                  <BusinessesPage />
                </SuperAdminLayout>
              </PrivateRoute>
            }
          />
          {/* Admin (con UUID del negocio) */}
          <Route
            path="/b/:uuid_business/*"
            element={
              <PrivateRoute roles={["admin", "superadmin"]}>
                <BusinessProvider>
                  <AdminLayout />
                </BusinessProvider>
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardAdmin />} />
            <Route path="dashboard" element={<DashboardAdmin />} />
            <Route path="plan" element={<MiPlanPage />} />
            <Route path="orders" element={<ConFuncion f="pedidos_online"><OrdersPage /></ConFuncion>} />
            <Route path="customers" element={<ConFuncion f="pedidos_online"><CustomersPage /></ConFuncion>} />
            <Route path="pos" element={<ConFuncion f="pos"><PosPage /></ConFuncion>} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="reports" element={<ConFuncion f="reportes"><ReportsPage /></ConFuncion>} />
            <Route path="modifiers" element={<ModifiersPage />} />
            <Route path="kitchen" element={<ConFuncion f="cocina"><KitchenPage /></ConFuncion>} />
            <Route path="chat" element={<ConFuncion f="whatsapp"><ChatPage /></ConFuncion>} />
            <Route path="whatsapp" element={<ConFuncion f="whatsapp"><WhatsappPage /></ConFuncion>} />
            <Route path="vendedor-ia" element={<ConFuncion f="vendedor_ia"><SellerAgentPage /></ConFuncion>} />
            <Route path="ingredients" element={<ConFuncion f="insumos"><IngredientsPage /></ConFuncion>} />
            <Route path="salon" element={<ConFuncion f="salon"><SalonPanel /></ConFuncion>} />
            <Route path="infraestructura" element={<ConFuncion f="salon"><Infraestructura /></ConFuncion>} />
            <Route path="salon-config" element={<Navigate to="../infraestructura" replace />} />
            <Route path="impresion" element={<ConFuncion f="salon"><CentralImpresion /></ConFuncion>} />
            <Route path="caja" element={<ConFuncion f="salon"><CajaPage /></ConFuncion>} />
            <Route path="monitor" element={<ConFuncion f="salon"><MonitorPage /></ConFuncion>} />
            {/* Subruta desconocida dentro del panel: al inicio, que para un
                usuario con sesión es su propio tablero. Pintar aquí la pantalla
                completa de 404 la metería dentro del layout. */}
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="store" element={<StoreSettingsPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="discounts" element={<ConFuncion f="promociones"><DiscountsPage /></ConFuncion>} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="attributes" element={<ProductAttributesPage />} />
            <Route path="tags" element={<TagsPage />} />
          </Route>

          {/* Páginas varias */}
          <Route path="/unauthorized" element={<Notfound codigo="403" />} />
          <Route path="*" element={<Notfound />} />
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
