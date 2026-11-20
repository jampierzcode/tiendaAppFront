import { useSearchParams } from "react-router-dom";
import { Segmented } from "antd";
import { TbLayoutKanban, TbList } from "react-icons/tb";
import KitchenPage from "./KitchenPage";
import OrdersPage from "./OrdersPage";
import { useFunciones } from "../../context/BusinessContext";

/**
 * Restaurante: los pedidos de la tienda online y del WhatsApp en un solo
 * lugar. «Tablero» para aceptarlos y moverlos (lo que antes era Cocina) y
 * «Lista» para buscarlos, ver cobros y su historial.
 */
export default function PedidosOnlinePage() {
  const [params, setParams] = useSearchParams();
  const { tiene } = useFunciones();
  const conTablero = tiene("cocina");
  const vista = conTablero && params.get("vista") !== "lista" ? "tablero" : "lista";

  return (
    <div>
      {conTablero && (
        <Segmented
          className="mb-4"
          value={vista}
          onChange={(v) => setParams(v === "lista" ? { vista: "lista" } : {}, { replace: true })}
          options={[
            { value: "tablero", label: "Tablero", icon: <TbLayoutKanban /> },
            { value: "lista", label: "Lista e historial", icon: <TbList /> },
          ]}
        />
      )}
      {vista === "tablero" ? <KitchenPage /> : <OrdersPage />}
    </div>
  );
}
