import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Segmented, Spin, Table, Tag } from "antd";
import { TbCheck, TbLock, TbBrandWhatsapp } from "react-icons/tb";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import { useBusiness } from "../../context/BusinessContext";
import type { FuncionCatalogo, Plan, Suscripcion } from "../../types/main";
import {
  ESTADO_SUSCRIPCION,
  INTERVALO,
  aplicaA,
  soles,
  textoDescuento,
} from "../../utilities/planes";

interface Datos {
  plan: Plan | null;
  planLabel: string | null;
  legacy: boolean;
  subscriptionStatus: "trial" | "active" | "expired";
  trialEndsAt: string | null;
  paidUntil: string | null;
  daysLeft: number | null;
  funciones: string[];
  features: FuncionCatalogo[];
  subscriptions: Suscripcion[];
  plans: Plan[];
  soporteWhatsapp: string | null;
}

interface NegocioCuenta {
  uuid: string;
  name: string;
  planLabel?: string | null;
  effectiveSubscriptionStatus?: "trial" | "active" | "expired";
  subscriptionDaysLeft?: number | null;
}

const ESTADO_NEGOCIO = {
  trial: { texto: "En prueba", clase: "bg-info-bg text-info" },
  active: { texto: "Activo", clase: "bg-ok-bg text-ok" },
  expired: { texto: "Vencido", clase: "bg-danger-bg text-danger" },
} as const;

