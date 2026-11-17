import { useEffect, useMemo, useState } from "react";
import { DatePicker, Spin, Table, Tag, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import PageHeader from "../../components/ui/PageHeader";
import type { Business, Suscripcion } from "../../types/main";
import {
  ESTADO_SUSCRIPCION,
  INTERVALO,
  soles,
  textoDescuento,
} from "../../utilities/planes";

interface Datos {
  from: string;
  to: string;
  cobrado: number;
  subscriptions: Suscripcion[];
  porPlan: {
    plan: string;
    estado: "trial" | "active" | "expired";
    total: number;
  }[];
  porVencer: Business[];
}

const ESTADO = {
  trial: "En prueba",
  active: "Pagando",
  expired: "Vencidos",
} as const;

/** Cobros de planes: lo cobrado en el rango, cartera por plan y lo que vence pronto. */
export default function SubscriptionsPage() {
  const [rango, setRango] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs(),
  ]);
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setCargando(true);
    apiTienda
      .get("/subscriptions", {
        params: {
          from: rango[0].format("YYYY-MM-DD"),
          to: rango[1].format("YYYY-MM-DD"),
        },
      })
      .then((r) => setD(r.data.data))
      .catch(() => message.error("No se pudieron cargar los cobros"))
      .finally(() => setCargando(false));
  }, [rango]);

  // Cartera: una fila por plan con sus negocios por estado.
  const cartera = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const r of d?.porPlan ?? []) {
      const fila = m.get(r.plan) ?? {};
      fila[r.estado] = (fila[r.estado] ?? 0) + r.total;
      m.set(r.plan, fila);
    }
    return [...m.entries()].map(([plan, e]) => ({ plan, ...e }));
  }, [d]);

  const pagos = (d?.subscriptions ?? []).filter((s) => s.status === "active");

  return (
    <>
      <PageHeader
        titulo="Cobros"
        descripcion="Pagos de planes registrados, negocios por plan y los que vencen pronto."
        acciones={
          <DatePicker.RangePicker
            value={rango}
            allowClear={false}
            format="DD/MM/YYYY"
            onChange={(v) => v?.[0] && v?.[1] && setRango([v[0], v[1]])}
          />
        }
      />

      {!d ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-[12px] text-muted">Cobrado en el rango</p>
              <p className="text-[26px] font-extrabold text-ok">
                {soles(d.cobrado)}
              </p>
              <p className="text-[12px] text-muted">{pagos.length} pagos</p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] text-muted">Negocios pagando</p>
              <p className="text-[26px] font-extrabold text-ink">
                {d.porPlan
                  .filter((r) => r.estado === "active")
                  .reduce((t, r) => t + r.total, 0)}
              </p>
              <p className="text-[12px] text-muted">
                {d.porPlan
                  .filter((r) => r.estado === "trial")
                  .reduce((t, r) => t + r.total, 0)}{" "}
                en prueba
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] text-muted">Vencen en 7 días</p>
              <p className="text-[26px] font-extrabold text-warn">
                {d.porVencer.length}
              </p>
              <p className="text-[12px] text-muted">
                Para escribirles antes de que se corten
              </p>
            </div>
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 text-[15px] font-bold text-ink">
                Negocios por plan
              </h3>
              <Table
                rowKey="plan"
                size="small"
                pagination={false}
                dataSource={cartera}
                columns={[
                  { title: "Plan", dataIndex: "plan" },
                  ...(["active", "trial", "expired"] as const).map((e) => ({
                    title: ESTADO[e],
                    key: e,
                    render: (
                      _: unknown,
                      r: { plan: string } & Record<string, number | string>,
                    ) => r[e] ?? 0,
                  })),
                ]}
              />
            </div>
            <div className="card p-4">
              <h3 className="mb-3 text-[15px] font-bold text-ink">
                Vencen pronto
              </h3>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={d.porVencer}
                locale={{ emptyText: "Nadie vence esta semana" }}
                columns={[
                  {
                    title: "Negocio",
                    key: "n",
                    render: (_: unknown, b: Business) => (
                      <div>
                        <div>{b.name}</div>
                        <div className="text-[12px] text-muted">
                          {b.user?.name}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Plan",
                    key: "p",
                    render: (_: unknown, b: Business) => b.planLabel ?? "—",
                  },
                  {
                    title: "Vence",
                    key: "v",
                    render: (_: unknown, b: Business) => {
                      const fin =
                        b.effectiveSubscriptionStatus === "trial"
                          ? b.trialEndsAt
                          : b.paidUntil;
                      return fin ? dayjs(fin).format("DD/MM") : "—";
                    },
                  },
                  {
                    title: "",
                    key: "w",
                    render: (_: unknown, b: Business) =>
                      b.whatsappPhone && (
                        <a
                          href={`https://wa.me/${b.whatsappPhone}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      ),
                  },
                ]}
              />
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-[15px] font-bold text-ink">Movimientos</h3>
            <Table
              rowKey="id"
              size="small"
              loading={cargando}
              dataSource={d.subscriptions}
              scroll={{ x: 820 }}
              columns={[
                {
                  title: "Fecha",
                  key: "f",
                  render: (_: unknown, s: Suscripcion) =>
                    dayjs(s.createdAt).format("DD/MM/YYYY HH:mm"),
                },
                {
                  title: "Negocio",
                  key: "b",
                  render: (_: unknown, s: Suscripcion) =>
                    s.business?.name ?? "—",
                },
                {
                  title: "Plan",
                  key: "p",
                  render: (_: unknown, s: Suscripcion) => (
                    <div>
                      <div>{s.planName}</div>
                      <div className="text-[12px] text-muted">
                        {s.interval === "trial"
                          ? `Prueba · ${s.quantity} días`
                          : `${s.quantity} ${s.quantity === 1 ? INTERVALO[s.interval].uno : INTERVALO[s.interval].varios} × ${soles(s.unitPrice)}`}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Total",
                  key: "t",
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
                  title: "Pago",
                  key: "m",
                  render: (_: unknown, s: Suscripcion) => (
                    <div className="text-[12px]">
                      <div>{s.paymentMethod ?? "—"}</div>
                      {s.paymentReference && (
                        <div className="text-muted">{s.paymentReference}</div>
                      )}
                    </div>
                  ),
                },
                {
                  title: "Estado",
                  key: "e",
                  render: (_: unknown, s: Suscripcion) => (
                    <Tag color={ESTADO_SUSCRIPCION[s.state]?.color}>
                      {ESTADO_SUSCRIPCION[s.state]?.texto}
                    </Tag>
                  ),
                },
                {
                  title: "Registró",
                  key: "c",
                  render: (_: unknown, s: Suscripcion) =>
                    s.creator?.name ?? "Sistema",
                },
              ]}
            />
          </div>
        </>
      )}
    </>
  );
}
