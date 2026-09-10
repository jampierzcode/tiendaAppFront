import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import { antdTheme } from "./theme/antdTheme";
import Login from "./pages/Login";
import { UsersPage } from "./pages/superadmin/Users";
import { BusinessesPage } from "./pages/superadmin/Business";
import Notfound from "./pages/Notfound";
import PrivateRoute from "./layouts/PrivateRoute";
import SuperAdminLayout from "./components/superAdmin/Layout";
import AdminLayout from "./components/admin/Layout";
import { BusinessProvider } from "./context/BusinessContext";
import { CategoriesPage } from "./pages/admin/CategoryProduct";
import ProductAttributesPage from "./pages/admin/ProductAttributesPage";
import ProductsPage from "./pages/admin/ProductsPage";
import DashboardAdmin from "./pages/admin/DashboardAdmin";
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
import StoreLayout from "./storefront/StoreLayout";
import StoreHome from "./storefront/StoreHome";
import ProductDetail from "./storefront/ProductDetail";

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={esES}>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          {/* Tienda pública: sin sesión, es lo que abre el cliente del QR */}
          <Route
            path="/t/:slug"
            element={
              <StoreProvider>
                <StoreLayout />
              </StoreProvider>
            }
          >
            <Route index element={<StoreHome />} />
            <Route path="p/:productSlug" element={<ProductDetail />} />
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
              <PrivateRoute roles={["admin"]}>
                <BusinessProvider>
                  <AdminLayout />
                </BusinessProvider>
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardAdmin />} />
            <Route path="dashboard" element={<DashboardAdmin />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="pos" element={<PosPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            {/* Subruta desconocida dentro del panel: al inicio, que para un
                usuario con sesión es su propio tablero. Pintar aquí la pantalla
                completa de 404 la metería dentro del layout. */}
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="store" element={<StoreSettingsPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="discounts" element={<DiscountsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="attributes" element={<ProductAttributesPage />} />
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