/** "Mi plan": qué tengo, hasta cuándo, qué he pagado y qué me falta. */
export default function MiPlanPage() {
  const { uuid_business } = useParams();
  const { business } = useBusiness();
  const [d, setD] = useState<Datos | null>(null);
  const [negocios, setNegocios] = useState<NegocioCuenta[]>([]);
  const [intervalo, setIntervalo] = useState<"month" | "year">("month");

  useEffect(() => {
    apiTienda
      .get("/plan")
      .then((r) => setD(r.data.data))
      .catch(() => undefined);
    apiTienda
      .get("/businesses/byUser")
      .then((r) => setNegocios(r.data.data ?? []))
      .catch(() => undefined);
  }, [uuid_business]);

  const whatsapp = (texto: string) =>
    d?.soporteWhatsapp
      ? `https://wa.me/${d.soporteWhatsapp}?text=${encodeURIComponent(texto)}`
      : null;

  const fin = d?.subscriptionStatus === "trial" ? d.trialEndsAt : d?.paidUntil;
  const tipo = business?.businessType ?? business?.business_type ?? null;
  const estado = d ? ESTADO_NEGOCIO[d.subscriptionStatus] : null;

  const columnas = useMemo(
    () => [
      { title: "Plan", dataIndex: "planName", key: "plan" },
      {
        title: "Período",
        key: "periodo",
        render: (_: unknown, s: Suscripcion) =>
          `${dayjs(s.startsAt).format("DD/MM/YYYY")} → ${dayjs(s.endsAt).format("DD/MM/YYYY")}`,
      },
      {
        title: "Detalle",
        key: "detalle",
        render: (_: unknown, s: Suscripcion) =>
          s.interval === "trial"
            ? `Prueba gratis · ${s.quantity} días`
            : `${s.quantity} ${s.quantity === 1 ? INTERVALO[s.interval].uno : INTERVALO[s.interval].varios} × ${soles(s.unitPrice)}`,
      },
      {
        title: "Total",
        key: "total",
        render: (_: unknown, s: Suscripcion) => (
          <div>
            <div>{soles(s.total)}</div>
            {textoDescuento(s) && (
              <div className="text-[12px] text-ok">
                Descuento {textoDescuento(s)}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Estado",
        key: "estado",
        render: (_: unknown, s: Suscripcion) => (
          <Tag color={ESTADO_SUSCRIPCION[s.state]?.color}>
            {ESTADO_SUSCRIPCION[s.state]?.texto}
          </Tag>
        ),
      },
    ],
    [],
  );

  if (!d) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const enlaceRenovar = whatsapp(
    `Hola, quiero renovar mi plan${d.planLabel ? ` «${d.planLabel}»` : ""} de «${business?.name ?? ""}».`,
  );

  return (
    <>
      <PageHeader
        titulo="Mi plan"
        descripcion="Tu plan actual, lo que incluye y tu historial de pagos."
      />

      {/* Plan actual */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Plan actual
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold text-ink">
              {d.legacy
                ? "Acceso completo"
                : (d.plan?.name ?? d.planLabel ?? "Sin plan")}
            </h2>
            {estado && (
              <span className={`pill ${estado.clase}`}>{estado.texto}</span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {d.legacy
              ? "Tu negocio es anterior a los planes: tienes todas las funciones."
              : fin
                ? d.subscriptionStatus === "expired"
                  ? `Venció el ${dayjs(fin).format("DD/MM/YYYY")}. Renueva para seguir vendiendo.`
                  : `Vence el ${dayjs(fin).format("DD/MM/YYYY")} · quedan ${Math.max(d.daysLeft ?? 0, 0)} días`
                : "Sin vencimiento"}
          </p>
        </div>
        {enlaceRenovar && (
          <a
            href={enlaceRenovar}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-700"
          >
            <TbBrandWhatsapp className="text-lg" /> Renovar o cambiar de plan
          </a>
        )}
      </div>

      {/* Qué incluye */}
      <div className="card mb-5 p-5">
        <h3 className="mb-3 text-[15px] font-bold text-ink">
          Lo que incluye tu plan
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {d.features
            .filter((f) => aplicaA(f, tipo))
            .map((f) => {
              const incluida = d.funciones.includes(f.key);
              return (
                <li
                  key={f.key}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 ${incluida ? "bg-ok-bg/60" : "bg-canvas"}`}
                >
                  <span
                    className={`mt-0.5 shrink-0 ${incluida ? "text-ok" : "text-muted"}`}
                  >
                    {incluida ? <TbCheck /> : <TbLock />}
                  </span>
                  <span>
                    <span
                      className={`block text-[13px] font-semibold ${incluida ? "text-ink" : "text-muted"}`}
                    >
                      {f.label}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {f.detalle}
                    </span>
                  </span>
                </li>
              );
            })}
        </ul>
      </div>

      {/* Comparar planes */}
      {d.plans.length > 0 && (
        <div className="mb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-ink">
              Planes disponibles
            </h3>
            <Segmented
              value={intervalo}
              onChange={(v) => setIntervalo(v as "month" | "year")}
              options={[
                { label: "Mensual", value: "month" },
                { label: "Anual", value: "year" },
              ]}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {d.plans.map((p) => {
              const precio = p.prices?.find((x) => x.interval === intervalo);
              const mensual = p.prices?.find((x) => x.interval === "month");
              const ahorro =
                intervalo === "year" && precio && mensual
                  ? mensual.price * 12 - precio.price
                  : 0;
              const actual = !d.legacy && d.plan?.id === p.id;
              const enlace = whatsapp(
                `Hola, quiero el plan «${p.name}» ${intervalo === "year" ? "anual" : "mensual"} para «${business?.name ?? ""}».`,
              );
              return (
                <div
                  key={p.id}
                  className={`card relative flex flex-col p-5 ${p.isFeatured ? "ring-2 ring-brand-500" : ""}`}
                >
                  {p.isFeatured && (
                    <span className="pill absolute -top-3 left-5 bg-brand-600 text-white">
                      ⭐ Más elegido
                    </span>
                  )}
                  <h4 className="text-[17px] font-bold text-ink">{p.name}</h4>
                  {p.tagline && (
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {p.tagline}
                    </p>
                  )}
                  <p className="mt-3 text-[26px] font-extrabold text-ink">
                    {precio ? soles(precio.price) : "—"}
                    <span className="text-[13px] font-medium text-muted">
                      {INTERVALO[intervalo].corto}
                    </span>
                  </p>
                  {ahorro > 0 && (
                    <p className="text-[12px] font-semibold text-ok">
                      Ahorras {soles(ahorro)} al año
                    </p>
                  )}
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {d.features
                      .filter((f) => aplicaA(f, tipo))
                      .map((f) => {
                        const si = p.features.includes(f.key);
                        return (
                          <li
                            key={f.key}
                            className={`flex items-center gap-2 text-[12.5px] ${si ? "text-ink" : "text-muted/60 line-through"}`}
                          >
                            {si ? <TbCheck className="text-ok" /> : <TbLock />}
                            {f.label}
                          </li>
                        );
                      })}
                  </ul>
                  {actual ? (
                    <span className="mt-5 rounded-lg border border-line py-2 text-center text-[13px] font-semibold text-muted">
                      Tu plan actual
                    </span>
                  ) : enlace ? (
                    <a
                      href={enlace}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-5 rounded-lg py-2 text-center text-[13px] font-semibold transition ${
                        p.isFeatured
                          ? "bg-brand-600 text-white hover:bg-brand-700"
                          : "border border-brand-300 text-brand-700 hover:bg-brand-50"
                      }`}
                    >
                      Elegir este plan
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="card mb-5 p-5">
        <h3 className="mb-3 text-[15px] font-bold text-ink">
          Historial de pagos
        </h3>
        <Table
          rowKey="id"
          size="small"
          dataSource={d.subscriptions}
          columns={columnas}
          pagination={false}
          scroll={{ x: 640 }}
          locale={{ emptyText: "Aún no hay pagos registrados." }}
        />
      </div>

      {/* Otros negocios de la misma cuenta */}
      {negocios.length > 1 && (
        <div className="card p-5">
          <h3 className="mb-3 text-[15px] font-bold text-ink">Tus negocios</h3>
          <ul className="divide-y divide-line">
            {negocios.map((n) => {
              const e = n.effectiveSubscriptionStatus
                ? ESTADO_NEGOCIO[n.effectiveSubscriptionStatus]
                : null;
              return (
                <li
                  key={n.uuid}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">
                      {n.name}
                    </p>
                    <p className="text-[12px] text-muted">
                      {n.planLabel ?? "Acceso completo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e && <span className={`pill ${e.clase}`}>{e.texto}</span>}
                    {n.uuid !== uuid_business && (
                      <Link
                        to={`/b/${n.uuid}/plan`}
                        className="text-[12.5px] font-semibold text-brand-600"
                      >
                        Ver plan
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
