import { createContext, useCallback, useContext } from "react";

export type Pedir = (mensaje: string) => Promise<string | null>;
export const CtxAutorizacion = createContext<Pedir>(async () => null);
const Ctx = CtxAutorizacion;

/**
 * Ejecuta una acción; si falta permiso, pide PIN y reintenta con él.
 * `fn(pin)` debe mandar el PIN en la cabecera `x-autorizacion-pin`.
 */
export function useConAutorizacion() {
  const pedir = useContext(Ctx);
  return useCallback(
    async <T,>(fn: (pin: string | null) => Promise<T>): Promise<T> => {
      let pin: string | null = null;
      for (let intento = 0; intento < 4; intento++) {
        try {
          return await fn(pin);
        } catch (e) {
          const err = e as { response?: { status: number; data?: { code?: string; message?: string } } };
          if (err.response?.status === 403 && err.response.data?.code === "autorizacion_requerida") {
            pin = await pedir(err.response.data.message ?? "Necesitas autorización");
            if (!pin) throw Object.assign(new Error("cancelado"), { cancelado: true });
            continue;
          }
          throw e;
        }
      }
      throw new Error("No se pudo autorizar");
    },
    [pedir]
  );
}

/** Cabecera con el PIN de autorización (si hay). */
export const conPin = (pin: string | null) => (pin ? { headers: { "x-autorizacion-pin": pin } } : undefined);

/** true si el error fue que el usuario canceló la autorización (no hay que mostrar nada). */
export const fueCancelado = (e: unknown) => Boolean((e as { cancelado?: boolean })?.cancelado);
