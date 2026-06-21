/**
 * Crawl the Données Québec CKAN catalog and print/write ranked construction-relevant
 * datasets not yet wired into the registry.
 *
 * Usage:
 *   npx tsx scripts/harvest-quebec.ts              # print top candidates to stdout
 *   npx tsx scripts/harvest-quebec.ts --json        # write artifacts/harvest-quebec.json
 *   npx tsx scripts/harvest-quebec.ts --query "permis" --rows 400
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { harvestCkanCatalog, getKnownCkanIds } from "../src/lib/datasets/harvester";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
function flagValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const queryArg = flagValue("--query");
const rowsArg = Number(flagValue("--rows")) || 0;

async function main() {
  const known = await getKnownCkanIds();
  console.log(`[harvest] known ckanIds in registry: ${known.size}`);

  const result = await harvestCkanCatalog({
    maxRows: rowsArg || 1600,
    query: queryArg,
    knownCkanIds: known,
    minRelevance: 50,
    onPage: (scanned, kept) => {
      if (scanned % 200 === 0) console.log(`[harvest] scanned ${scanned}… kept ${kept}`);
    },
  });

  console.log(`\n[harvest] scanned ${result.totalScanned} datasets`);
  console.log(`[harvest] ${result.candidates.length} relevant candidates (${result.newCandidates} new)`);

  const byCat = Object.entries(result.byCategory)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  console.log("\nBy category:");
  for (const [cat, n] of byCat) console.log(`  ${cat.padEnd(18)} ${n}`);

  const newOnes = result.candidates.filter((c) => !known.has(c.ckanId)).slice(0, 60);
  console.log(`\nTop ${newOnes.length} NEW candidates:`);
  for (const c of newOnes) {
    console.log(
      `  [${c.relevance}] ${c.category}${c.city ? ` · ${c.city}` : ""} · ${c.title} (${c.organization ?? "?"})`
    );
    console.log(`      ${c.preferredResource?.format ?? "?"} → ${c.preferredResource?.url?.slice(0, 80) ?? "no url"}`);
  }

  if (asJson) {
    const outDir = join(process.cwd(), "artifacts");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "harvest-quebec.json");
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`\n[harvest] wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error("[harvest] failed", err);
  process.exit(1);
});
