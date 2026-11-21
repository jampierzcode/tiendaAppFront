import { useCallback, useEffect, useRef, useState } from "react";
import type { AxiosInstance } from "axios";
import { avisar, decir, desbloquearAudio, pitar } from "../hooks/useAvisos";
import { usePolling } from "../hooks/usePolling";
import type { Mesa, ResumenCuenta, Yo } from "./api";

const CLAVE = "pdv:sonido";

/** Interruptor de sonido de ESTE equipo (cada celular decide si suena). */
export function useSonidoPdv() {
  const [sonido, setSonido] = useState(() => localStorage.getItem(CLAVE) !== "0");
  useEffect(() => desbloquearAudio(), []);
  const alternar = useCallback(() => {
    const nuevo = !sonido;
    localStorage.setItem(CLAVE, nuevo ? "1" : "0");
    setSonido(nuevo);
    // El toque del botón desbloquea el audio y sirve de prueba.
    if (nuevo) {
      pitar();
      decir("Sonido activado");
    }
  }, [sonido]);
  return { sonido, alternar };
}

interface EnCursoMin {
  id: number;
  etiqueta: string;
  listos: number;
  /** La abrió este usuario (si el backend aún no lo manda, se asume que sí). */
  propia?: boolean;
}

/**
 * Avisos del PDV con pitido, voz y notificación:
 *  - «Comanda lista, Mesa 2» cuando cocina termina platos. El mesero solo
 *    escucha sus cuentas; caja, gerente y dueño, todas.
 *  - «Nuevo pedido» cuando entra un pedido de la tienda online o
 *    WhatsApp (no al mesero: lo atiende caja).
 * La primera carga solo toma la foto: no anuncia lo que ya estaba.
 */
export function useAvisosPdv(opts: {
  api: AxiosInstance;
  yo: Yo | null;
  sonido: boolean;
  mesas: Mesa[] | null;
  cuentas: ResumenCuenta[];
  enCurso: { para_llevar: EnCursoMin[]; delivery: EnCursoMin[] };
}) {
  const { api, yo, sonido, mesas, cuentas, enCurso } = opts;
  const foto = useRef<Map<string, number> | null>(null);
  const esMesero = yo?.role === "mesero";

  useEffect(() => {
    if (!mesas || !yo) return;
    const actual = new Map<string, { listos: number; nombre: string; mia: boolean }>();
    for (const m of mesas) {
      if (m.cuenta) actual.set(`c${m.cuenta.id}`, { listos: m.cuenta.listos, nombre: `Mesa ${m.name}`, mia: m.cuenta.propia });
    }
    for (const c of cuentas) {
      if (!actual.has(`c${c.id}`)) actual.set(`c${c.id}`, { listos: c.listos, nombre: c.etiqueta, mia: c.propia });
    }
    for (const p of [...enCurso.para_llevar, ...enCurso.delivery]) {
      actual.set(`c${p.id}`, { listos: p.listos, nombre: p.etiqueta, mia: p.propia ?? true });
    }

    const anterior = foto.current;
    foto.current = new Map([...actual].map(([k, v]) => [k, v.listos]));
    if (!anterior || !sonido) return;

    const nuevos = [...actual].filter(
      ([k, v]) => v.listos > (anterior.get(k) ?? 0) && (!esMesero || v.mia)
    );
    if (!nuevos.length) return;
    const nombres = nuevos.map(([, v]) => v.nombre);
    const frase = nombres.length === 1 ? `Comanda lista, ${nombres[0]}` : `Comandas listas: ${nombres.join(", ")}`;
    // La etiqueta lleva cuenta y cantidad de listos: igual en todas las pestañas, suena una vez.
    const etiqueta = `listo-${nuevos.map(([k, v]) => `${k}.${v.listos}`).join("-")}`;
    avisar(nombres.length === 1 ? "Comanda lista" : "Comandas listas", nombres.join(", "), etiqueta, undefined, frase);
  }, [mesas, cuentas, enCurso, yo, sonido, esMesero]);

  // Pedidos web: solo para quien cobra o atiende (no meseros).
  const ultimoWeb = useRef<number | null | undefined>(undefined);
  const revisarWeb = useCallback(async () => {
    try {
      const { data } = await api.get("/web-orders/latest");
      const n = data.data as { id: number; orderId: number | null; title: string; body: string | null } | null;
      const id = n?.id ?? null;
      if (ultimoWeb.current !== undefined && n && id !== ultimoWeb.current && sonido) {
        avisar(n.title, n.body ?? "", n.orderId ? `pedido-${n.orderId}` : `pedido-web-${n.id}`, undefined, "Nuevo pedido");
      }
      ultimoWeb.current = id;
    } catch {
      // sin red: se reintenta
    }
  }, [api, sonido]);
  usePolling(revisarWeb, 15000, Boolean(yo) && !esMesero, true);
}
