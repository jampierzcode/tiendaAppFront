import { useCallback, useEffect, useRef } from "react";

/**
 * Sondeo que no malgasta peticiones:
 *  - espera a que termine la anterior antes de programar la siguiente (no se
 *    apilan si el servidor tarda);
 *  - se pausa con la pestaña oculta y consulta al instante al volver;
 *  - el intervalo puede ser una función, para ir rápido solo cuando algo
 *    está cambiando (p. ej. mientras sale el QR) y despacio el resto del tiempo.
 *
 * Devuelve `ahora()`: consulta ya y reinicia la cuenta, para usarlo justo
 * después de una acción del usuario.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalo: number | (() => number),
  activo = true
) {
  const fnRef = useRef(fn);
  const msRef = useRef(intervalo);
  fnRef.current = fn;
  msRef.current = intervalo;

  const reiniciar = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Cada reinicio invalida la cadena anterior: nunca corren dos a la vez.
    let generacion = 0;

    const tick = async () => {
      const mia = ++generacion;
      if (!vivo) return;
      if (!document.hidden) {
        try {
          await fnRef.current();
        } catch {
          // el siguiente ciclo reintenta
        }
      }
      if (!vivo || mia !== generacion) return;
      const ms = typeof msRef.current === "function" ? msRef.current() : msRef.current;
      timer = setTimeout(tick, ms);
    };

    reiniciar.current = () => {
      if (timer) clearTimeout(timer);
      void tick();
    };

    const alVolver = () => {
      if (!document.hidden) reiniciar.current();
    };

    void tick();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo]);

  return useCallback(() => reiniciar.current(), []);
}
