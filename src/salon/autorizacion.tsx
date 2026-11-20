import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal } from "antd";
import { TbBackspace, TbShieldLock } from "react-icons/tb";

/**
 * Autorización de un superior. Cuando el servidor responde 403
 * `autorizacion_requerida`, se pide el PIN de alguien que sí puede (gerente,
 * dueño…) y la misma acción se reintenta con ese PIN. El PIN no se guarda.
 */
import { CtxAutorizacion as Ctx, type Pedir } from "./autorizacionCtx";

export function AutorizacionProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const pedir = useCallback<Pedir>(
    (mensaje) =>
      new Promise((res) => {
        resolver.current = res;
        setPin("");
        setAbierto(mensaje);
      }),
    []
  );

  const cerrar = (v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setAbierto(null);
    setPin("");
  };

  return (
    <Ctx.Provider value={pedir}>
      {children}
      <Modal
        open={Boolean(abierto)}
        title={
          <span className="flex items-center gap-2">
            <TbShieldLock className="text-brand-600" /> Autorización
          </span>
        }
        okText="Autorizar"
        okButtonProps={{ disabled: pin.length < 4 }}
        onOk={() => cerrar(pin)}
        onCancel={() => cerrar(null)}
        width={340}
        destroyOnHidden
      >
        <p className="mb-3 text-[13px] text-muted">{abierto}</p>
        <p className="mb-2 text-[13px]">Que un encargado escriba su PIN:</p>
        <div className="mb-3 flex justify-center gap-3">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-brand-500" : "bg-line"}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "<"].map((d, i) =>
            d === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setPin(d === "<" ? pin.slice(0, -1) : (pin + d).slice(0, 6))}
                className="grid h-12 place-items-center rounded-xl bg-canvas text-[20px] font-semibold active:bg-brand-50"
              >
                {d === "<" ? <TbBackspace /> : d}
              </button>
            )
          )}
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

