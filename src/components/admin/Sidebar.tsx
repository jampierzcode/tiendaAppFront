import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Tooltip } from "antd";
import {
  IoStorefrontOutline,
  IoSpeedometerOutline,
  IoReceiptOutline,
} from "react-icons/io5";
import { BiCategoryAlt, BiPackage, BiSliderAlt } from "react-icons/bi";
import {
  TbBox,
  TbCashRegister,
  TbChartHistogram,
  TbLogout,
  TbPhoto,
  TbSelector,
  TbTruckLoading,
  TbUsers,
} from "react-icons/tb";
import { MdOutlineDiscount } from "react-icons/md";
import { HiOutlineChevronLeft } from "react-icons/hi2";

import { useAuth } from "../../context/AuthContext";
import { apiTienda } from "../../api/apiTienda";

interface SidebarProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** En móvil el sidebar es un cajón que se superpone. */
  movilAbierto: boolean;
  cerrarMovil: () => void;
}

interface Negocio {
  uuid: string;
  name: string;
}

export default function Sidebar({
  open,
  setOpen,
  movilAbierto,
  cerrarMovil,
}: SidebarProps) {
  const { auth, logout } = useAuth();
  const { uuid_business } = useParams();
  const navigate = useNavigate();

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  useEffect(() => {
    if (!auth.user?.id) return;
    apiTienda
      .get("/businesses/byUser")
      .then((r) => setNegocios(r.data.data ?? []))
      .catch(() => undefined);
  }, [auth.user?.id]);

  const negocioActual = negocios.find((n) => n.uuid === uuid_business);

  const secciones = [
    {
      items: [
        {
          titulo: "Resumen",
          url: `/b/${uuid_business}/dashboard`,
          icono: <IoSpeedometerOutline />,
        },
        {
          titulo: "Mostrador",
          url: `/b/${uuid_business}/pos`,
          icono: <TbCashRegister />,
        },
        {
          titulo: "Pedidos",
          url: `/b/${uuid_business}/orders`,
          icono: <IoReceiptOutline />,
        },
        {
          titulo: "Clientes",
          url: `/b/${uuid_business}/customers`,
          icono: <TbUsers />,
        },
        {
          titulo: "Reportes",
          url: `/b/${uuid_business}/reports`,
          icono: <TbChartHistogram />,
        },
      ],
    },
    {
      titulo: "Catálogo",
      items: [
        { titulo: "Productos", url: `/b/${uuid_business}/products`, icono: <BiPackage /> },
        { titulo: "Categorías", url: `/b/${uuid_business}/categories`, icono: <BiCategoryAlt /> },
        { titulo: "Atributos", url: `/b/${uuid_business}/attributes`, icono: <BiSliderAlt /> },
        { titulo: "Inventario", url: `/b/${uuid_business}/inventory`, icono: <TbBox /> },
        { titulo: "Galería", url: `/b/${uuid_business}/gallery`, icono: <TbPhoto /> },
        { titulo: "Descuentos", url: `/b/${uuid_business}/discounts`, icono: <MdOutlineDiscount /> },
      ],
    },
    {
      titulo: "Abastecimiento",
      items: [
        {
          titulo: "Compras",
          url: `/b/${uuid_business}/purchases`,
          icono: <TbTruckLoading />,
        },
      ],
    },
    {
      titulo: "Tienda online",
      items: [
        {
          titulo: "Mi tienda",
          url: `/b/${uuid_business}/store`,
          icono: <IoStorefrontOutline />,
        },
      ],
    },
  ];

  const contenido = (open: boolean) => (
    <div className="flex h-full flex-col">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-4 pb-1 pt-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-[15px] font-extrabold text-white ring-1 ring-white/20">
          {negocioActual?.name?.charAt(0) ?? "T"}
        </div>
        {open && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold leading-tight text-white">
              {negocioActual?.name ?? "Tu tienda"}
            </p>
            <p className="text-[11px] leading-tight text-white/50">Panel de gestión</p>
          </div>
        )}
      </div>

      {/* Selector de negocio, solo si hay más de uno */}
      {open && negocios.length > 1 && (
        <div className="relative mt-4 px-3">
          <button
            onClick={() => setSelectorAbierto((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2 text-left text-[13px] font-medium text-white transition hover:bg-white/15"
          >
            <span className="truncate">{negocioActual?.name ?? "Elegir tienda"}</span>
            <TbSelector className="shrink-0 text-white/60" />
          </button>

          <AnimatePresence>
            {selectorAbierto && (
              <motion.ul
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-x-3 z-30 mt-1 overflow-hidden rounded-lg bg-white py-1 shadow-lg"
              >
                {negocios.map((n) => (
                  <li key={n.uuid}>
                    <button
                      onClick={() => {
                        setSelectorAbierto(false);
                        navigate(`/b/${n.uuid}/dashboard`);
                      }}
                      className={`w-full px-3 py-2 text-left text-[13px] transition hover:bg-brand-50 ${
                        n.uuid === uuid_business
                          ? "font-semibold text-brand-600"
                          : "text-ink-soft"
                      }`}
                    >
                      {n.name}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Navegación */}
      <nav className="scroll-fino mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {secciones.map((seccion, i) => (
          <div key={i}>
            {seccion.titulo && open && (
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.11em] text-white/40">
                {seccion.titulo}
              </p>
            )}
            {seccion.titulo && !open && i > 0 && (
              <div className="mx-3 mb-2 h-px bg-white/10" />
            )}

            <ul className="space-y-0.5">
              {seccion.items.map((item) => (
                <li key={item.url}>
                  <Tooltip
                    title={!open ? item.titulo : ""}
                    placement="right"
                    mouseEnterDelay={0.3}
                  >
                    <NavLink
                      to={item.url}
                      onClick={cerrarMovil}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
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
          </div>
        ))}
      </nav>

      {/* Usuario y salida */}
      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-2.5 ${!open ? "justify-center" : ""}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-[11px] font-bold uppercase text-white">
            {auth.user?.name?.slice(0, 2)}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">
                {auth.user?.name}
              </p>
              <p className="truncate text-[11px] text-white/50">{auth.user?.email}</p>
            </div>
          )}
          <Tooltip title="Cerrar sesión" placement="right">
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              aria-label="Cerrar sesión"
              className={`rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white ${
                !open ? "hidden" : ""
              }`}
            >
              <TbLogout className="text-lg" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio */}
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

      {/* Móvil */}
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
