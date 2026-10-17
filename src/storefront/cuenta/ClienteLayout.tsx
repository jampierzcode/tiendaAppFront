import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../StoreContext";
import { storeApi } from "../api";
import { avisar, usePermisoAvisos } from "../../hooks/useAvisos";
import { activarPush, escucharServiceWorker, pushSoportado } from "../../utilities/push";
import {
  cabeceraCliente,
  ligarPedidosDeEsteNavegador,
  misPedidos,
  useCliente,
  type Cliente,
  type PedidoCuenta,
} from "../cliente";
import Acceso from "./Acceso";
import { IconoMensajes, IconoPedidos, IconoPerfil, IconoSalir, IconoTienda } from "./iconos";

export interface ContextoCuenta {
  cliente: Cliente;
  /** null mientras carga la primera vez. */
  pedidos: PedidoCuenta[] | null;
  recargar: () => void;
  salir: () => void;
}

/**
 * La app del cliente: barra lateral en escritorio, solo iconos en tableta y
 * barra de pestañas abajo en el móvil. Sirve para todas las tiendas donde el
 * cliente compra; la tienda por la que entró solo pone la marca (logo, color).
 */
export default function ClienteLayout() {
  const { slug, tienda } = useStore();
  const { cliente, cargando, salir } = useCliente();
  const [pedidos, setPedidos] = useState<PedidoCuenta[] | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { permiso, pedir } = usePermisoAvisos();
  // Marca del último mensaje de tienda ya avisado: solo suena lo que llega después de abrir la app.
  const avisado = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await misPedidos();
      setPedidos(lista);

      const ultimo = lista
        .filter((p) => p.unreadMessages > 0 && p.lastDirection === "out")
        .map((p) => ({ clave: `${p.storeSlug}:${p.code}:${p.unreadMessages}:${p.lastMessage}`, p }))[0];
      if (avisado.current !== null && ultimo && ultimo.clave !== avisado.current) {
        avisar(ultimo.p.storeName, ultimo.p.lastMessage ?? "Tienes un mensaje nuevo", `msg-${ultimo.p.code}`);
      }
      avisado.current = ultimo?.clave ?? "";
    } catch {
      setPedidos((p) => p ?? []);
    }
  }, []);

  // Con el permiso ya dado, la suscripción push se renueva sola; el service worker refresca o navega.
  useEffect(() => {
    if (!cliente) return;
    if (pushSoportado() && Notification.permission === "granted") {
      activarPush(storeApi, "", cabeceraCliente());
    }
    return escucharServiceWorker(cargar, (ruta) => navigate(ruta));
  }, [cliente, cargar, navigate]);

  const activarAvisos = async () => {
    await pedir();
    await activarPush(storeApi, "", cabeceraCliente(), true);
  };

  // Al entrar se ligan los pedidos hechos en este navegador sin cuenta; luego se actualiza cada 20 s.
  useEffect(() => {
    if (!cliente) {
      setPedidos(null);
      return;
    }
    let vivo = true;
    ligarPedidosDeEsteNavegador().finally(() => vivo && cargar());
    const t = setInterval(() => !document.hidden && cargar(), 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [cliente, cargar]);

  if (cargando) {
    return <div className="min-h-screen bg-neutral-50 p-6"><div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-neutral-200" /></div>;
  }

  const marca = (
    <>
      {tienda?.logoUrl ? (
        <img src={tienda.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
      ) : (
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-black text-white"
          style={{ backgroundColor: "var(--tienda-primario)" }}
        >
          {(tienda?.name ?? "T").charAt(0)}
        </span>
      )}
    </>
  );

  if (!cliente) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <header className="flex items-center gap-3 px-5 py-4">
          {marca}
          <span className="truncate text-base font-bold">{tienda?.name}</span>
          <Link to={`/t/${slug}`} className="ml-auto text-sm font-semibold underline">
            Ir a la tienda
          </Link>
        </header>
        <div className="mx-auto w-full max-w-md px-4 pb-10 pt-2">
          <Acceso slug={slug} nombreTienda={tienda?.name ?? ""} />
        </div>
      </div>
    );
  }

  const sinLeer = (pedidos ?? []).reduce((t, p) => t + p.unreadMessages, 0);
  const raiz = `/t/${slug}/cuenta`;
  const items = [
    { to: raiz, fin: true, texto: "Mis pedidos", icono: <IconoPedidos />, badge: 0 },
    { to: `${raiz}/mensajes`, fin: false, texto: "Mensajes", icono: <IconoMensajes />, badge: sinLeer },
    { to: `${raiz}/perfil`, fin: false, texto: "Mi perfil", icono: <IconoPerfil />, badge: 0 },
  ];

  const clase = (activo: boolean) =>
    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition md:justify-center lg:justify-start ${
      activo ? "text-white" : "text-neutral-600 hover:bg-neutral-100"
    }`;
  const fondoActivo = { backgroundColor: "var(--tienda-primario)" };
  const globo = (n: number) =>
    n > 0 ? (
      <span className="absolute right-1.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white lg:static lg:ml-auto lg:h-5 lg:min-w-5 lg:text-[11px]">
        {n > 9 ? "9+" : n}
      </span>
    ) : null;

  const detalle = location.pathname.includes("/cuenta/pedido/");

  return (
    <div className="min-h-screen bg-neutral-50 md:flex">
      {/* Tableta y escritorio: barra lateral */}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-neutral-200 bg-white p-3 md:flex md:w-[76px] lg:w-64 lg:p-4">
        <Link to={raiz} className="mb-5 flex items-center gap-3 md:justify-center lg:justify-start">
          {marca}
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-extrabold leading-tight">{tienda?.name}</span>
            <span className="block text-[11px] text-neutral-500">Mi cuenta</span>
          </span>
        </Link>

        <nav className="space-y-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.fin} title={it.texto}>
              {({ isActive }) => (
                <span className={clase(isActive)} style={isActive ? fondoActivo : undefined}>
                  {it.icono}
                  <span className="hidden lg:inline">{it.texto}</span>
                  {globo(it.badge)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-neutral-100 pt-3">
          <Link to={`/t/${slug}`} title="Ir a la tienda" className={clase(false)}>
            <IconoTienda />
            <span className="hidden lg:inline">Ir a la tienda</span>
          </Link>
          <button onClick={salir} title="Cerrar sesión" className={`${clase(false)} w-full`}>
            <IconoSalir />
            <span className="hidden lg:inline">Cerrar sesión</span>
          </button>
          <p className="hidden truncate px-3 pt-1 text-[11px] text-neutral-400 lg:block">{cliente.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Móvil: barra superior con la marca y acceso a la tienda */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
          {marca}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold leading-tight">{tienda?.name}</span>
            <span className="block text-[11px] text-neutral-500">Mi cuenta</span>
          </span>
          <Link to={`/t/${slug}`} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold">
            Ir a la tienda
          </Link>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10" key={detalle ? "d" : "l"}>
          {pushSoportado() && permiso === "default" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>Activa los avisos para enterarte cuando la tienda te escriba o cambie tu pedido.</span>
              <button onClick={activarAvisos} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold shadow-sm">
                Activar avisos
              </button>
            </div>
          )}
          <Outlet context={{ cliente, pedidos, recargar: cargar, salir } satisfies ContextoCuenta} />
        </main>
      </div>

      {/* Móvil: pestañas abajo */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.fin} className="relative">
            {({ isActive }) => (
              <span
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  isActive ? "" : "text-neutral-500"
                }`}
                style={isActive ? { color: "var(--tienda-primario)" } : undefined}
              >
                {it.icono}
                {it.texto.replace("Mis ", "").replace("Mi ", "")}
                {it.badge > 0 && (
                  <span className="absolute right-1/4 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
        <Link to={`/t/${slug}`} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-neutral-500">
          <IconoTienda />
          Tienda
        </Link>
      </nav>
    </div>
  );
}
