import { useEffect, useRef, useState } from "react";
import { Button, Input } from "antd";
import { apiTienda } from "../../api/apiTienda";

interface Props {
  value?: string;
  onChange?: (v: string) => void;
  /**
   * Con `auto` el campo pide al servidor un SKU libre y lo pre-llena sin que
   * el usuario escriba nada. Sin `auto` (producto o variación existente) solo
   * muestra el actual. En ambos casos «Editar» deja cambiarlo a mano.
   */
  auto?: boolean;
  /** Datos con los que se arma la sugerencia: nombre, producto, valores. */
  params?: { name?: string; productId?: number; valueIds?: number[] };
  /** Si no se puede sugerir todavía (p. ej. sin nombre), no se pide nada. */
  ready?: boolean;
}

/**
 * SKU único que se propone solo. Se ve bloqueado; con «Editar» el vendedor
 * puede poner el suyo (el servidor avisa si ya existe).
 */
export default function SkuField({ value, onChange, auto = false, params, ready = true }: Props) {
  const [editando, setEditando] = useState(false);
  const pedido = useRef(0);
  const clave = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!auto || editando || !ready) return;
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      try {
        const r = await apiTienda.get("/products-sku/suggest", {
          params: {
            name: params?.name,
            productId: params?.productId,
            valueIds: params?.valueIds?.join(","),
          },
        });
        if (n === pedido.current) onChange?.(r.data.data.sku);
      } catch {
        /* sin sugerencia: el servidor genera uno al guardar */
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, editando, ready, clave]);

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        disabled={!editando}
        placeholder={auto ? "Se genera solo" : "Sin SKU"}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <Button onClick={() => setEditando((e) => !e)}>{editando ? "Usar el automático" : "Editar"}</Button>
    </div>
  );
}
