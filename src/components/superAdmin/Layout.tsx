import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [movilAbierto, setMovilAbierto] = useState(false);
  const location = useLocation();

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
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
