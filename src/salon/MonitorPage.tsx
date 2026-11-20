import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Segmented } from "antd";
import MonitorProduccion, { type TicketMonitor } from "./MonitorProduccion";
import { crearApiSalon } from "./api";

/** Monitor de producción desde el panel del dueño (todas las áreas o una). */
export default function MonitorPage() {
  const { uuid_business = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const api = useMemo(() => crearApiSalon(uuid_business, "dueno"), [uuid_business]);
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const area = params.get("area") ?? "";

  useEffect(() => {
    api.get("/areas").then(({ data }) => setAreas(data.data)).catch(() => setAreas([]));
  }, [api]);

  const cargar = useCallback(
    async () => (await api.get<{ data: TicketMonitor[] }>("/monitor", { params: { areas: area } })).data.data,
    [api, area]
  );
  const cambiar = useCallback(
    async (ids: number[], estado: string) => {
      await api.post("/monitor/items", { ids, estado });
    },
    [api]
  );

  return (
    <div className="-m-4 sm:-m-6">
      {areas.length > 0 && (
        <div className="bg-[#14122b] px-3 pt-3">
          <Segmented
            value={area}
            onChange={(v) => setParams(v ? { area: String(v) } : {}, { replace: true })}
            options={[{ value: "", label: "Todas las áreas" }, ...areas.map((a) => ({ value: String(a.id), label: a.name }))]}
          />
        </div>
      )}
      <MonitorProduccion
        key={area}
        titulo="Monitor de producción"
        subtitulo={area ? areas.find((a) => String(a.id) === area)?.name : "Todas las áreas"}
        cargar={cargar}
        cambiar={cambiar}
      />
    </div>
  );
}
