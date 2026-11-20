import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
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
  TbTag,
  TbCashRegister,
  TbBrandWhatsapp,
  TbChevronDown,
  TbChartHistogram,
  TbChefHat,
  TbArmchair,
  TbToolsKitchen2,
  TbClipboardCheck,
  TbArrowsExchange,
  TbChartPie,
  TbFlame,
  TbCash,
  TbPrinter,
  TbSettings,
  TbLogout,
  TbLock,
  TbCrown,
  TbMessageCircle,
  TbPhoto,
  TbRobot,
  TbSelector,
  TbTruckLoading,
  TbUsers,
} from "react-icons/tb";
import { MdOutlineDiscount } from "react-icons/md";
import { HiOutlineChevronLeft } from "react-icons/hi2";

import { useAuth } from "../../context/AuthContext";
import { apiTienda } from "../../api/apiTienda";
import { useBusiness, useFunciones } from "../../context/BusinessContext";
import { FUNCION_DE_PANTALLA } from "../../utilities/planes";

interface SidebarProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** En móvil el sidebar es un cajón que se superpone. */
  movilAbierto: boolean;
  cerrarMovil: () => void;
  /** Mensajes de WhatsApp sin leer: globito en «Mensajes». */
  sinLeer?: number;
  /** Mensajes de clientes en la plataforma sin leer: globito en Pedidos (y Cocina). */
  pedidosSinLeer?: number;
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
  sinLeer = 0,
  pedidosSinLeer = 0,
}: SidebarProps) {
  const { auth, logout } = useAuth();
  const { uuid_business } = useParams();
  const navigate = useNavigate();

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const { pathname } = useLocation();

  // Secciones plegables: se recuerda lo que el usuario abrió o cerró. Sin
  // preferencia guardada, solo se abre la sección de la pantalla actual.
  const [plegadas, setPlegadas] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("sidebar_secciones") ?? "{}");
    } catch {
      return {};
    }
  });
  const alternar = (titulo: string, abierta: boolean) => {
    const nuevo = { ...plegadas, [titulo]: abierta };
    setPlegadas(nuevo);
    localStorage.setItem("sidebar_secciones", JSON.stringify(nuevo));
  };

  useEffect(() => {
    if (!auth.user?.id) return;
    apiTienda
      .get("/businesses/byUser")
      .then((r) => setNegocios(r.data.data ?? []))
      .catch(() => undefined);
  }, [auth.user?.id]);

  // El negocio abierto viene del contexto (consulta por uuid, que también
  // permite el superadmin); `byUser` solo trae los negocios propios.
  const { business } = useBusiness();
  const negocioActual =
    (business as Negocio | null) ?? negocios.find((n) => n.uuid === uuid_business);
  const esRestaurante =
    ((negocioActual as any)?.businessType ?? (negocioActual as any)?.business_type) === "restaurant";
  const { tiene } = useFunciones();
  /** ¿La pantalla del item está fuera del plan? Se muestra con candado y lleva a «Mi plan». */
  const bloqueada = (url: string) => {
    const f = FUNCION_DE_PANTALLA[url.split("/").pop() ?? ""];
    return Boolean(f && !tiene(f));
  };

  /**
   * Restaurante: el menú se ordena por lo que se hace en el día. Operación
   * arriba (vender, cocina, caja), luego catálogo, reportes y configuración.
   */
  const seccionesRestaurante = [
    {
      items: [{ titulo: "Resumen", url: `/b/${uuid_business}/dashboard`, icono: <IoSpeedometerOutline /> }],
    },
    {
      titulo: "Operación",
      items: [
        { titulo: "Punto de venta", url: `/b/${uuid_business}/salon`, icono: <TbCashRegister /> },
        { titulo: "Pedidos online", url: `/b/${uuid_business}/orders`, icono: <IoReceiptOutline />, badge: pedidosSinLeer },
        { titulo: "Monitor de producción", url: `/b/${uuid_business}/monitor`, icono: <TbFlame /> },
        { titulo: "Caja y cortes", url: `/b/${uuid_business}/caja`, icono: <TbCash /> },
      ],
    },
    {
      titulo: "Catálogo",
      items: [
        { titulo: "Platos", url: `/b/${uuid_business}/products`, icono: <BiPackage /> },
        { titulo: "Categorías", url: `/b/${uuid_business}/categories`, icono: <BiCategoryAlt /> },
        { titulo: "Modificadores", url: `/b/${uuid_business}/modifiers`, icono: <BiSliderAlt /> },
        { titulo: "Promociones", url: `/b/${uuid_business}/discounts`, icono: <MdOutlineDiscount /> },
        { titulo: "Galería", url: `/b/${uuid_business}/gallery`, icono: <TbPhoto /> },
      ],
    },
    {
      titulo: "Inventario",
      items: [
        { titulo: "Existencias", url: `/b/${uuid_business}/ingredients`, icono: <TbBox /> },
        { titulo: "Recetas", url: `/b/${uuid_business}/recetas`, icono: <TbToolsKitchen2 /> },
        { titulo: "Compras", url: `/b/${uuid_business}/compras-insumos`, icono: <TbTruckLoading /> },
        { titulo: "Conteo físico", url: `/b/${uuid_business}/conteo`, icono: <TbClipboardCheck /> },
        { titulo: "Movimientos", url: `/b/${uuid_business}/movimientos`, icono: <TbArrowsExchange /> },
        { titulo: "Reportes", url: `/b/${uuid_business}/reportes-inventario`, icono: <TbChartPie /> },
      ],
    },
    {
      titulo: "Reportes",
      items: [
        { titulo: "Ventas", url: `/b/${uuid_business}/reports`, icono: <TbChartHistogram /> },
        { titulo: "Clientes", url: `/b/${uuid_business}/customers`, icono: <TbUsers /> },
      ],
    },
    {
      titulo: "Configuración",
      items: [
        { titulo: "Infraestructura", url: `/b/${uuid_business}/infraestructura`, icono: <TbSettings /> },
        { titulo: "Central de impresión", url: `/b/${uuid_business}/impresion`, icono: <TbPrinter /> },
        { titulo: "Mi plan", url: `/b/${uuid_business}/plan`, icono: <TbCrown /> },
      ],
    },
    {
      titulo: "Tienda online",
      items: [
        { titulo: "Mi tienda", url: `/b/${uuid_business}/store`, icono: <IoStorefrontOutline /> },
        { titulo: "Mensajes", url: `/b/${uuid_business}/chat`, icono: <TbMessageCircle />, badge: sinLeer },
        { titulo: "WhatsApp", url: `/b/${uuid_business}/whatsapp`, icono: <TbBrandWhatsapp /> },
        { titulo: "Vendedor IA", url: `/b/${uuid_business}/vendedor-ia`, icono: <TbRobot /> },
      ],
    },
  ];

  const seccionesTienda = [
    {
      items: [
        {
          titulo: "Resumen",
          url: `/b/${uuid_business}/dashboard`,
          icono: <IoSpeedometerOutline />,
        },
        ...(esRestaurante
          ? []
          : [
              {
                titulo: "Mostrador",
                url: `/b/${uuid_business}/pos`,
                icono: <TbCashRegister />,
              },
            ]),
        {
          titulo: "Pedidos",
          url: `/b/${uuid_business}/orders`,
          icono: <IoReceiptOutline />,
          badge: pedidosSinLeer,
        },
        ...(esRestaurante
          ? [
              {
                titulo: "Salón",
                url: `/b/${uuid_business}/salon`,
                icono: <TbArmchair />,
              },
              {
                titulo: "Cocina",
                url: `/b/${uuid_business}/kitchen`,
                icono: <TbChefHat />,
                badge: pedidosSinLeer,
              },
            ]
          : []),
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
        {
          titulo: esRestaurante ? "Platos" : "Productos",
          url: `/b/${uuid_business}/products`,
          icono: <BiPackage />,
        },
        { titulo: "Categorías", url: `/b/${uuid_business}/categories`, icono: <BiCategoryAlt /> },
        ...(esRestaurante ? [] : [{ titulo: "Etiquetas", url: `/b/${uuid_business}/tags`, icono: <TbTag /> }]),
        ...(esRestaurante
          ? [
              {
                titulo: "Modificadores",
                url: `/b/${uuid_business}/modifiers`,
                icono: <BiSliderAlt />,
              },
              {
                titulo: "Insumos",
                url: `/b/${uuid_business}/ingredients`,
                icono: <TbBox />,
              },
            ]
          : [
              { titulo: "Atributos", url: `/b/${uuid_business}/attributes`, icono: <BiSliderAlt /> },
              { titulo: "Inventario", url: `/b/${uuid_business}/inventory`, icono: <TbBox /> },
            ]),
        { titulo: "Galería", url: `/b/${uuid_business}/gallery`, icono: <TbPhoto /> },
        { titulo: "Promociones", url: `/b/${uuid_business}/discounts`, icono: <MdOutlineDiscount /> },
      ],
    },
    ...(esRestaurante
      ? []
      : [
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
        ]),
    ...(esRestaurante
      ? [
          {
            titulo: "Salón",
            items: [
              {
                titulo: "Caja y cortes",
                url: `/b/${uuid_business}/caja`,
                icono: <TbCash />,
              },
              {
                titulo: "Monitor de producción",
                url: `/b/${uuid_business}/monitor`,
                icono: <TbFlame />,
              },
              {
                titulo: "Infraestructura",
                url: `/b/${uuid_business}/infraestructura`,
                icono: <TbSettings />,
              },
              {
                titulo: "Central de impresión",
                url: `/b/${uuid_business}/impresion`,
                icono: <TbPrinter />,
              },
            ],
          },
        ]
      : []),
    {
      titulo: "Tienda online",
      items: [
        {
          titulo: "Mi tienda",
          url: `/b/${uuid_business}/store`,
          icono: <IoStorefrontOutline />,
        },
        {
          titulo: "Mensajes",
          url: `/b/${uuid_business}/chat`,
          icono: <TbMessageCircle />,
          badge: sinLeer,
        },
        {
          titulo: "WhatsApp",
          url: `/b/${uuid_business}/whatsapp`,
          icono: <TbBrandWhatsapp />,
        },
        {
          titulo: "Vendedor IA",
          url: `/b/${uuid_business}/vendedor-ia`,
          icono: <TbRobot />,
        },
      ],
    },
    {
      titulo: "Cuenta",
      items: [{ titulo: "Mi plan", url: `/b/${uuid_business}/plan`, icono: <TbCrown /> }],
    },
  ];

  const secciones = esRestaurante ? seccionesRestaurante : seccionesTienda;

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
      <nav className="scroll-fino mt-5 flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        {secciones.map((seccion, i) => {
          const activa = seccion.items.some((it) => pathname.startsWith(it.url));
          // Con el menú angosto (solo íconos) no se pliega nada.
          const abierta =
            !open || !seccion.titulo || activa || (plegadas[seccion.titulo] ?? false);
          const avisos = seccion.items.reduce(
            (t, it) => t + ("badge" in it ? Number(it.badge) || 0 : 0),
            0
          );
          return (
          <div key={i}>
            {seccion.titulo && open && (
              <button
                type="button"
                onClick={() => !activa && alternar(seccion.titulo!, !abierta)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.11em] transition ${
                  activa ? "cursor-default text-white/60" : "text-white/40 hover:bg-white/5 hover:text-white/70"
                }`}
              >
                <span className="flex-1">{seccion.titulo}</span>
                {!abierta && avisos > 0 && (
                  <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold normal-case leading-4 tracking-normal text-white">
                    {avisos}
                  </span>
                )}
                {!activa && (
                  <TbChevronDown
                    className={`shrink-0 text-[13px] transition-transform ${abierta ? "rotate-180" : ""}`}
                  />
                )}
              </button>
            )}
            {seccion.titulo && !open && i > 0 && (
              <div className="mx-3 mb-2 h-px bg-white/10" />
            )}

            {abierta && (
            <ul className="mt-0.5 space-y-0.5">
              {seccion.items.map((item) => (
                <li key={item.url}>
                  <Tooltip
                    title={!open ? item.titulo : ""}
                    placement="right"
                    mouseEnterDelay={0.3}
                  >
                    <NavLink
                      to={bloqueada(item.url) ? `/b/${uuid_business}/plan` : item.url}
                      onClick={cerrarMovil}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                          isActive && !bloqueada(item.url)
                            ? "bg-white text-brand-700 shadow-sm"
                            : "text-white/75 hover:bg-white/10 hover:text-white"
                        } ${!open ? "justify-center px-0" : ""}`
                      }
                    >
                      <span className="shrink-0 text-lg">{item.icono}</span>
                      {open && <span className="truncate">{item.titulo}</span>}
                      {bloqueada(item.url) && open && (
                        <TbLock className="ml-auto shrink-0 text-[13px] opacity-60" aria-label="No incluido en tu plan" />
                      )}
                      {!bloqueada(item.url) && "badge" in item && Number(item.badge) > 0 && (
                        <span
                          className={`rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white ${
                            open ? "ml-auto" : "absolute right-1.5 top-1.5"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </Tooltip>
                </li>
              ))}
            </ul>
            )}
          </div>
          );
        })}
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
        // Fijo al hacer scroll: ocupa el alto de la ventana y el menú se
        // desplaza por dentro si no cabe.
        className={`sticky top-0 z-40 hidden h-screen shrink-0 self-start bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 transition-[width] duration-300 md:block ${
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
