import { rbqToNeq } from "@/lib/compliance/neq-resolver";

export type ContractorCompliance = {
  neq: string | null;
  legalName: string | null;
  legalStatus: "active" | "dissolved" | "unknown";
  rbqLicense: { number: string; subclass: string | null; status: string; expiry: Date | null } | null;
  renaNonAdmissible: {
    active: boolean;
    offence?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  } | null;
  sanctions: { count: number; recent: { law?: string | null; amount?: number | null; date?: Date | null }[] };
  convictions: { count: number; recent: { offence?: string | null; date?: Date | null }[] };
  injuryClaims: { totalClaims: number; recentYear?: number | null } | null;
  awardsWon: {
    count: number;
    totalValue: number;
    recent: { name?: string | null; value?: number | null; date?: string | null }[];
  };
  publicBidEligible: boolean;
  overallRisk: "low" | "medium" | "high" | "unknown";
};

export type ComplianceInput = { neq?: string | null; licenseNumber?: string | null };
export type ComplianceDeps = {
  findRena: (
    neq: string,
  ) => Promise<{
    active: boolean;
    offence?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  } | null>;
  findEnterprise: (
    neq: string,
  ) => Promise<{ neq: string; name: string | null; legalStatus: string | null } | null>;
  findSanctions: (
    neq: string,
  ) => Promise<{ law?: string | null; amount?: number | null; date?: Date | null }[]>;
  findConvictions: (neq: string) => Promise<{ offence?: string | null; date?: Date | null }[]>;
  findInjuries: (neq: string) => Promise<{ totalClaims: number; recentYear?: number | null } | null>;
  findAwards: (
    neq: string,
  ) => Promise<{
    count: number;
    totalValue: number;
    recent: { name?: string | null; value?: number | null; date?: string | null }[];
  }>;
  findRbq: (
    neq: string,
  ) => Promise<{ number: string; subclass: string | null; status: string; expiry: Date | null } | null>;
};

export async function assembleCompliance(
  input: ComplianceInput,
  deps: ComplianceDeps,
): Promise<ContractorCompliance> {
  const neq = input.neq ?? rbqToNeq(input.licenseNumber);

  if (!neq) {
    return emptyCompliance(null);
  }

  const [rena, enterprise, sanctions, convictions, injuries, awards, rbq] = await Promise.all([
    deps.findRena(neq).catch(() => null),
    deps.findEnterprise(neq).catch(() => null),
    deps.findSanctions(neq).catch(() => []),
    deps.findConvictions(neq).catch(() => []),
    deps.findInjuries(neq).catch(() => null),
    deps.findAwards(neq).catch(() => ({ count: 0, totalValue: 0, recent: [] })),
    deps.findRbq(neq).catch(() => null),
  ]);

  const renaActive = rena?.active === true;
  const legalStatus: ContractorCompliance["legalStatus"] =
    enterprise?.legalStatus?.toLowerCase().includes("dissou") ||
    enterprise?.legalStatus?.toLowerCase().includes("radie")
      ? "dissolved"
      : enterprise?.legalStatus
        ? "active"
        : "unknown";

  const hasData =
    rena || enterprise || sanctions.length || convictions.length || injuries || rbq;
  let overallRisk: ContractorCompliance["overallRisk"];
  if (renaActive || convictions.length > 0) overallRisk = "high";
  else if (sanctions.length >= 3 || (injuries && injuries.totalClaims > 20)) overallRisk = "medium";
  else if (hasData) overallRisk = "low";
  else overallRisk = "unknown";

  return {
    neq,
    legalName: enterprise?.name ?? null,
    legalStatus,
    rbqLicense: rbq,
    renaNonAdmissible: rena,
    sanctions: { count: sanctions.length, recent: sanctions.slice(0, 5) },
    convictions: { count: convictions.length, recent: convictions.slice(0, 5) },
    injuryClaims: injuries,
    awardsWon: awards,
    publicBidEligible: !renaActive,
    overallRisk,
  };
}

function emptyCompliance(neq: string | null): ContractorCompliance {
  return {
    neq,
    legalName: null,
    legalStatus: "unknown",
    rbqLicense: null,
    renaNonAdmissible: null,
    sanctions: { count: 0, recent: [] },
    convictions: { count: 0, recent: [] },
    injuryClaims: null,
    awardsWon: { count: 0, totalValue: 0, recent: [] },
    publicBidEligible: true,
    overallRisk: "unknown",
  };
}

/** Production dependency wiring. */
export function productionComplianceDeps(): ComplianceDeps {
  const isActive = (rec: { startDate?: Date | null; endDate?: Date | null } | null) => {
    if (!rec) return false;
    const now = new Date();
    if (rec.endDate && rec.endDate < now) return false;
    return true;
  };
  return {
    findRena: async (neq) => {
      const { prisma } = await import("@/lib/prisma");
      const rec = await prisma.renaRecord.findFirst({
        where: { neq },
        orderBy: { startDate: "desc" },
      });
      if (!rec) return null;
      return {
        active: isActive(rec),
        offence: rec.offence,
        startDate: rec.startDate,
        endDate: rec.endDate,
      };
    },
    findEnterprise: async (neq) => {
      const { prisma } = await import("@/lib/prisma");
      const r = await prisma.enterpriseRecord.findUnique({ where: { neq } });
      return r ? { neq: r.neq ?? neq, name: r.name, legalStatus: r.legalStatus } : null;
    },
    findSanctions: async (neq) => {
      const { prisma } = await import("@/lib/prisma");
      const rows = await prisma.sanctionRecord.findMany({
        where: { neq },
        orderBy: { date: "desc" },
        take: 5,
      });
      return rows.map((r) => ({ law: r.law, amount: r.amount, date: r.date }));
    },
    findConvictions: async (neq) => {
      const { prisma } = await import("@/lib/prisma");
      const rows = await prisma.convictionRecord.findMany({
        where: { neq },
        orderBy: { date: "desc" },
        take: 5,
      });
      return rows.map((r) => ({ offence: r.offence, date: r.date }));
    },
    findInjuries: async (neq) => {
      const { prisma } = await import("@/lib/prisma");
      const rows = await prisma.injuryClaim.findMany({
        where: { neq },
        orderBy: { year: "desc" },
        take: 1,
      });
      if (!rows.length) return null;
      return { totalClaims: rows[0].claimCount, recentYear: rows[0].year };
    },
    findAwards: async (_neq) => {
      return { count: 0, totalValue: 0, recent: [] };
    },
    findRbq: async (neq) => {
      const { prisma } = await import("@/lib/prisma");
      const r = await prisma.rbqLicense.findFirst({ where: { neq } });
      if (!r) return null;
      return {
        number: r.licenseNumber,
        subclass: r.subclass,
        status: r.status,
        expiry: r.expiryDate,
      };
    },
  };
}
