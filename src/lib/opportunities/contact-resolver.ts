import { prisma } from "@/lib/prisma";

/**
 * Who-to-contact resolver. Permit applicants/owners are NEVER published
 * (privacy), so this never claims to return "the applicant." Instead, for a
 * permit it returns active RBQ licensees whose subclass matches the required
 * RBQ classes (licensed to do this work), and for a tender it returns the most
 * recent SEAO-awarded contractor for similar work (matched by unspsc/category).
 *
 * RbqLicense has NO region column (verified), so matching is subclass-only.
 */

export type ContactLead = {
  holderName: string;
  licenseNumber: string;
  subclass: string;
  sourceUrl: string;
};

export type ContactLeads = {
  permit?: {
    licensedContractors: ContactLead[];
    note: string;
  };
  tender?: {
    buyer: string;
    awardedContractor?: {
      name: string;
      date: string | null;
      value: number | null;
    };
    sourceUrl: string;
  };
};

export type LicenseeRow = {
  id: string;
  holderName: string | null;
  licenseNumber: string;
  subclass: string | null;
  status: string;
  sourceUrl: string;
};

/**
 * Match a licensee subclass against required classes. Exact, sibling in the
 * same family (1.1.x), or the family root (1.1) all count as a match.
 */
export function rbqClassMatches(
  required: string,
  licenseeSubclasses: string[],
): boolean {
  const fam = required.split(".").slice(0, 2).join("."); // "1.1.1" -> "1.1"
  return licenseeSubclasses.some(
    (s) => s === required || s.startsWith(fam + ".") || s === fam,
  );
}

export type ResolveInput =
  | { kind: "permit"; permitId: string; requiredRbqClasses: string[] }
  | {
      kind: "tender";
      tenderId: string;
      organization?: string | null;
      sourceUrl: string;
      unspsc?: string | null;
      category?: string | null;
    };

export type ResolveDeps = {
  findLicensees: (subclassesFilter?: string[]) => Promise<LicenseeRow[]>;
  findAward: (
    tenderId: string,
    unspsc?: string | null,
    category?: string | null,
  ) => Promise<{
    winnerName: string | null;
    awardDate: Date | null;
    awardAmount: number | null;
  } | null>;
  limit: number;
};

const NOTE_FR =
  "Liste d'entreprises titulaires d'une licence RBQ pour ce type de travaux (région non filtrée). Il ne s'agit PAS du demandeur du permis.";
const NOTE_EN =
  "List of enterprises holding an RBQ licence for this type of work (region not filtered). These are NOT the permit applicant.";

export async function resolveContactLeads(
  input: ResolveInput,
  deps: ResolveDeps,
): Promise<ContactLeads> {
  if (input.kind === "permit") {
    const required = input.requiredRbqClasses ?? [];
    const all = await deps.findLicensees();
    const matched = all
      .filter(
        (l) =>
          l.status === "active" &&
          l.subclass &&
          rbqClassMatches(l.subclass, required),
      )
      .map((l) => ({
        holderName: l.holderName ?? l.licenseNumber,
        licenseNumber: l.licenseNumber,
        subclass: l.subclass as string,
        sourceUrl: l.sourceUrl,
      }))
      .slice(0, deps.limit);
    return {
      permit: { licensedContractors: matched, note: `${NOTE_FR} / ${NOTE_EN}` },
    };
  }

  // tender — find the most recent similar award's winner
  const award = await deps.findAward(
    input.tenderId,
    input.unspsc,
    input.category,
  );
  return {
    tender: {
      buyer: input.organization ?? "Organisme acheteur",
      awardedContractor: award?.winnerName
        ? {
            name: award.winnerName,
            date: award.awardDate ? award.awardDate.toISOString() : null,
            value: award.awardAmount ?? null,
          }
        : undefined,
      sourceUrl: input.sourceUrl,
    },
  };
}

/** Production dependency wiring against Prisma (real schema fields). */
export function productionDeps(limit = 8): ResolveDeps {
  return {
    limit,
    findLicensees: async () => {
      // RbqLicense has no region column; pull active licensees and filter by
      // subclass family in-memory. Capped to keep request cost bounded.
      const rows = await prisma.rbqLicense.findMany({
        where: { status: "active" },
        select: {
          id: true,
          holderName: true,
          licenseNumber: true,
          subclass: true,
          status: true,
          sourceUrl: true,
        },
        take: 5000,
      });
      return rows as LicenseeRow[];
    },
    findAward: async (_tenderId, unspsc, category) => {
      if (!unspsc && !category) return null;
      const award = await prisma.tenderAward.findFirst({
        where: {
          OR: [
            ...(unspsc ? [{ unspsc }] : []),
            ...(category ? [{ category: { contains: category } }] : []),
          ],
        },
        orderBy: { awardDate: "desc" },
        select: { winnerName: true, awardDate: true, awardAmount: true },
      });
      if (!award) return null;
      return {
        winnerName: award.winnerName,
        awardDate: award.awardDate,
        awardAmount: award.awardAmount ?? null,
      };
    },
  };
}
