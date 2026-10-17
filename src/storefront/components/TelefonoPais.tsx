import { PAISES_TEL } from "../../utilities/paises";

interface Props {
  dial: string;
  onDial: (dial: string) => void;
  value: string;
  onValue: (valor: string) => void;
  placeholder?: string;
  /** Clases del contenedor, para encajar en cada diseño (carrito o carta). */
  className?: string;
  id?: string;
}

/** Teléfono con selector de país; el que arranca marcado es el de la tienda. */
export default function TelefonoPais({ dial, onDial, value, onValue, placeholder, className = "", id }: Props) {
  return (
    <div className={`flex overflow-hidden ${className}`}>
      <select
        aria-label="Código de país"
        value={dial}
        onChange={(e) => onDial(e.target.value)}
        className="shrink-0 border-r border-neutral-200 bg-neutral-50 pl-2 pr-1 text-sm outline-none"
      >
        {PAISES_TEL.map((p) => (
          <option key={p.codigo} value={p.dial}>
            {p.bandera} +{p.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
      />
    </div>
  );
}
