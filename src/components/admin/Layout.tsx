import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useBusiness } from "../../context/BusinessContext";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";
import { useMensajesSinLeer } from "../../hooks/useMensajesSinLeer";

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
  const sinLeer = useMensajesSinLeer(true);
  const { auth } = useAuth();
  const { business } = useBusiness();
  const modoSoporte = auth.user?.role?.name === "superadmin";

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
    <div className="flex min-h-screen flex-col bg-canvas">
      {modoSoporte && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-1.5 text-center text-[12.5px] font-semibold text-amber-950">
          <span>
            Modo soporte: estás dentro de «{business?.name ?? "este negocio"}» como superadmin.
            Lo que cambies aquí lo ve el dueño.
          </span>
          <Link to="/businesses" className="underline">
            Volver a Negocios
          </Link>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      <Sidebar
        open={open}
        setOpen={setOpen}
        movilAbierto={movilAbierto}
        cerrarMovil={() => setMovilAbierto(false)}
        sinLeer={sinLeer}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation abrirMovil={() => setMovilAbierto(true)} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
}
