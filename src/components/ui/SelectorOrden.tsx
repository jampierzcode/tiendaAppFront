import { Segmented } from "antd";

export type Orden = "manual" | "asc" | "desc";

/** Manual (arrastrando) o alfabético ascendente/descendente. */
export default function SelectorOrden({
  value,
  onChange,
  manualLabel = "Manual",
}: {
  value: Orden;
  onChange: (o: Orden) => void;
  manualLabel?: string;
}) {
  return (
    <Segmented
      value={value}
      onChange={(v) => onChange(v as Orden)}
      options={[
        { value: "manual", label: manualLabel },
        { value: "asc", label: "A → Z" },
        { value: "desc", label: "Z → A" },
      ]}
    />
  );
}
