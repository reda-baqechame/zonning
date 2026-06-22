import { NextRequest, NextResponse } from "next/server";
import { GraphBuilder } from "@/lib/ontology/graph";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import type { Seed, SeedKind } from "@/lib/ontology/types";

const SEED_KINDS: SeedKind[] = [
  "matricule",
  "address",
  "neq",
  "rbq",
  "permit",
  "company",
  "tender",
];

/**
 * GET /api/v2/graph?kind=address&value=...&expand=nodeId,nodeId
 *
 * Returns an investigation subgraph: nodes + typed edges + entity-resolution
 * groups, each node carrying traceable Evidence back to its source record.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:graph:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") as SeedKind | null;
  const value = sp.get("value")?.trim();
  const expand = sp
    .get("expand")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!kind || !SEED_KINDS.includes(kind) || !value) {
    return NextResponse.json(
      { error: "kind (one of " + SEED_KINDS.join(", ") + ") and value are required" },
      { status: 400 }
    );
  }

  const seed: Seed = { kind, value, borough: sp.get("borough") ?? undefined, city: sp.get("city") ?? undefined };

  try {
    const builder = new GraphBuilder();
    const subgraph = expand?.length
      ? await builder.expandNodes(seed, expand)
      : await builder.build(seed);

    if (!subgraph) {
      return NextResponse.json(
        { error: "Aucune entité trouvée pour cette recherche.", nodes: [], edges: [] },
        { status: 404 }
      );
    }

    return NextResponse.json(subgraph, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[graph] build failed", err);
    return NextResponse.json({ error: "Échec de la construction du graphe." }, { status: 500 });
  }
}
