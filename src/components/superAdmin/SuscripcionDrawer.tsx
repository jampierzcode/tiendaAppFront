import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Divider,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  message,
  Switch,
} from "antd";
import dayjs from "dayjs";
import { apiTienda } from "../../api/apiTienda";
import type { Business, Plan, Suscripcion } from "../../types/main";
import {
  ESTADO_SUSCRIPCION,
  INTERVALO,
  METODOS_PAGO,
  soles,
  textoDescuento,
} from "../../utilities/planes";

interface Props {
  business: Business | null;
  onClose: () => void;
  /** Se llama después de cada cambio para refrescar la tabla de negocios. */
  onChanged: () => void;
}

const errorDe = (e: unknown, porDefecto: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? porDefecto;

/**
 * Plan y pagos de un negocio: registrar un período (precio × cantidad), dar
 * prueba gratis y ver/anular el historial. Cobrar se cobra fuera (Yape,
 * transferencia…); aquí queda registrado.
 */
export default function SuscripcionDrawer({
  business,
  onClose,
  onChanged,
}: Props) {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [historial, setHistorial] = useState<Suscripcion[]>([]);
  /** Complementos aparte del plan (p. ej. Inventario +S/10 sobre PDV). */
  const [complementos, setComplementos] = useState<Record<string, { label: string; precio: number }>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  const [planId, setPlanId] = useState<number | null>(null);
  const [intervalo, setIntervalo] = useState<"month" | "year">("month");
  const [cantidad, setCantidad] = useState(1);
  const [cortesia, setCortesia] = useState(false);
  /** Precio pactado por mes/año; null = el de lista. */
  const [especial, setEspecial] = useState<number | null>(null);
  const [tipoDescuento, setTipoDescuento] = useState<"percent" | "amount">(
    "percent",
  );
  const [valorDescuento, setValorDescuento] = useState<number | null>(null);
  const [metodo, setMetodo] = useState<string | null>("yape");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [diasPrueba, setDiasPrueba] = useState(7);
  const [planPrueba, setPlanPrueba] = useState<number | null>(null);

  const cargar = async () => {
    if (!business) return;
    setCargando(true);
    try {
      const [h, p] = await Promise.all([
        apiTienda.get(`/businesses/${business.id}/subscriptions`),
        apiTienda.get("/plans"),
      ]);
      setHistorial(h.data.data.subscriptions ?? []);
      setComplementos(h.data.data.complementos ?? {});
      setExtras(h.data.data.business?.extraFeatures ?? []);
      const disponibles = (p.data.data as Plan[]).filter(
        (x) =>
          x.isActive &&
          (!x.businessType || x.businessType === business.businessType),
      );
      setPlanes(disponibles);
      const actual =
        business.planId ??
        disponibles.find((x) => x.isFeatured)?.id ??
        disponibles[0]?.id ??
        null;
      setPlanId((v) => v ?? actual);
      setPlanPrueba((v) => v ?? actual);
    } catch (e) {
      message.error(errorDe(e, "No se pudo cargar el historial"));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    setPlanId(null);
    setPlanPrueba(null);
    setCantidad(1);
    setCortesia(false);
    setEspecial(null);
    setValorDescuento(null);
    setReferencia("");
    setNotas("");
    if (business) cargar();
  }, [business?.id]);

  const plan = planes.find((p) => p.id === planId);
  const precio = plan?.prices?.find(
    (x) => x.interval === intervalo && x.isActive,
  );
  const maximo = intervalo === "year" ? 5 : 36;
  const unitario = cortesia ? 0 : (especial ?? precio?.price ?? 0);
  const subtotal = Math.round(unitario * cantidad * 100) / 100;
  const descuento =
    cortesia || !valorDescuento
      ? 0
      : Math.round(
          (tipoDescuento === "percent"
            ? (subtotal * valorDescuento) / 100
            : valorDescuento) * 100,
        ) / 100;
  const descuentoInvalido =
    descuento > subtotal ||
    (tipoDescuento === "percent" && (valorDescuento ?? 0) > 100);
  const total = Math.max(0, Math.round((subtotal - descuento) * 100) / 100);

  // Vista previa del período, con la misma regla del backend.
  const periodo = useMemo(() => {
    const ahora = dayjs();
    const mismoPlan = historial
      .filter(
        (s) =>
          s.status === "active" &&
          s.planId === planId &&
          dayjs(s.endsAt).isAfter(ahora),
      )
      .sort((a, b) => dayjs(b.endsAt).valueOf() - dayjs(a.endsAt).valueOf())[0];
    const inicio = mismoPlan ? dayjs(mismoPlan.endsAt) : ahora;
    const fin = inicio.add(cantidad, intervalo === "year" ? "year" : "month");
    return { inicio, fin, renovacion: Boolean(mismoPlan) };
  }, [historial, planId, cantidad, intervalo]);

  const registrar = async () => {
    if (!business || !precio) return;
    setGuardando(true);
    try {
      await apiTienda.post(`/businesses/${business.id}/subscriptions`, {
        planPriceId: precio.id,
        quantity: cantidad,
        courtesy: cortesia,
        unitPrice: !cortesia && especial !== null ? especial : null,
        discountType: descuento > 0 ? tipoDescuento : null,
        discountValue: descuento > 0 ? valorDescuento : null,
        paymentMethod: cortesia ? null : metodo,
        paymentReference: referencia.trim() || null,
        notes: notas.trim() || null,
      });
      message.success(
        `Registrado: ${plan?.name} hasta el ${periodo.fin.format("DD/MM/YYYY")}`,
      );
      setReferencia("");
      setNotas("");
      setCantidad(1);
      setEspecial(null);
      setValorDescuento(null);
      await cargar();
      onChanged();
    } catch (e) {
      message.error(errorDe(e, "No se pudo registrar"));
    } finally {
      setGuardando(false);
    }
  };

  const darPrueba = async () => {
    if (!business) return;
    try {
      await apiTienda.post(`/businesses/${business.id}/trial`, {
        days: diasPrueba,
        planId: planPrueba,
      });
      message.success(`Prueba de ${diasPrueba} días aplicada`);
      await cargar();
      onChanged();
    } catch (e) {
      message.error(errorDe(e, "No se pudo dar la prueba"));
    }
  };

  const anular = (s: Suscripcion) => {
    let motivo = "";
    Modal.confirm({
      title: `¿Anular «${s.planName}» (${soles(s.total)})?`,
      content: (
        <div>
          <p>
            Queda en el historial como anulada y el vencimiento se recalcula.
          </p>
          <Input
            placeholder="Motivo (opcional)"
            onChange={(e) => (motivo = e.target.value)}
          />
        </div>
      ),
      okText: "Anular",
      okButtonProps: { danger: true },
      cancelText: "Volver",
      onOk: async () => {
        try {
          await apiTienda.post(`/subscriptions/${s.id}/cancel`, {
            reason: motivo,
          });
          message.success("Registro anulado");
          await cargar();
          onChanged();
        } catch (e) {
          message.error(errorDe(e, "No se pudo anular"));
        }
      },
    });
  };

  const estado = business?.effectiveSubscriptionStatus;
  const fin = estado === "trial" ? business?.trialEndsAt : business?.paidUntil;

  return (
    <Drawer
      open={!!business}
      onClose={onClose}
      width={720}
      title={business ? `Plan y pagos · ${business.name}` : ""}
      destroyOnClose
    >
      {business && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <strong style={{ fontSize: 16 }}>
                {business.planLabel ?? "Sin plan (acceso completo)"}
              </strong>
              {estado === "trial" && <Tag color="blue">En prueba</Tag>}
              {estado === "active" && <Tag color="green">Activo</Tag>}
              {estado === "expired" && <Tag color="red">Vencido</Tag>}
            </Space>
            <div style={{ color: "#7c7a9c", fontSize: 13 }}>
              {fin
                ? `Vence el ${dayjs(fin).format("DD/MM/YYYY")}`
                : "Sin vencimiento"}
            </div>
          </div>

          <Divider orientation="left">Registrar pago</Divider>
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Select
              style={{ width: "100%" }}
              placeholder="Plan"
              value={planId ?? undefined}
              onChange={setPlanId}
              options={planes.map((p) => ({
                value: p.id,
                label: `${p.name} · ${p.prices?.map((x) => `${soles(x.price)}${INTERVALO[x.interval].corto}`).join(" · ")}`,
              }))}
            />
            <Space wrap>
              <Segmented
                value={intervalo}
                onChange={(v) => {
                  setIntervalo(v as "month" | "year");
                  setCantidad(1);
                }}
                options={[
                  {
                    label: "Mensual",
                    value: "month",
                    disabled: !plan?.prices?.some(
                      (x) => x.interval === "month" && x.isActive,
                    ),
                  },
                  {
                    label: "Anual",
                    value: "year",
                    disabled: !plan?.prices?.some(
                      (x) => x.interval === "year" && x.isActive,
                    ),
                  },
                ]}
              />
              <InputNumber
                min={1}
                max={maximo}
                value={cantidad}
                onChange={(v) =>
                  setCantidad(Math.min(maximo, Math.max(1, Number(v) || 1)))
                }
                addonAfter={
                  cantidad === 1
                    ? INTERVALO[intervalo].uno
                    : INTERVALO[intervalo].varios
                }
                style={{ width: 170 }}
              />
              <Checkbox
                checked={cortesia}
                onChange={(e) => setCortesia(e.target.checked)}
              >
                Cortesía (sin cobro)
              </Checkbox>
            </Space>

            <div
              style={{
                background: "#f5f4fb",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#7c7a9c" }}>
                  {cantidad}{" "}
                  {cantidad === 1
                    ? INTERVALO[intervalo].uno
                    : INTERVALO[intervalo].varios}{" "}
                  × {soles(unitario)}
                  {especial !== null &&
                    !cortesia &&
                    precio &&
                    ` (lista ${soles(precio.price)})`}
                </div>
                <div style={{ fontSize: 13 }}>
                  {periodo.renovacion ? "Renovación: " : "Desde hoy: "}
                  {periodo.inicio.format("DD/MM/YYYY")} →{" "}
                  <strong>{periodo.fin.format("DD/MM/YYYY")}</strong>
                </div>
                {!periodo.renovacion &&
                  business.planId &&
                  business.planId !== planId && (
                    <div style={{ fontSize: 12, color: "#9a6206" }}>
                      Cambio de plan: el período actual se cierra hoy.
                    </div>
                  )}
              </div>
              <div style={{ textAlign: "right" }}>
                {descuento > 0 && (
                  <div style={{ fontSize: 12, color: "#7c7a9c" }}>
                    Subtotal {soles(subtotal)} · Descuento −{soles(descuento)}
                  </div>
                )}
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {soles(total)}
                </div>
              </div>
            </div>

            {!cortesia && (
              <InputNumber
                min={0}
                precision={2}
                value={especial ?? undefined}
                placeholder={precio ? String(precio.price) : ""}
                onChange={(v) =>
                  setEspecial(v === null || v === undefined ? null : Number(v))
                }
                addonBefore={`Precio especial por ${INTERVALO[intervalo].uno}`}
                addonAfter="S/"
                style={{ width: 330 }}
              />
            )}
            {!cortesia && (
              <Space wrap>
                <Segmented
                  value={tipoDescuento}
                  onChange={(v) => setTipoDescuento(v as "percent" | "amount")}
                  options={[
                    { label: "Descuento %", value: "percent" },
                    { label: "Descuento S/", value: "amount" },
                  ]}
                />
                <InputNumber
                  min={0}
                  max={tipoDescuento === "percent" ? 100 : undefined}
                  precision={2}
                  value={valorDescuento ?? undefined}
                  onChange={(v) =>
                    setValorDescuento(
                      v === null || v === undefined ? null : Number(v),
                    )
                  }
                  addonAfter={tipoDescuento === "percent" ? "%" : "S/"}
                  placeholder="0"
                  style={{ width: 150 }}
                  status={descuentoInvalido ? "error" : undefined}
                />
                {descuentoInvalido && (
                  <span style={{ color: "#c0263a", fontSize: 12 }}>
                    Mayor que el subtotal
                  </span>
                )}
              </Space>
            )}
            {!cortesia && (
              <Space wrap style={{ width: "100%" }}>
                <Select
                  style={{ width: 170 }}
                  value={metodo ?? undefined}
                  onChange={setMetodo}
                  options={METODOS_PAGO}
                  placeholder="Método"
                />
                <Input
                  style={{ width: 260 }}
                  placeholder="N.º de operación o referencia"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </Space>
            )}
            <Input.TextArea
              rows={2}
              placeholder="Notas (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
            <Button
              type="primary"
              onClick={registrar}
              loading={guardando}
              disabled={!precio || descuentoInvalido}
            >
              Registrar {soles(total)}
            </Button>
          </Space>

          {Object.keys(complementos).length > 0 && (
            <>
              <Divider orientation="left">Complementos</Divider>
              <Space direction="vertical">
                {Object.entries(complementos).map(([k, c]) => (
                  <label key={k} className="flex items-center gap-2 text-[13px]">
                    <Switch
                      size="small"
                      checked={extras.includes(k)}
                      onChange={async (on) => {
                        const nuevos = on ? [...extras, k] : extras.filter((x) => x !== k);
                        try {
                          await apiTienda.put(`/businesses/${business!.id}/addons`, { features: nuevos });
                          setExtras(nuevos);
                          message.success(on ? `${c.label} activado` : `${c.label} quitado`);
                        } catch (e) {
                          message.error(errorDe(e, "No se pudo guardar"));
                        }
                      }}
                    />
                    {c.label} <span className="text-muted">(+{soles(c.precio)}/mes; súmalo al registrar el pago)</span>
                  </label>
                ))}
              </Space>
            </>
          )}

          <Divider orientation="left">Prueba gratis</Divider>
          <Space wrap>
            <Select
              style={{ width: 200 }}
              value={planPrueba ?? undefined}
              onChange={setPlanPrueba}
              options={planes.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Plan de la prueba"
            />
            <InputNumber
              min={1}
              max={90}
              value={diasPrueba}
              onChange={(v) => setDiasPrueba(Number(v) || 7)}
              addonAfter="días"
              style={{ width: 130 }}
            />
            <Button onClick={darPrueba}>Dar prueba</Button>
          </Space>

          <Divider orientation="left">Historial</Divider>
          <Table
            rowKey="id"
            size="small"
            loading={cargando}
            dataSource={historial}
            pagination={false}
            scroll={{ x: 640 }}
            locale={{ emptyText: "Sin registros todavía" }}
            columns={[
              {
                title: "Plan",
                key: "plan",
                render: (_, s) => (
                  <div>
                    <div>{s.planName}</div>
                    <div style={{ fontSize: 12, color: "#7c7a9c" }}>
                      {s.interval === "trial"
                        ? `Prueba · ${s.quantity} días`
                        : `${s.quantity} ${s.quantity === 1 ? INTERVALO[s.interval].uno : INTERVALO[s.interval].varios} × ${soles(s.unitPrice)}`}
                    </div>
                  </div>
                ),
              },
              {
                title: "Período",
                key: "periodo",
                render: (_, s) =>
                  `${dayjs(s.startsAt).format("DD/MM/YY")} → ${dayjs(s.endsAt).format("DD/MM/YY")}`,
              },
              {
                title: "Total",
                key: "total",
                render: (_, s) => (
                  <div>
                    <div>{soles(s.total)}</div>
                    {textoDescuento(s) && (
                      <div style={{ fontSize: 12, color: "#12805c" }}>
                        {textoDescuento(s)}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: "Pago",
                key: "pago",
                render: (_, s) => (
                  <div style={{ fontSize: 12 }}>
                    <div>{s.paymentMethod ?? "—"}</div>
                    {s.paymentReference && (
                      <div style={{ color: "#7c7a9c" }}>
                        {s.paymentReference}
                      </div>
                    )}
                    {s.creator && (
                      <div style={{ color: "#7c7a9c" }}>
                        por {s.creator.name}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: "Estado",
                key: "estado",
                render: (_, s) => (
                  <Tag color={ESTADO_SUSCRIPCION[s.state]?.color}>
                    {ESTADO_SUSCRIPCION[s.state]?.texto}
                  </Tag>
                ),
              },
              {
                title: "",
                key: "acc",
                render: (_, s) =>
                  s.status !== "cancelled" && (
                    <Button
                      size="small"
                      danger
                      type="link"
                      onClick={() => anular(s)}
                    >
                      Anular
                    </Button>
                  ),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
