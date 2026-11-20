import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import CajaPanel from "./CajaPanel";
import { AutorizacionProvider } from "./autorizacion";
import { crearApiSalon } from "./api";

/** Caja y cortes en el panel del dueño. */
export default function CajaPage() {
  const { uuid_business = "" } = useParams();
  const api = useMemo(() => crearApiSalon(uuid_business, "dueno"), [uuid_business]);
  const [simbolo, setSimbolo] = useState("S/");
  useEffect(() => {
    api.get("/me").then(({ data }) => setSimbolo(data.data.negocio.simbolo)).catch(() => {});
  }, [api]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titulo="Caja y cortes"
        descripcion="Abre caja con tu fondo, registra retiros y gastos, saca el corte X cuando quieras y cierra con el corte Z. Al final del día, el corte global cierra el turno."
      />
      <AutorizacionProvider>
        <CajaPanel api={api} simbolo={simbolo} esDueno />
      </AutorizacionProvider>
    </div>
  );
}
