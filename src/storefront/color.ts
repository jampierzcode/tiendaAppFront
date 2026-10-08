/**
 * ¿El color es claro? Decide si el texto que va encima debe ser oscuro o
 * blanco: la tienda elige su color principal y el encabezado tiene que
 * seguir leyéndose con cualquiera.
 */
export function esClaro(hex: string) {
  const limpio = hex.replace("#", "");
  const n =
    limpio.length === 3
      ? limpio.split("").map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16));

  if (n.some((c) => Number.isNaN(c))) return true;

  // Luminancia percibida: el ojo pesa mucho más el verde que el azul.
  return (0.299 * n[0] + 0.587 * n[1] + 0.114 * n[2]) / 255 > 0.6;
}
