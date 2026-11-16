/**
 * Excel (.xlsx) mínimo, sin librerías: crear una hoja simple (plantillas) y
 * leer la primera hoja de un archivo que suba el usuario. Un .xlsx es un ZIP
 * con XML adentro; se escribe sin comprimir y se lee con DecompressionStream.
 */

const enc = new TextEncoder();

// ---------------------------------------------------------------- ZIP

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(archivos: { nombre: string; datos: Uint8Array }[]): Blob {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin comprimir
    local.setUint32(14, crc, true);
    local.setUint32(18, a.datos.length, true);
    local.setUint32(22, a.datos.length, true);
    local.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(local.buffer), nombre, a.datos);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, a.datos.length, true);
    cen.setUint32(24, a.datos.length, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    offset += 30 + nombre.length + a.datos.length;
  }
  const tamCentral = central.reduce((t, x) => t + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf);
  let fin = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("El archivo no es un Excel (.xlsx) válido");
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const salida = new Map<string, Uint8Array>();
  for (let i = 0; i < total; i++) {
    const metodo = v.getUint16(p + 10, true);
    const tam = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComent = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(new Uint8Array(buf, p + 46, largoNombre));
    p += 46 + largoNombre + largoExtra + largoComent;
    if (!/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/[^/]+\.xml|_rels\/workbook\.xml\.rels)$/.test(nombre)) continue;
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const crudo = new Uint8Array(buf, inicio, tam);
    if (metodo === 0) salida.set(nombre, crudo);
    else if (metodo === 8) {
      const stream = new Blob([crudo as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      salida.set(nombre, new Uint8Array(await new Response(stream).arrayBuffer()));
    }
  }
  return salida;
}

// ---------------------------------------------------------------- XLSX

const xml = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const columna = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Crea un .xlsx de una hoja; la primera fila va en negrita. */
export function crearXlsx(filas: string[][], hoja = "Hoja1", anchos: number[] = []): Blob {
  const cols = anchos.length
    ? `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const filasXml = filas
    .map(
      (f, r) =>
        `<row r="${r + 1}">${f
          .map(
            (v, c) =>
              `<c r="${columna(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(v ?? "")}</t></is></c>`
          )
          .join("")}</row>`
    )
    .join("");
  const archivos: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(hoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ],
    [
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${filasXml}</sheetData></worksheet>`,
    ],
  ];
  return zip(archivos.map(([nombre, txt]) => ({ nombre, datos: enc.encode(txt) })));
}

/** Lee la primera hoja de un .xlsx como filas de texto. */
export async function leerXlsx(archivo: File): Promise<string[][]> {
  const partes = await unzip(await archivo.arrayBuffer());
  const dec = new TextDecoder();
  const parse = (n: string) => {
    const d = partes.get(n);
    return d ? new DOMParser().parseFromString(dec.decode(d), "application/xml") : null;
  };

  const compartidos = [...(parse("xl/sharedStrings.xml")?.getElementsByTagName("si") ?? [])].map((si) =>
    [...si.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("")
  );

  // Primera hoja según el libro (no siempre se llama sheet1.xml).
  let ruta = "xl/worksheets/sheet1.xml";
  const primera = parse("xl/workbook.xml")?.getElementsByTagName("sheet")[0];
  const rid = primera?.getAttribute("r:id");
  const rel = rid
    ? [...(parse("xl/_rels/workbook.xml.rels")?.getElementsByTagName("Relationship") ?? [])].find(
        (r) => r.getAttribute("Id") === rid
      )
    : null;
  if (rel?.getAttribute("Target")) ruta = `xl/${rel.getAttribute("Target")!.replace(/^\/?xl\//, "")}`;
  const hoja = parse(ruta) ?? parse([...partes.keys()].find((k) => k.startsWith("xl/worksheets/")) ?? "");
  if (!hoja) throw new Error("No se encontró ninguna hoja en el Excel");

  const indice = (ref: string) => {
    const letras = ref.replace(/\d+/g, "");
    let n = 0;
    for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };

  const filas: string[][] = [];
  for (const row of hoja.getElementsByTagName("row")) {
    const fila: string[] = [];
    let siguiente = 0;
    for (const c of row.getElementsByTagName("c")) {
      const ref = c.getAttribute("r");
      const i = ref ? indice(ref) : siguiente;
      siguiente = i + 1;
      const tipo = c.getAttribute("t");
      let valor = "";
      if (tipo === "s") valor = compartidos[Number(c.getElementsByTagName("v")[0]?.textContent ?? -1)] ?? "";
      else if (tipo === "inlineStr")
        valor = [...c.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("");
      else valor = c.getElementsByTagName("v")[0]?.textContent ?? "";
      fila[i] = valor.trim();
    }
    filas.push(Array.from(fila, (x) => x ?? ""));
  }
  return filas;
}

/** Texto pegado desde Excel (tabulado) o un CSV con coma o punto y coma. */
export function leerTextoTabla(texto: string): string[][] {
  const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim() && !/^sep=/i.test(l));
  if (!lineas.length) return [];
  const sep = lineas[0].includes("\t") ? "\t" : (lineas[0].split(";").length > lineas[0].split(",").length ? ";" : ",");
  return lineas.map((l) => {
    const celdas: string[] = [];
    let actual = "";
    let comillas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') {
        if (comillas && l[i + 1] === '"') {
          actual += '"';
          i++;
        } else comillas = !comillas;
      } else if (ch === sep && !comillas) {
        celdas.push(actual.trim());
        actual = "";
      } else actual += ch;
    }
    celdas.push(actual.trim());
    return celdas;
  });
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
