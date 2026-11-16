import { useEffect, useState } from "react";
import { Alert, Progress, Spin, Table, message } from "antd";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";

interface Total {
  costoUsd: number;
  llamadas: number;
  tokens: number;
}

interface Resumen {
  hoy: Total;
  mes: Total;
  proyeccionMesUsd: number;
  presupuestoMesUsd: number | null;
  modelo: string;
  porDia: { dia: string; costoUsd: number; llamadas: number }[];
  porNegocio: { businessId: number | null; negocio: string; costoUsd: number; llamadas: number; tokens: number }[];
  costosReales: { disponible: boolean; mesUsd?: number; error?: string };
}

const usd = (v: number) => `US$ ${v.toFixed(v < 1 ? 4 : 2)}`;

/** Consumo de OpenAI del vendedor IA: estimado propio y, con Admin key, el gasto real. */
export default function AiUsagePage() {
  const [d, setD] = useState<Resumen | null>(null);

  useEffect(() => {
    apiTienda
      .get("/ai-usage")
      .then((r) => setD(r.data.data))
      .catch(() => message.error("No se pudo cargar el consumo"));
  }, []);

  if (!d) {
    return (
      <div className="grid place-items-center py-20">
        <Spin />
      </div>
    );
  }

  const max = Math.max(0.0001, ...d.porDia.map((x) => x.costoUsd));
  const pct = d.presupuestoMesUsd ? Math.round((d.mes.costoUsd / d.presupuestoMesUsd) * 100) : null;

  return (
    <>
      <PageHeader
        titulo="Consumo de IA (OpenAI)"
        descripcion={`Lo que gasta el vendedor IA de todas las tiendas. Modelo: ${d.modelo}. Los montos son un estimado con la lista de precios de OpenAI.`}
      />

      {pct !== null && pct >= 80 && (
        <Alert
          className="mb-4"
          type={pct >= 100 ? "error" : "warning"}
          showIcon
          message={`Llevas el ${pct}% del presupuesto del mes (${usd(d.presupuestoMesUsd!)})`}
          description="Revisa tu saldo en platform.openai.com → Billing y activa la recarga automática para que el vendedor no se detenga."
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="eyebrow">Hoy</p>
          <p className="mt-1 text-[22px] font-bold text-ink">{usd(d.hoy.costoUsd)}</p>
          <p className="text-[12px] text-muted">{d.hoy.llamadas} respuestas</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Este mes (estimado)</p>
          <p className="mt-1 text-[22px] font-bold text-ink">{usd(d.mes.costoUsd)}</p>
          <p className="text-[12px] text-muted">
            {d.mes.llamadas} respuestas · {d.mes.tokens.toLocaleString("es-PE")} tokens
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Proyección a fin de mes</p>
          <p className="mt-1 text-[22px] font-bold text-ink">{usd(d.proyeccionMesUsd)}</p>
          {pct !== null && <Progress percent={Math.min(100, pct)} size="small" status={pct >= 100 ? "exception" : "normal"} />}
          {d.presupuestoMesUsd === null && (
            <p className="text-[12px] text-muted">Define AI_MONTHLY_BUDGET_USD para ver una alerta.</p>
          )}
        </div>
        <div className="card p-4">
          <p className="eyebrow">Gasto real (OpenAI)</p>
          {d.costosReales.disponible ? (
            <p className="mt-1 text-[22px] font-bold text-ink">{usd(d.costosReales.mesUsd ?? 0)}</p>
          ) : (
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {d.costosReales.error ??
                "Pon una Admin key de OpenAI en OPENAI_ADMIN_KEY (backend) para ver el gasto real del mes."}
            </p>
          )}
        </div>
      </div>

      <section className="card mt-5 p-5">
        <p className="eyebrow mb-3">Últimos 30 días</p>
        {d.porDia.length === 0 ? (
          <p className="text-[13px] text-muted">Aún no hay consumo registrado.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {d.porDia.map((x) => (
              <div key={x.dia} className="group relative flex-1">
                <div
                  className="rounded-t bg-brand-500"
                  style={{ height: `${Math.max(2, (x.costoUsd / max) * 150)}px` }}
                  title={`${x.dia}: ${usd(x.costoUsd)} · ${x.llamadas} respuestas`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-5 p-5">
        <p className="eyebrow mb-3">Por tienda (este mes)</p>
        <Table
          size="small"
          rowKey={(r) => String(r.businessId)}
          dataSource={d.porNegocio}
          pagination={false}
          columns={[
            { title: "Tienda", dataIndex: "negocio" },
            { title: "Respuestas", dataIndex: "llamadas", align: "right" },
            {
              title: "Tokens",
              dataIndex: "tokens",
              align: "right",
              render: (v: number) => v.toLocaleString("es-PE"),
            },
            { title: "Costo", dataIndex: "costoUsd", align: "right", render: (v: number) => usd(v) },
          ]}
        />
      </section>

      <p className="mt-4 text-[12px] text-muted">
        OpenAI no deja consultar el saldo prepagado por API. Para que tus clientes nunca se queden sin vendedor,
        activa la <b>recarga automática</b> en platform.openai.com → Settings → Billing.
      </p>
    </>
  );
}
