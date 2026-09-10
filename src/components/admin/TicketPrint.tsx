export interface DatosTicket {
  order: {
    code: string;
    documentSeries: string | null;
    documentNumber: number | null;
    createdAt: string;
    customerName: string;
    subtotal: number;
    discountTotal: number;
    total: number;
    items: {
      id: number;
      productName: string;
      variationLabel: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
    payments: { method: string; amount: number }[];
  };
  negocio: {
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    currencySymbol: string;
  };
}

const nombreMetodo: Record<string, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

/**
 * Ticket de venta para impresora térmica de 58-80 mm.
 *
 * No es un comprobante válido ante SUNAT: es la constancia que se lleva el
 * cliente. Lleva serie y correlativo porque es el enganche para cuando se
 * integre la emisión electrónica con un tercero.
 */
export default function TicketPrint({ datos }: { datos: DatosTicket }) {
  const { order, negocio } = datos;
  const money = (v: number) => `${negocio.currencySymbol} ${Number(v).toFixed(2)}`;

  return (
    <div
      id="ticket-impresion"
      className="mx-auto bg-white font-mono text-[11px] leading-snug text-black"
      style={{ width: "72mm", padding: "4mm 2mm" }}
    >
      <div className="text-center">
        <p className="text-[13px] font-bold uppercase">{negocio.name}</p>
        {negocio.address && <p>{negocio.address}</p>}
        {negocio.city && <p>{negocio.city}</p>}
        {negocio.phone && <p>Tel. {negocio.phone}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex justify-between">
        <span>TICKET</span>
        <span className="font-bold">{order.code}</span>
      </div>
      <div className="flex justify-between">
        <span>Fecha</span>
        <span>
          {new Date(order.createdAt).toLocaleString("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Cliente</span>
        <span>{order.customerName}</span>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <table className="w-full">
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="align-top">
              <td colSpan={2} className="pb-1">
                <div>{i.productName}</div>
                {i.variationLabel && <div className="pl-2">{i.variationLabel}</div>}
                <div className="flex justify-between pl-2">
                  <span>
                    {i.quantity} x {Number(i.unitPrice).toFixed(2)}
                  </span>
                  <span>{Number(i.lineTotal).toFixed(2)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{money(order.subtotal)}</span>
      </div>
      {Number(order.discountTotal) > 0 && (
        <div className="flex justify-between">
          <span>Descuento</span>
          <span>- {money(order.discountTotal)}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between text-[14px] font-bold">
        <span>TOTAL</span>
        <span>{money(order.total)}</span>
      </div>

      {order.payments?.map((p, i) => (
        <div key={i} className="flex justify-between">
          <span>{nombreMetodo[p.method] ?? p.method}</span>
          <span>{money(p.amount)}</span>
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-black" />

      <p className="text-center">¡Gracias por tu compra!</p>
      <p className="mt-1 text-center text-[9px]">
        Documento interno, no válido como comprobante de pago.
      </p>
    </div>
  );
}
