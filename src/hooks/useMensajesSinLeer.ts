import { useEffect, useRef, useState } from "react";
import { apiTienda } from "../api/apiTienda";
import { avisar } from "./useAvisos";

/**
 * Sondea los mensajes de WhatsApp sin leer. Cuando el número sube avisa con
 * una notificación del navegador (y cambia el título de la pestaña).
 */
export function useMensajesSinLeer(activo: boolean) {
  const [sinLeer, setSinLeer] = useState(0);
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;

    const consultar = async () => {
      try {
        const r = await apiTienda.get("/whatsapp/unread");
        const n = Number(r.data.data.unread ?? 0);
        if (!vivo) return;
        if (anterior.current !== null && n > anterior.current) {
          avisar("Mensaje nuevo de un cliente", "Abre «Mensajes» para responder", "chat");
        }
        anterior.current = n;
        setSinLeer(n);
      } catch {
        // red caída: se reintenta en el siguiente ciclo
      }
    };

    consultar();
    const t = setInterval(consultar, 6000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [activo]);

  return sinLeer;
}
