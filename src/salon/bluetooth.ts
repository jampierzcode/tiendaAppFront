/* eslint-disable @typescript-eslint/no-explicit-any -- Web Bluetooth no trae tipos en lib.dom. */
/**
 * Impresoras térmicas por Bluetooth (BLE) desde Chrome en Android.
 *
 * Web Bluetooth no existe en iPhone ni en Firefox: la central de impresión
 * tiene que ser un Android con Chrome. Cada impresora del panel se empareja
 * con un equipo Bluetooth; la conexión vive mientras la pestaña esté abierta.
 */

// Servicios de escritura de las impresoras térmicas más comunes.
const SERVICIOS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
];

type BTDevice = any;
type BTChar = any;

interface Conexion {
  device: BTDevice;
  char: BTChar | null;
}

const conexiones = new Map<string, Conexion>(); // clave: "printer-<id>" o "caja"

export const hayBluetooth = () =>
  typeof navigator !== "undefined" && Boolean((navigator as any).bluetooth);

export function conectada(clave: string) {
  const c = conexiones.get(clave);
  return Boolean(c?.device?.gatt?.connected && c.char);
}

export function nombreEquipo(clave: string): string | null {
  return conexiones.get(clave)?.device?.name ?? localStorage.getItem(`pdv_bt_${clave}`) ?? null;
}

async function buscarCaracteristica(device: BTDevice): Promise<BTChar> {
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const servicios = await server.getPrimaryServices();
  for (const s of servicios) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      if (c.properties.writeWithoutResponse || c.properties.write) return c;
    }
  }
  throw new Error("La impresora no tiene un canal de escritura compatible");
}

/** Abre el selector de Bluetooth (necesita un toque del usuario). */
export async function emparejar(clave: string) {
  const bt = (navigator as any).bluetooth;
  const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICIOS });
  const char = await buscarCaracteristica(device);
  conexiones.set(clave, { device, char });
  localStorage.setItem(`pdv_bt_${clave}`, device.name ?? "Impresora");
  localStorage.setItem(`pdv_btid_${clave}`, device.id);
  device.addEventListener?.("gattserverdisconnected", () => {
    const c = conexiones.get(clave);
    if (c) c.char = null;
  });
  return device.name as string;
}

/**
 * Reconecta sin preguntar a una impresora ya emparejada antes, si el
 * navegador lo permite (getDevices). Si no, hay que tocar "Conectar".
 */
export async function reconectar(clave: string): Promise<boolean> {
  if (conectada(clave)) return true;
  const bt = (navigator as any).bluetooth;
  let device = conexiones.get(clave)?.device;
  if (!device && bt?.getDevices) {
    const id = localStorage.getItem(`pdv_btid_${clave}`);
    const lista = await bt.getDevices();
    device = lista.find((d: BTDevice) => d.id === id);
  }
  if (!device) return false;
  try {
    const char = await buscarCaracteristica(device);
    conexiones.set(clave, { device, char });
    return true;
  } catch {
    return false;
  }
}

export function olvidar(clave: string) {
  conexiones.get(clave)?.device?.gatt?.disconnect?.();
  conexiones.delete(clave);
  localStorage.removeItem(`pdv_bt_${clave}`);
  localStorage.removeItem(`pdv_btid_${clave}`);
}

/** Manda los bytes en trozos: BLE acepta paquetes chicos. */
export async function imprimir(clave: string, datos: Uint8Array) {
  if (!conectada(clave) && !(await reconectar(clave))) {
    throw new Error("Impresora desconectada");
  }
  const { char } = conexiones.get(clave)!;
  const TROZO = 100;
  for (let i = 0; i < datos.length; i += TROZO) {
    const parte = datos.slice(i, i + TROZO);
    if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) {
      await char.writeValueWithoutResponse(parte);
      await new Promise((r) => setTimeout(r, 20));
    } else {
      await char.writeValue(parte);
    }
  }
}
