import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import "@ant-design/v5-patch-for-react-19";
import { Result } from "antd";
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

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
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="attributes" element={<ProductAttributesPage />} />
            {/* Aquí luego agregas más rutas como: */}
            {/* <Route path="gallery" element={<GalleryPage />} /> */}
          </Route>

          {/* Páginas varias */}
          <Route
            path="/unauthorized"
            element={
              <Result
                status="403"
                title="403"
                subTitle="No tienes permiso para ver esta página"
              />
            }
          />
          <Route path="*" element={<Notfound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
