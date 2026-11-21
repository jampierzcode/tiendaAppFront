import { apiTienda } from "../../api/apiTienda";
import MenuHoyEditor from "../../components/admin/MenuHoyEditor";
import PageHeader from "../../components/ui/PageHeader";
import { useBusiness } from "../../context/BusinessContext";

/**
 * Menú de hoy: qué sale hoy de la carta, sin activar ni desactivar platos.
 * Lo mismo se ve en la carta digital, el PDV, los pedidos y el vendedor IA.
 */
export default function MenuHoyPage() {
  const { business } = useBusiness();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo="Menú de hoy"
        descripcion="Marca los platos que sacas hoy y lo que se acabó. Tu carta completa no se toca: mañana eliges de nuevo y lo agotado vuelve solo."
      />
      <MenuHoyEditor api={apiTienda} puedeConfigurar simbolo={(business as { currencySymbol?: string } | null)?.currencySymbol || "S/"} />
    </div>
  );
}
