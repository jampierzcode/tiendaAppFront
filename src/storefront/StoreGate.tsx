import StoreHome from "./StoreHome";
import StoreLayout from "./StoreLayout";
import MenuLayout from "./menu/MenuLayout";
import MenuPage from "./menu/MenuPage";
import { useStore } from "./StoreContext";

/**
 * Decide qué cara tiene la tienda según el tipo de negocio: la tienda de
 * catálogo de siempre, o la carta digital del restaurante. Mientras carga se
 * usa el layout de tienda, que ya sabe pintar su propio esqueleto.
 */
export default function StoreGate() {
  const { tienda } = useStore();
  return tienda?.businessType === "restaurant" ? <MenuLayout /> : <StoreLayout />;
}

export function StoreIndex() {
  const { tienda } = useStore();
  return tienda?.businessType === "restaurant" ? <MenuPage /> : <StoreHome />;
}
