import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tooltip, message } from "antd";
import { TbMenu2, TbExternalLink, TbCopy, TbCheck } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  abrirMovil: () => void;
}

/**
 * Barra superior: el acceso rápido a la tienda pública.
 *
 * Es lo que el dueño necesita a mano todo el día — ver cómo le quedó la
 * tienda y copiar el enlace para pegarlo en su estado de WhatsApp.
 */
export default function TopNavigation({ abrirMovil }: Props) {
  const { uuid_business } = useParams();
  const { auth } = useAuth();
  const esSuperadmin = auth.user?.role?.name === "superadmin";
  const [slug, setSlug] = useState<string | null>(null);
  const [publica, setPublica] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [diasPrueba, setDiasPrueba] = useState<number | null>(null);

  useEffect(() => {
    if (!uuid_business) return;
    apiTienda
      .get(`/businesses/byUuid/${uuid_business}`)
      .then((r) => {
        setSlug(r.data.data?.slug ?? null);
        setPublica(Boolean(r.data.data?.isPublic));
        setDiasPrueba(r.data.data?.trialDaysLeft ?? null);
      })
      .catch(() => undefined);
  }, [uuid_business]);

  const urlTienda = slug ? `${window.location.origin}/t/${slug}` : null;

  const copiar = async () => {
    if (!urlTienda) return;
    try {
      await navigator.clipboard.writeText(urlTienda);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      message.error("No se pudo copiar el enlace");
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={abrirMovil}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-ink-soft transition hover:bg-canvas md:hidden"
        >
          <TbMenu2 className="text-xl" />
        </button>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {diasPrueba !== null && (
            <span className="pill shrink-0 whitespace-nowrap bg-brand-50 text-brand-700">
              Prueba gratis: {diasPrueba} {diasPrueba === 1 ? "día" : "días"}
            </span>
          )}
          {!esSuperadmin && (
          <Link
            to="/suscripcion"
            className="hidden rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-600 sm:block"
          >
            + Nuevo negocio
          </Link>
          )}
          {urlTienda && (
            <>
              <span
                className={`pill hidden whitespace-nowrap sm:inline-flex ${publica ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    publica ? "bg-ok" : "bg-warn"
                  }`}
                />
                {publica ? "Tienda publicada" : "Sin publicar"}
              </span>

              <Tooltip title={copiado ? "¡Copiado!" : "Copiar enlace de la tienda"}>
                <button
                  onClick={copiar}
                  aria-label="Copiar enlace de la tienda"
                  className="hidden rounded-lg border border-line p-2 text-ink-soft transition hover:border-brand-300 hover:text-brand-600 sm:block"
                >
                  {copiado ? (
                    <TbCheck className="text-base text-ok" />
                  ) : (
                    <TbCopy className="text-base" />
                  )}
                </button>
              </Tooltip>

              <a
                href={urlTienda}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-600"
              >
                <TbExternalLink className="text-base" />
                <span className="hidden sm:inline">Ver mi tienda</span>
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
