/**
 * Probe Données Québec CKAN for municipal permit/zoning datasets.
 * Usage: npx tsx scripts/discover-quebec-sources.ts [--json]
 */
import { writeFileSync } from "fs";
import { join } from "path";

const CKAN = "https://www.donneesquebec.ca/recherche/api/3/action/package_search";

type CkanDataset = {
  name: string;
  title?: string;
  organization?: { title?: string };
  resources?: { id: string; url: string; format?: string; last_modified?: string }[];
};

type DiscoveryHit = {
  city: string;
  datasetType: "permits" | "zoning" | "projects";
  query: string;
  ckanId: string;
  title: string;
  resourceUrl: string | null;
  format: string | null;
  lastModified: string | null;
};

const CITY_QUERIES: { city: string; queries: string[] }[] = [
  { city: "Terrebonne", queries: ["terrebonne permis", "terrebonne construction"] },
  { city: "Repentigny", queries: ["repentigny permis"] },
  { city: "Brossard", queries: ["brossard permis"] },
  { city: "Saint-Jean-sur-Richelieu", queries: ["saint-jean-sur-richelieu permis"] },
  { city: "Drummondville", queries: ["drummondville permis"] },
  { city: "Saint-Jérôme", queries: ["saint-jerome permis"] },
  { city: "Granby", queries: ["granby permis"] },
  { city: "Saint-Hyacinthe", queries: ["saint-hyacinthe permis"] },
  { city: "Lévis", queries: ["levis permis"] },
  { city: "Sherbrooke", queries: ["sherbrooke permis", "sherbrooke zonage"] },
  { city: "Gatineau", queries: ["gatineau permis"] },
  { city: "Québec", queries: ["quebec zonage", "ville de quebec permis"] },
  { city: "Laval", queries: ["laval zonage", "laval permis"] },
  { city: "Longueuil", queries: ["longueuil zonage", "longueuil permis"] },
];

async function searchCkan(q: string): Promise<CkanDataset[]> {
  const url = `${CKAN}?q=${encodeURIComponent(q)}&rows=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { result?: { results?: CkanDataset[] } };
  return data.result?.results ?? [];
}

function classifyType(title: string, q: string): DiscoveryHit["datasetType"] {
  const hay = `${title} ${q}`.toLowerCase();
  if (hay.includes("zonage") || hay.includes("zoning")) return "zoning";
  if (hay.includes("projet")) return "projects";
  return "permits";
}

async function main() {
  const hits: DiscoveryHit[] = [];
  const seen = new Set<string>();

  for (const { city, queries } of CITY_QUERIES) {
    for (const query of queries) {
      const results = await searchCkan(query);
      for (const pkg of results) {
        const key = `${city}-${pkg.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const resource = pkg.resources?.[0];
        hits.push({
          city,
          datasetType: classifyType(pkg.title ?? pkg.name, query),
          query,
          ckanId: pkg.name,
          title: pkg.title ?? pkg.name,
          resourceUrl: resource?.url ?? null,
          format: resource?.format ?? null,
          lastModified: resource?.last_modified ?? null,
        });
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const json = JSON.stringify({ generatedAt: new Date().toISOString(), hits }, null, 2);
  const outPath = join(process.cwd(), "docs", "quebec-sources-discovery.json");
  writeFileSync(outPath, json, "utf8");

  if (process.argv.includes("--json")) {
    console.log(json);
  } else {
    console.log(`Wrote ${hits.length} hits to ${outPath}`);
    for (const h of hits.slice(0, 20)) {
      console.log(`  [${h.city}] ${h.datasetType}: ${h.ckanId} (${h.format ?? "?"})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
