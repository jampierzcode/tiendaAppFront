import { useMemo } from "react";
import { useParams } from "react-router-dom";
import SalonApp from "./SalonApp";
import { crearApiSalon } from "./api";

/** El salón dentro del panel del dueño, con su propia sesión. */
export default function SalonPanel() {
  const { uuid_business = "" } = useParams();
  const api = useMemo(() => crearApiSalon(uuid_business, "dueno"), [uuid_business]);
  return <SalonApp api={api} uuid={uuid_business} />;
}
