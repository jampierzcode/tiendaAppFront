import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { TbLock } from "react-icons/tb";
import { useFunciones } from "../../context/BusinessContext";
import { NOMBRE_FUNCION } from "../../utilities/planes";

/**
 * Muestra la pantalla solo si el plan del negocio incluye la función; si no,
 * una invitación a mejorar el plan. El backend bloquea igual (403
 * `plan_required`): esto es para que el dueño entienda por qué.
 */
export default function ConFuncion({ f, children }: { f: string; children: ReactNode }) {
  const { tiene } = useFunciones();
  if (tiene(f)) return <>{children}</>;
  return <PlanBloqueado funcion={f} />;
}

export function PlanBloqueado({ funcion }: { funcion: string }) {
  const { uuid_business } = useParams();
  const { planLabel } = useFunciones();
  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <div className="card px-6 py-10">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl text-brand-600">
          <TbLock />
        </div>
        <h1 className="text-[20px] font-bold text-ink">
          {NOMBRE_FUNCION[funcion] ?? "Esta función"} no está en tu plan
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {planLabel ? `Tu plan actual es «${planLabel}». ` : ""}
          Mejora tu plan para usarla: se activa al instante, sin perder nada de lo que ya tienes.
        </p>
        <Link
          to={`/b/${uuid_business}/plan`}
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-700"
        >
          Ver planes
        </Link>
      </div>
    </div>
  );
}
