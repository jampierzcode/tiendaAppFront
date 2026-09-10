import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";

const CLAVE_SIDEBAR = "panel:sidebar-abierto";

export default function AdminLayout() {
  // Se recuerda si el menú quedó contraído: es una preferencia, no un estado
  // que deba reiniciarse en cada navegación.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_SIDEBAR) !== "0";
    } catch {
      return true;
    }
  });
  const [movilAbierto, setMovilAbierto] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_SIDEBAR, open ? "1" : "0");
    } catch {
      // Almacenamiento bloqueado: no pasa nada, se pierde la preferencia.
    }
  }, [open]);

  // Al cambiar de página, el cajón móvil se cierra solo.
  useEffect(() => setMovilAbierto(false), [location.pathname]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        open={open}
        setOpen={setOpen}
        movilAbierto={movilAbierto}
        cerrarMovil={() => setMovilAbierto(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation abrirMovil={() => setMovilAbierto(true)} />
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
