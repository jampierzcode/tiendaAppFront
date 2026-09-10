import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Tooltip } from "antd";
import { FaBuilding } from "react-icons/fa";
import { RiUserSettingsLine } from "react-icons/ri";
import { TbLogout } from "react-icons/tb";
import { HiOutlineChevronLeft } from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
  movilAbierto: boolean;
  cerrarMovil: () => void;
}

export default function Sidebar({ open, setOpen, movilAbierto, cerrarMovil }: Props) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const items = [
    { titulo: "Negocios", url: "/businesses", icono: <FaBuilding /> },
    { titulo: "Usuarios", url: "/users", icono: <RiUserSettingsLine /> },
  ];

  const contenido = (open: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-1 pt-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-[15px] font-extrabold text-white ring-1 ring-white/20">
          S
        </div>
        {open && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold leading-tight text-white">
              Administración
            </p>
            <p className="text-[11px] leading-tight text-white/50">Todas las tiendas</p>
          </div>
        )}
      </div>

      <nav className="scroll-fino mt-6 flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.url}>
              <Tooltip title={!open ? item.titulo : ""} placement="right" mouseEnterDelay={0.3}>
                <NavLink
                  to={item.url}
                  onClick={cerrarMovil}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                      isActive
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    } ${!open ? "justify-center px-0" : ""}`
                  }
                >
                  <span className="shrink-0 text-lg">{item.icono}</span>
                  {open && <span className="truncate">{item.titulo}</span>}
                </NavLink>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-2.5 ${!open ? "justify-center" : ""}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-[11px] font-bold uppercase text-white">
            {auth.user?.name?.slice(0, 2)}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{auth.user?.name}</p>
              <p className="truncate text-[11px] text-white/50">Superadmin</p>
            </div>
          )}
          {open && (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              aria-label="Cerrar sesión"
              className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <TbLogout className="text-lg" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`relative hidden shrink-0 bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 transition-[width] duration-300 md:block ${
          open ? "w-[248px]" : "w-[76px]"
        }`}
      >
        {contenido(open)}
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Contraer menú" : "Expandir menú"}
          className="absolute -right-3 top-7 z-20 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-ink-soft shadow-sm transition hover:text-brand-600"
        >
          <HiOutlineChevronLeft
            className={`text-xs transition-transform duration-300 ${open ? "" : "rotate-180"}`}
          />
        </button>
      </aside>

      <AnimatePresence>
        {movilAbierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cerrarMovil}
              className="fixed inset-0 z-40 bg-ink/50 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-[248px] bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 md:hidden"
            >
              {contenido(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
