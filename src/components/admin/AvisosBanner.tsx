import { useState } from "react";
import { Button } from "antd";
import { TbBell, TbX } from "react-icons/tb";
import { apiTienda } from "../../api/apiTienda";
import { activarPush, pushSoportado } from "../../utilities/push";

const CLAVE = "panel:avisos-banner-cerrado";

/**
 * Invita a activar las notificaciones del navegador (como las de Messenger):
 * sin ese permiso no llegan avisos con la pestaña en segundo plano o cerrada.
 * Solo aparece si el navegador las soporta y aún no se respondió el permiso.
 */
export default function AvisosBanner() {
  const [visible, setVisible] = useState(
    () =>
      pushSoportado() &&
      Notification.permission === "default" &&
      localStorage.getItem(CLAVE) !== "1"
  );
  const [cargando, setCargando] = useState(false);
  if (!visible) return null;

  const activar = async () => {
    setCargando(true);
    // Aunque el servidor no tenga claves de push, el permiso sirve para los avisos con la pestaña abierta.
    await activarPush(apiTienda, "", {}, true);
    setCargando(false);
    setVisible(false);
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
      <TbBell className="shrink-0 text-xl text-brand-600" />
      <p className="min-w-0 flex-1 text-[13px] text-ink-soft">
        <b className="text-ink">Activa las notificaciones</b> para enterarte de mensajes, pedidos y comprobantes
        aunque estés en otra pestaña o con el panel cerrado. Al tocarlas te llevan directo.
      </p>
      <Button type="primary" loading={cargando} onClick={activar}>
        Activar notificaciones
      </Button>
      <button
        aria-label="Ahora no"
        className="text-muted hover:text-ink"
        onClick={() => {
          localStorage.setItem(CLAVE, "1");
          setVisible(false);
        }}
      >
        <TbX />
      </button>
    </div>
  );
}
