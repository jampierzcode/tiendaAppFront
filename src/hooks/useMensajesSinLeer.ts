import { useRef, useState } from "react";
import { apiTienda } from "../api/apiTienda";
import { avisar } from "./useAvisos";
import { usePolling } from "./usePolling";

/**
 * Sondea los mensajes de WhatsApp sin leer. Cuando el número sube avisa con
 * una notificación del navegador (y cambia el título de la pestaña).
 */
export function useMensajesSinLeer(activo: boolean) {
  const [sinLeer, setSinLeer] = useState(0);
  const anterior = useRef<number | null>(null);

  usePolling(
    async () => {
      try {
        const r = await apiTienda.get("/whatsapp/unread");
        const n = Number(r.data.data.unread ?? 0);
        if (anterior.current !== null && n > anterior.current) {
          // Misma etiqueta que el aviso push del servidor: si llegan los dos, se reemplazan.
          const negocio = window.location.pathname.match(/^\/b\/[^/]+/)?.[0] ?? "";
          avisar(
            n - anterior.current > 1 ? `${n - anterior.current} mensajes nuevos` : "Mensaje nuevo de un cliente",
            "Toca para abrir «Mensajes» y responder",
            "chat",
            negocio ? `${negocio}/chat` : undefined
          );
        }
        anterior.current = n;
        setSinLeer(n);
      } catch {
        // red caída: se reintenta en el siguiente ciclo
      }
    },
    15000,
    activo,
    // Debe sonar y avisar aunque estés en otra pestaña.
    true
  );

  return sinLeer;
}
