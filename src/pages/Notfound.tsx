import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { TbArrowLeft, TbHome } from "react-icons/tb";

interface Props {
  /** 404 por defecto; 403 cuando el rol no alcanza. */
  codigo?: "404" | "403";
}

const textos = {
  "404": {
    titulo: "Esta página no existe",
    detalle:
      "El enlace puede estar mal escrito, o la página se movió. Te llevamos al inicio.",
  },
  "403": {
    titulo: "No tienes acceso aquí",
    detalle:
      "Tu cuenta no tiene permiso para ver esta sección. Te llevamos al inicio.",
  },
};

const SEGUNDOS = 5;

export default function Notfound({ codigo = "404" }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [restante, setRestante] = useState(SEGUNDOS);

  // Cuenta atrás visible en vez de un salto brusco: quien llegó por un enlace
  // roto merece ver qué pasó antes de que la pantalla cambie sola.
  useEffect(() => {
    const tic = setInterval(() => setRestante((s) => s - 1), 1000);
    const salto = setTimeout(() => navigate("/", { replace: true }), SEGUNDOS * 1000);

    return () => {
      clearInterval(tic);
      clearTimeout(salto);
    };
  }, [navigate]);

  const { titulo, detalle } = textos[codigo];

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-brand-600 via-brand-800 to-brand-950 px-6">
      {/* Formas del fondo, como en la marca */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-brand-400/20" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md text-center"
      >
        <motion.p
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-[76px] font-extrabold leading-none tracking-tight text-white/25"
        >
          {codigo}
        </motion.p>

        <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-white">
          {titulo}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-white/70">
          {detalle}
        </p>

        {location.pathname !== "/" && (
          <p className="mt-3 break-all font-mono text-[11px] text-white/40">
            {location.pathname}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <button
            onClick={() => navigate("/", { replace: true })}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[14px] font-bold text-brand-700 transition hover:bg-white/90"
          >
            <TbHome className="text-base" />
            Ir al inicio
          </button>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-white/10"
          >
            <TbArrowLeft className="text-base" />
            Volver
          </button>
        </div>

        <div className="mx-auto mt-7 w-48">
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: SEGUNDOS, ease: "linear" }}
              className="h-full rounded-full bg-white/60"
            />
          </div>
          <p className="mt-2 text-[12px] text-white/50">
            {restante > 0
              ? `Te llevamos al inicio en ${restante}…`
              : "Redirigiendo…"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
