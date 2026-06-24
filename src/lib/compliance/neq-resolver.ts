import { prisma } from "@/lib/prisma";

/**
 * NEQ resolution. The strongest, most honest link is RBQ-license -> NEQ: the
 * RBQ license number's first 4 digits ARE the NEQ (documented RBQ numbering
 * convention). Name-based links are fuzzy and MUST carry a confidence label —
 * never asserted as a single certain identity.
 */

export type EnterpriseLike = {
  id: string;
  neq: string | null;
  name: string | null;
  legalStatus?: string | null;
};

/**
 * Derive the NEQ prefix from an RBQ license number (e.g. "1234-5678-01" -> "1234").
 * Returns null for malformed input. Note: this is the NEQ *prefix*; a full NEQ
 * is 10 digits but the first 4 are sufficient for deterministic RBQ->NEQ linking.
 */
export function rbqToNeq(licenseNumber: string | null | undefined): string | null {
  if (!licenseNumber) return null;
  const match = /^(\d{4})/.exec(licenseNumber.replace(/\s+/g, ""));
  return match ? match[1] : null;
}

export type EnterpriseLookup = (neq: string) => Promise<EnterpriseLike | null>;
export type EnterpriseSearch = (name: string) => Promise<EnterpriseLike[]>;

export async function findEnterpriseByNeq(
  neq: string,
  lookup: EnterpriseLookup,
): Promise<EnterpriseLike | null> {
  return lookup(neq);
}

export type NameNeqCandidate = {
  neq: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low";
};

/**
 * Fuzzy name -> NEQ candidates. Confidence is based on normalized similarity:
 * high = exact normalized match; medium = strong token overlap (one contains
 * the other); low = partial/none. Never returns a single asserted identity —
 * always ranked candidates with explicit confidence.
 */
export async function nameToNeq(
  query: string,
  search: EnterpriseSearch,
): Promise<NameNeqCandidate[]> {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(query);
  if (!q) return [];

  const rows = await search(query);
  return rows
    .map((r) => {
      const name = norm(r.name ?? "");
      if (!name) return { neq: r.neq, name: r.name, confidence: "low" as const };
      const confidence: NameNeqCandidate["confidence"] =
        name === q ? "high" : name.includes(q) || q.includes(name) ? "medium" : "low";
      return { neq: r.neq, name: r.name, confidence };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.confidence] - rank[b.confidence];
    });
}

/** Production dependency wiring against Prisma. */
export function productionLookups() {
  return {
    byNeq: async (neq: string): Promise<EnterpriseLike | null> => {
      const r = await prisma.enterpriseRecord.findUnique({ where: { neq } });
      return r ? { id: r.id, neq: r.neq, name: r.name, legalStatus: r.legalStatus } : null;
    },
    byName: async (name: string): Promise<EnterpriseLike[]> => {
      const rows = await prisma.enterpriseRecord.findMany({
        where: { name: { contains: name } },
        take: 20,
      });
      return rows.map((r) => ({ id: r.id, neq: r.neq, name: r.name, legalStatus: r.legalStatus }));
    },
  };
}
