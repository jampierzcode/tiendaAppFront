/** Atajos para armar zonas de envío en Perú (distritos, provincias y departamentos). */

const LIMA_NORTE = [
  "Ancón",
  "Carabayllo",
  "Comas",
  "Independencia",
  "Los Olivos",
  "Puente Piedra",
  "San Martín de Porres",
  "Santa Rosa",
];
const LIMA_ESTE = [
  "Ate",
  "Chaclacayo",
  "Cieneguilla",
  "El Agustino",
  "La Molina",
  "Lurigancho",
  "San Juan de Lurigancho",
  "Santa Anita",
];
const LIMA_SUR = [
  "Chorrillos",
  "Lurín",
  "Pachacámac",
  "Pucusana",
  "Punta Hermosa",
  "Punta Negra",
  "San Bartolo",
  "San Juan de Miraflores",
  "Santa María del Mar",
  "Villa El Salvador",
  "Villa María del Triunfo",
];
const LIMA_CENTRO = [
  "Barranco",
  "Breña",
  "Jesús María",
  "La Victoria",
  "Lima",
  "Lince",
  "Magdalena del Mar",
  "Miraflores",
  "Pueblo Libre",
  "Rímac",
  "San Borja",
  "San Isidro",
  "San Luis",
  "San Miguel",
  "Santiago de Surco",
  "Surquillo",
];

export interface GrupoRegiones {
  clave: string;
  nombre: string;
  regiones: string[];
}

/** Botones principales (como en yavendió!). */
export const GRUPOS_PRINCIPALES: GrupoRegiones[] = [
  {
    clave: "lima",
    nombre: "Lima Metropolitana",
    regiones: [...LIMA_CENTRO, ...LIMA_NORTE, ...LIMA_ESTE, ...LIMA_SUR].sort((a, b) =>
      a.localeCompare(b, "es")
    ),
  },
  {
    clave: "callao",
    nombre: "Callao",
    regiones: ["Callao", "Bellavista", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Ventanilla", "Mi Perú"],
  },
  {
    clave: "lima-provincias",
    nombre: "Lima Provincias",
    regiones: ["Barranca", "Cajatambo", "Canta", "Cañete", "Huaral", "Huarochirí", "Huaura", "Oyón", "Yauyos"],
  },
  {
    clave: "provincias",
    nombre: "Provincias",
    regiones: [
      "Amazonas",
      "Áncash",
      "Apurímac",
      "Arequipa",
      "Ayacucho",
      "Cajamarca",
      "Cusco",
      "Huancavelica",
      "Huánuco",
      "Ica",
      "Junín",
      "La Libertad",
      "Lambayeque",
      "Loreto",
      "Madre de Dios",
      "Moquegua",
      "Pasco",
      "Piura",
      "Puno",
      "San Martín",
      "Tacna",
      "Tumbes",
      "Ucayali",
    ],
  },
];

/** Menú «Otros»: partes de Lima. */
export const GRUPOS_OTROS: GrupoRegiones[] = [
  { clave: "lima-centro", nombre: "Lima Centro", regiones: LIMA_CENTRO },
  { clave: "lima-norte", nombre: "Lima Norte", regiones: LIMA_NORTE },
  { clave: "lima-este", nombre: "Lima Este", regiones: LIMA_ESTE },
  { clave: "lima-sur", nombre: "Lima Sur", regiones: LIMA_SUR },
];
