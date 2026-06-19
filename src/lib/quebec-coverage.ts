import {
  COVERAGE_CITIES,
  DATASETS,
  type DatasetId,
} from "@/lib/datasets/registry";

/** Montréal métropolitain — highest refresh priority. */
export const RGM_CITIES = ["Montréal", "Laval", "Longueuil"] as const;
export type RgmCity = (typeof RGM_CITIES)[number];

/** All permit dataset IDs wired across Québec. */
export const QUEBEC_PERMIT_DATASET_IDS: DatasetId[] = [
  "permits",
  "permits-laval",
  "permits-longueuil",
  "permits-quebec",
  "permits-gatineau",
  "permits-levis",
  "permits-sherbrooke",
  "permits-trois-rivieres",
  "permits-saguenay",
  "permits-terrebonne",
  "permits-repentigny",
  "permits-brossard",
  "permits-saint-jean-richelieu",
  "permits-drummondville",
  "permits-saint-jerome",
  "permits-granby",
  "permits-saint-hyacinthe",
];

/** RGM + provincial capitals — 50% refresh SLA in live cron. */
export const RGM_REALTIME_IDS: DatasetId[] = [
  "permits",
  "permits-laval",
  "permits-longueuil",
  "permits-quebec",
  "permits-gatineau",
  "tenders",
];

/** Intelligence layers refreshed on user traffic (maxAge override in auto.ts). */
export const QUEBEC_INTEL_REFRESH_IDS: DatasetId[] = [
  "assessment",
  "transactions",
  "transactions-2025",
  "rbq",
  "awards",
  "contamination-gtc",
  "contracts",
  "contracts-boroughs",
  "heritage",
  "pum2050-zoning",
  "zoning-quebec",
  "zoning-sherbrooke",
  "zoning-laval",
  "zoning-longueuil",
  "roadworks",
  "amp-registry",
  "rbq-infractions",
  "inspection-violations-mtl",
  "seao-standing-offers",
];

export const QUEBEC_REALTIME_BUNDLE: DatasetId[] = [
  ...QUEBEC_PERMIT_DATASET_IDS,
  ...RGM_REALTIME_IDS.filter((id) => !QUEBEC_PERMIT_DATASET_IDS.includes(id)),
  ...QUEBEC_INTEL_REFRESH_IDS,
];

export const CITY_TO_PERMIT_DATASET: Record<(typeof COVERAGE_CITIES)[number], DatasetId | null> =
  {
    Montréal: "permits",
    Laval: "permits-laval",
    Longueuil: "permits-longueuil",
    Québec: "permits-quebec",
    Gatineau: "permits-gatineau",
    Lévis: "permits-levis",
    Sherbrooke: "permits-sherbrooke",
    "Trois-Rivières": "permits-trois-rivieres",
    Saguenay: "permits-saguenay",
    Brossard: "permits-brossard",
    Terrebonne: "permits-terrebonne",
    Repentigny: "permits-repentigny",
    "Saint-Jean-sur-Richelieu": "permits-saint-jean-richelieu",
    Drummondville: "permits-drummondville",
    "Saint-Jérôme": "permits-saint-jerome",
    Granby: "permits-granby",
    "Saint-Hyacinthe": "permits-saint-hyacinthe",
  };

/** Layers available per city for intelligence routing. */
export const CITY_INTEL_LAYERS: Record<string, DatasetId[]> = {
  Montréal: [
    "assessment",
    "transactions",
    "taxes",
    "pum2050-zoning",
    "contamination-gtc",
    "heritage",
    "contracts",
    "roadworks",
    "inspection-violations-mtl",
  ],
  Laval: ["permits-laval", "zoning-laval"],
  Longueuil: ["permits-longueuil", "zoning-longueuil"],
  Québec: ["permits-quebec", "zoning-quebec"],
  Gatineau: ["permits-gatineau"],
  Sherbrooke: ["permits-sherbrooke", "zoning-sherbrooke", "projects-sherbrooke"],
  "Trois-Rivières": ["permits-trois-rivieres", "zoning-trois-rivieres"],
  Saguenay: ["permits-saguenay", "roadworks-saguenay"],
  Brossard: ["permits-brossard", "projects-brossard"],
};

export function getIntelLayersForCity(city: string): DatasetId[] {
  if (CITY_INTEL_LAYERS[city]) return CITY_INTEL_LAYERS[city]!;
  const permitId = Object.entries(CITY_TO_PERMIT_DATASET).find(([c]) => c === city)?.[1];
  return permitId ? [permitId] : ["permits"];
}

export function isRgmCity(city: string): city is RgmCity {
  return (RGM_CITIES as readonly string[]).includes(city);
}

export function sortQuebecPriority(ids: DatasetId[]): DatasetId[] {
  const order = [...RGM_REALTIME_IDS, ...QUEBEC_PERMIT_DATASET_IDS, ...QUEBEC_INTEL_REFRESH_IDS];
  return [...ids].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b) || a.localeCompare(b)
  );
}

export function getQuebecDataLayerLabels(): { key: string; label: string }[] {
  return [
    { key: "permits", label: "Permis de construction" },
    { key: "tenders", label: "Appels d'offres SEAO" },
    { key: "rbq", label: "Licences RBQ" },
    { key: "zoning", label: "Zonage" },
    { key: "transactions", label: "Transactions immobilières" },
    { key: "assessment", label: "Rôles d'évaluation" },
    { key: "heritage", label: "Patrimoine" },
    { key: "contracts", label: "Contrats municipaux" },
    { key: "contamination", label: "Sites contaminés" },
    { key: "roadworks", label: "Travaux publics" },
    { key: "companies", label: "Registre entreprises" },
    { key: "awards", label: "Attributions SEAO" },
  ];
}

export function getCityLabel(city: string, locale: "fr" | "en" = "fr"): string {
  if (locale === "en") {
    const en: Record<string, string> = {
      Montréal: "Montreal",
      Québec: "Quebec City",
      Lévis: "Lévis",
      "Trois-Rivières": "Trois-Rivières",
      "Saint-Jérôme": "Saint-Jérôme",
      "Saint-Hyacinthe": "Saint-Hyacinthe",
      "Saint-Jean-sur-Richelieu": "Saint-Jean-sur-Richelieu",
    };
    return en[city] ?? city;
  }
  return city;
}

export function describeQuebecEngine(): {
  cities: number;
  datasets: number;
  rgm: string[];
} {
  return {
    cities: COVERAGE_CITIES.length,
    datasets: QUEBEC_REALTIME_BUNDLE.length,
    rgm: [...RGM_CITIES],
  };
}

export function citySourceLabel(city: (typeof COVERAGE_CITIES)[number]): string {
  const datasetId = CITY_TO_PERMIT_DATASET[city];
  if (!datasetId) return DATASETS["projects-brossard"].label;
  return DATASETS[datasetId].label;
}
