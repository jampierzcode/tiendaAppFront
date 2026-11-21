import { useCallback, useEffect, useState } from "react";
import type { AxiosInstance } from "axios";
import { Alert, Button, Empty, Spin, Switch, message } from "antd";
import { TbCheck, TbRepeat } from "react-icons/tb";

interface PlatoHoy {
  id: number;
  name: string;
  imageUrl: string | null;
  price: number;
  elegido: boolean;
  agotado: boolean;
}

interface CategoriaHoy {
  id: number;
  name: string;
  isActive: boolean;
  dailyMenu: boolean;
  platos: PlatoHoy[];
}

interface PantallaHoy {
  hoy: string;
  ultimoMenu: string | null;
  categorias: CategoriaHoy[];
}

type Ejecutar = <T>(fn: (pin: string | null) => Promise<T>) => Promise<T>;

interface Props {
  /** Panel: apiTienda (/b/:uuid). PDV: la API del salón (/b/:uuid/salon). */
  api: AxiosInstance;
  /** Solo el dueño decide qué categoría «cambia cada día». */
  puedeConfigurar: boolean;
  /** En el PDV reintenta con el PIN de un encargado si falta permiso. */
  ejecutar?: Ejecutar;
  simbolo?: string;
}

const directo: Ejecutar = (fn) => fn(null);
const conPin = (pin: string | null) => (pin ? { headers: { "x-autorizacion-pin": pin } } : undefined);

function fechaBonita(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Lo que hay hoy, sin tocar la carta: en las categorías «cambia cada día» se
 * marcan los platos del día (si no se marca ninguno, se ven todos) y en
 * cualquier plato «Se acabó» lo pone en gris hasta mañana.
 */
export default function MenuHoyEditor({ api, puedeConfigurar, ejecutar = directo, simbolo = "S/" }: Props) {
  const [datos, setDatos] = useState<PantallaHoy | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/menu-hoy");
      setDatos(data.data);
    } catch {
      message.error("No se pudo cargar el menú de hoy");
    }
  }, [api]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const error = (e: unknown) => {
    if ((e as { cancelado?: boolean })?.cancelado) return;
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(msg ?? "No se pudo guardar");
  };

  const marcar = async (plato: PlatoHoy, cambio: { elegido?: boolean; agotado?: boolean }) => {
    setOcupado(`p${plato.id}`);
    try {
      const r = await ejecutar((pin) => api.put(`/menu-hoy/products/${plato.id}`, cambio, conPin(pin)));
      const nuevo = r.data.data as { id: number; elegido: boolean; agotado: boolean };
      setDatos((d) =>
        d && {
          ...d,
          categorias: d.categorias.map((c) => ({
            ...c,
            platos: c.platos.map((p) => (p.id === nuevo.id ? { ...p, ...nuevo } : p)),
          })),
        }
      );
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const cambiaCadaDia = async (c: CategoriaHoy, valor: boolean) => {
    setOcupado(`c${c.id}`);
    try {
      const r = await api.put(`/menu-hoy/categories/${c.id}`, { dailyMenu: valor });
      setDatos(r.data.data);
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const repetir = async () => {
    setOcupado("repetir");
    try {
      const r = await ejecutar((pin) => api.post("/menu-hoy/repeat", {}, conPin(pin)));
      setDatos(r.data.data);
      message.success(`Listo: ${r.data.data.copiados} platos en el menú de hoy`);
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  if (!datos) {
    return (
      <div className="grid place-items-center py-16">
        <Spin />
      </div>
    );
  }

  const diarias = datos.categorias.filter((c) => c.dailyMenu);
  const sinElegir = diarias.length > 0 && diarias.every((c) => !c.platos.some((p) => p.elegido));
  const agotados = datos.categorias.flatMap((c) => c.platos).filter((p) => p.agotado);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Hoy</p>
          <p className="text-[17px] font-bold text-ink">{fechaBonita(datos.hoy)}</p>
        </div>
        {sinElegir && datos.ultimoMenu && (
          <Button icon={<TbRepeat />} loading={ocupado === "repetir"} onClick={repetir}>
            Repetir el menú del {fechaBonita(datos.ultimoMenu).split(",")[0].toLowerCase()}
          </Button>
        )}
      </div>

      {diarias.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message="¿Tu menú cambia cada día?"
          description={
            puedeConfigurar
              ? "Activa «Cambia cada día» en esa categoría (por ejemplo, Menú del día) y marca solo los platos que sacas hoy. Lo demás no se mueve."
              : "El dueño puede marcar una categoría como «Cambia cada día» desde el panel. Mientras tanto puedes marcar lo que se acabó."
          }
        />
      ) : sinElegir ? (
        <Alert
          type="warning"
          showIcon
          message="Aún no eliges el menú de hoy"
          description="Mientras no marques ninguno, la carta y el PDV muestran todos los platos de esa categoría."
        />
      ) : null}

      {agotados.length > 0 && (
        <p className="text-[13px] text-muted">
          Se acabó hoy: <b className="text-ink">{[...new Set(agotados.map((p) => p.name))].join(", ")}</b>. Mañana vuelven
          solos.
        </p>
      )}

      {datos.categorias.length === 0 && <Empty description="Aún no tienes platos activos" />}

      {datos.categorias.map((c) => {
        const elegidos = c.platos.filter((p) => p.elegido).length;
        return (
          <section key={c.id} className="overflow-hidden rounded-2xl border border-line bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-bold text-ink">
                  {c.name}
                  {!c.isActive && <span className="ml-2 text-[12px] font-normal text-muted">(oculta)</span>}
                </h3>
                {c.dailyMenu && (
                  <p className="text-[12px] text-muted">
                    {elegidos ? `${elegidos} de ${c.platos.length} para hoy` : "Sin elegir: se ven todos"}
                  </p>
                )}
              </div>
              {puedeConfigurar && c.id > 0 && (
                <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                  Cambia cada día
                  <Switch
                    size="small"
                    checked={c.dailyMenu}
                    loading={ocupado === `c${c.id}`}
                    onChange={(v) => cambiaCadaDia(c, v)}
                  />
                </label>
              )}
            </header>
            <ul className="divide-y divide-line">
              {c.platos.map((p) => (
                <li key={p.id} className={`flex items-center gap-3 px-4 py-2.5 ${p.agotado ? "bg-canvas" : ""}`}>
                  {c.dailyMenu && (
                    <button
                      type="button"
                      aria-label={p.elegido ? `Quitar ${p.name} del menú de hoy` : `Poner ${p.name} en el menú de hoy`}
                      disabled={ocupado === `p${p.id}`}
                      onClick={() => marcar(p, { elegido: !p.elegido })}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 text-[18px] transition ${
                        p.elegido ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white text-transparent"
                      }`}
                    >
                      <TbCheck />
                    </button>
                  )}
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className={`h-10 w-10 shrink-0 rounded-lg object-cover ${p.agotado ? "grayscale" : ""}`} />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-canvas">🍽️</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] font-semibold ${p.agotado ? "text-muted line-through" : "text-ink"}`}>
                      {p.name}
                    </p>
                    <p className="text-[12px] text-muted">
                      {simbolo} {p.price.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="small"
                    danger={!p.agotado}
                    type={p.agotado ? "primary" : "default"}
                    loading={ocupado === `p${p.id}`}
                    onClick={() => marcar(p, { agotado: !p.agotado })}
                  >
                    {p.agotado ? "Volvió" : "Se acabó"}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
