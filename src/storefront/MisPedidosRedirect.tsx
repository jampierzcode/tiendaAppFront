import { Navigate } from "react-router-dom";

/** Entrada genérica para clientes: lleva a «Mi cuenta» de la última tienda visitada. */
export default function MisPedidosRedirect() {
  let slug: string | null = null;
  try {
    slug = localStorage.getItem("cliente:ultima-tienda");
  } catch {
    // sin almacenamiento
  }
  return <Navigate to={slug ? `/t/${slug}/cuenta` : "/"} replace />;
}
