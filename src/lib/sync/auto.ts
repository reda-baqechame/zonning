import { ensureFresh, ensureFreshMany } from "./freshness";
import { bootstrapSyncIfNeeded } from "./bootstrap";
import { ALL_DATASET_IDS, type DatasetId } from "@/lib/datasets/registry";
import {
  QUEBEC_INTEL_REFRESH_IDS,
  QUEBEC_PERMIT_DATASET_IDS,
  QUEBEC_REALTIME_BUNDLE,
  RGM_REALTIME_IDS,
} from "@/lib/quebec-coverage";

const PERMIT_CITY_DATASETS: DatasetId[] = [
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

const PERMITS_DATASETS: DatasetId[] = [
  ...PERMIT_CITY_DATASETS,
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
  "zoning-sherbrooke",
  "zoning-quebec",
  "zoning-laval",
  "zoning-longueuil",
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
  "projects-brossard",
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
  "zoning-sherbrooke",
  "zoning-quebec",
  "zoning-laval",
  "zoning-longueuil",
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
  "projects-brossard",
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
  stats: [
    "permits",
    "permits-laval",
    "permits-longueuil",
    "permits-quebec",
    "permits-gatineau",
    "permits-levis",
    "tenders",
    "registre",
    "rbq",
    "heritage",
    "contracts",
    "roadworks",
    "contamination-gtc",
    "pum2050-zoning",
  ],
  digest: ["permits", "tenders", "awards"],
  "development-projects": ["projects-sherbrooke", "projects-brossard"],
  "permit-delays": ["permit-delays", "permit-stats"],
  "paiement-public": ["awards", "tenders"],
  "quebec-realtime": QUEBEC_REALTIME_BUNDLE,
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
  if (pathname.includes("/api/development-projects")) return "development-projects";
  if (pathname.includes("/api/permit-delays")) return "permit-delays";
  if (pathname.includes("/api/paiement-public")) return "paiement-public";
  return null;
}

export function ensureFreshForRoute(pathname: string): void {
  void bootstrapSyncIfNeeded();
  if (!shouldRunPublicRequestSync()) return;
  const key = resolveRouteKey(pathname);
  if (!key) return;
  const datasets = ROUTE_DATASETS[key] ?? [];
  void ensureFreshMany(datasets, { background: true });
}

/**
 * Whether per-request freshness syncs may run. User traffic should not own
 * ingestion in production — cron/workers do — so the default is off in prod
 * (DB reads only). Opt back in with PUBLIC_ROUTE_SYNC=true; force off in any
 * env with PUBLIC_ROUTE_SYNC=false. The one-time empty-DB bootstrap is
 * independent and still runs.
 */
export function shouldRunPublicRequestSync(): boolean {
  if (process.env.PUBLIC_ROUTE_SYNC === "true") return true;
  if (process.env.PUBLIC_ROUTE_SYNC === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function ensureQuebecRealtimeFresh(): void {
  void bootstrapSyncIfNeeded();
  if (!shouldRunPublicRequestSync()) return;
  if (process.env.NODE_ENV === "production") {
    const now = Date.now();
    const last = freshTriggerAt.get("quebec-realtime") ?? 0;
    if (now - last < FRESH_TRIGGER_COOLDOWN_MS) return;
    freshTriggerAt.set("quebec-realtime", now);
  }
  void ensureFreshMany(RGM_REALTIME_IDS, { background: true });
  void ensureFreshMany(QUEBEC_PERMIT_DATASET_IDS, { background: true });
  void ensureFreshMany(QUEBEC_INTEL_REFRESH_IDS, {
    background: true,
    maxAgeMinutes: 60,
  });
}

export function ensureFreshForKey(key: keyof typeof ROUTE_DATASETS): void {
  void bootstrapSyncIfNeeded();
  if (!shouldRunPublicRequestSync()) return;
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
