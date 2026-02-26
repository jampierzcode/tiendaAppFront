import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

import type React from "react";

interface PrivateRouteProps {
  children: React.ReactElement;
  roles?: string[]; // roles permitidos opcionales
}

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { auth, loading } = useAuth();

  // Espera a que termine de cargar el contexto antes de decidir
  if (loading) {
    return null; // o un spinner si quieres
  }

  // Si no está autenticado, redirige al login
  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = auth.user.role?.name ?? "";

  // Si hay restricción de roles y el usuario no pertenece
  if (roles && !roles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Si todo bien, renderiza el contenido protegido
  return <>{children}</>;
}
