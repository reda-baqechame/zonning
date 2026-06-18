import { ensureFresh, ensureFreshMany } from "./freshness";
import { bootstrapSyncIfNeeded } from "./bootstrap";
import { ALL_DATASET_IDS, type DatasetId } from "@/lib/datasets/registry";

const PERMITS_DATASETS: DatasetId[] = [
  "permits",
  "permits-laval",
  "permits-longueuil",
  "permits-quebec",
  "permits-gatineau",
  "assessment",
  "transactions",
  "transactions-2023",
  "contamination",
  "taxes",
  "zoning",
  "heritage",
  "heritage-eip",
  "contracts",
  "roadworks",
  "permit-stats",
  "permit-delays",
];

const TENDERS_DATASETS: DatasetId[] = ["tenders", "awards"];

const COMPANIES_DATASETS: DatasetId[] = ["suppliers", "registre", "rbq", "commercial"];

const INTELLIGENCE_DATASETS: DatasetId[] = [
  "assessment",
  "transactions",
  "transactions-2023",
  "transactions-2025",
  "contamination",
  "contamination-gtc",
  "taxes",
  "zoning",
  "pum2050-zoning",
  "zoning-trois-rivieres",
  "heritage",
  "heritage-eip",
  "heritage-lpc",
  "pum2050-heritage",
  "contracts",
  "contracts-boroughs",
  "roadworks",
  "roadworks-saguenay",
  "permit-stats",
  "permit-delays",
  "projects-sherbrooke",
];

const EXPORT_DATASETS: DatasetId[] = [
  ...PERMITS_DATASETS,
  ...TENDERS_DATASETS,
  ...COMPANIES_DATASETS,
];

const FRESH_TRIGGER_COOLDOWN_MS = 60_000;
const freshTriggerAt = new Map<string, number>();

export const ROUTE_DATASETS: Record<string, DatasetId[]> = {
  permits: PERMITS_DATASETS,
  tenders: TENDERS_DATASETS,
  companies: COMPANIES_DATASETS,
  intelligence: INTELLIGENCE_DATASETS,
  verdict: INTELLIGENCE_DATASETS,
  feed: [...PERMITS_DATASETS, ...TENDERS_DATASETS],
  export: EXPORT_DATASETS,
  stats: ["permits", "tenders", "registre", "rbq", "heritage", "contracts", "roadworks"],
  digest: ["permits", "tenders"],
  all: ALL_DATASET_IDS,
};

function resolveRouteKey(pathname: string): string | null {
  if (pathname.includes("/api/feed")) return "feed";
  if (pathname.includes("/api/verdict")) return "verdict";
  if (pathname.includes("/api/permits") || pathname.includes("/api/v1/permits")) {
    return "permits";
  }
  if (pathname.includes("/api/tenders") || pathname.includes("/api/v1/tenders")) {
    return "tenders";
  }
  if (pathname.includes("/api/companies")) return "companies";
  if (pathname.includes("/api/intelligence")) return "intelligence";
  if (pathname.includes("/api/export")) return "export";
  if (pathname.includes("/api/stats")) return "stats";
  if (pathname.includes("/api/digest")) return "digest";
  return null;
}

export function ensureFreshForRoute(pathname: string): void {
  void bootstrapSyncIfNeeded();
  const key = resolveRouteKey(pathname);
  if (!key) return;
  const datasets = ROUTE_DATASETS[key] ?? [];
  void ensureFreshMany(datasets, { background: true });
}

export function ensureFreshForKey(key: keyof typeof ROUTE_DATASETS): void {
  void bootstrapSyncIfNeeded();
  if (process.env.NODE_ENV === "production") {
    const now = Date.now();
    const last = freshTriggerAt.get(key) ?? 0;
    if (now - last < FRESH_TRIGGER_COOLDOWN_MS) return;
    freshTriggerAt.set(key, now);
  }
  const datasets = ROUTE_DATASETS[key] ?? [];
  void ensureFreshMany(datasets, { background: true });
}

export { ensureFresh };
