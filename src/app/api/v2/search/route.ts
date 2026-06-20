import { NextRequest, NextResponse } from "next/server";
import { buildSiteDossier } from "@/lib/api/v2";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { COVERAGE_CITIES, DATASETS, getDatasetCoverageStatus, getRegisteredDatasetIds } from "@/lib/datasets/registry";
import { looksLikeCivicAddress } from "@/lib/search-query";
import { getPermitCoverageStatusForCity } from "@/lib/quebec-coverage";
import type { SiteDossier } from "@/lib/domain/quebec";

type IntelligenceSearchResult = {
  id: string;
  kind: "site" | "municipality" | "permit" | "tender" | "company" | "dataset";
  title: string;
  subtitle: string;
  href: string;
  confidence: number;
  coverageStatus: string;
  freshness: string;
  source: {
    title: string;
    url: string;
  };
  signals: string[];
  limitations: string[];
  recommendedNextAction: string;
};

function freshness(value: Date | string | null | undefined, locale: "fr" | "en") {
  if (!value) return locale === "fr" ? "inconnue" : "unknown";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return locale === "fr" ? "inconnue" : "unknown";
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return locale === "fr" ? "aujourd'hui" : "today";
  if (days === 1) return locale === "fr" ? "hier" : "yesterday";
  return locale === "fr" ? `il y a ${days} jours` : `${days} days ago`;
}

function textMatch(value: string | null | undefined, q: string) {
  return value?.toLowerCase().includes(q.toLowerCase()) ?? false;
}

function latestEvidenceDate(dossier: SiteDossier): string | null {
  const values = [
    ...dossier.signals.map(
      (signal) => signal.refreshedAt ?? signal.source.refreshedAt ?? signal.observedAt,
    ),
    ...dossier.permits.map(
      (permit) => permit.source.refreshedAt ?? permit.source.observedAt ?? permit.date,
    ),
  ];
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!latest || parsed > latest) latest = parsed;
  }
  return latest?.toISOString() ?? null;
}

function siteLimitations(dossier: SiteDossier, locale: "fr" | "en"): string[] {
  const summary = dossier.evidenceSummary;
  const items: string[] = [];
  if (summary.parcelSignals === 0 && summary.addressMatchedPermits === 0) {
    items.push(
      locale === "fr"
        ? "Aucune preuve n'est rattachée directement à la parcelle ou à l'adresse civique."
        : "No evidence is directly tied to the parcel or civic address.",
    );
  }
  if (summary.contextualSignals > 0) {
    items.push(
      locale === "fr"
        ? "Les registres trouvés sont des signaux de proximité ou de secteur; ils ne prouvent pas le statut juridique du lot."
        : "The matched records are proximity or area context; they do not prove the parcel's legal status.",
    );
  }
  if (!summary.canIssueParcelConclusion) {
    items.push(
      locale === "fr"
        ? "Aucune conclusion de conformité de zonage n'est émise sans règlement et grille applicables à la parcelle."
        : "No zoning compliance conclusion is issued without the bylaw and schedule applicable to the parcel.",
    );
  }
  items.push(
    locale === "fr"
      ? "Renseignement opérationnel seulement; vérifiez chaque source officielle avant d'agir."
      : "Operational intelligence only; verify every official source before acting.",
  );
  return items;
}

export async function GET(req: NextRequest) {
  const limited = await rateLimitAsync(`api:v2:search:${clientIp(req)}`, 80, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const locale = req.nextUrl.searchParams.get("locale") === "fr" ? "fr" : "en";
  if (!q || q.length < 2) {
    return NextResponse.json(
      {
        error:
          locale === "fr"
            ? "La recherche doit contenir au moins 2 caractères."
            : "q must contain at least 2 characters",
      },
      { status: 400 },
    );
  }

  const city = req.nextUrl.searchParams.get("city");
  const borough = req.nextUrl.searchParams.get("borough");
  const results: IntelligenceSearchResult[] = [];

  if (looksLikeCivicAddress(q)) {
    const dossier = await buildSiteDossier({ address: q, city, borough });
    const summary = dossier.evidenceSummary;
    const hasDirectEvidence = summary.parcelSignals > 0 || summary.addressMatchedPermits > 0;
    const hasContext = summary.contextualSignals > 0;
    const hasEvidence = hasDirectEvidence || hasContext;
    const source = dossier.signals[0]?.source ?? dossier.permits[0]?.source;
    results.push({
      id: dossier.id,
      kind: "site",
      title: dossier.address,
      subtitle: hasDirectEvidence
        ? `${dossier.municipality ?? city ?? "Québec"} · verdict ${dossier.verdict}`
        : hasContext
          ? locale === "fr"
            ? "Contexte de proximité seulement · aucune conclusion parcellaire"
            : "Nearby context only · no parcel conclusion"
        : locale === "fr"
          ? "Aucune preuve foncière vérifiée ne correspond à cette adresse"
          : "No verified property evidence matched this address",
      href: `/verdict?query=${encodeURIComponent(q)}`,
      confidence: summary.decisionConfidence,
      coverageStatus: dossier.coverageStatus,
      freshness: hasEvidence
        ? freshness(latestEvidenceDate(dossier), locale)
        : locale === "fr"
          ? "indisponible"
          : "not available",
      source: {
        title:
          source?.title ??
          (locale === "fr" ? "Registre de couverture" : "Coverage registry"),
        url: source?.url ?? "/coverage",
      },
      signals: hasEvidence
        ? locale === "fr"
          ? [
              `${summary.parcelSignals} signal(s) parcellaire(s)`,
              `${summary.addressMatchedPermits} permis correspondant à l'adresse`,
              `${summary.contextualSignals} signal(s) de proximité ou de secteur`,
              summary.canIssueParcelConclusion
                ? "Règles de zonage parcellaires vérifiées"
                : "Conformité de zonage non déterminée",
            ]
          : [
              `${summary.parcelSignals} parcel signal(s)`,
              `${summary.addressMatchedPermits} address-matched permit(s)`,
              `${summary.contextualSignals} proximity or area-context signal(s)`,
              summary.canIssueParcelConclusion
                ? "Parcel zoning rules verified"
                : "Zoning compliance not determined",
            ]
        : [],
      limitations: siteLimitations(dossier, locale),
      recommendedNextAction: hasDirectEvidence
        ? locale === "fr"
          ? "Ouvrez le dossier pour examiner les preuves directement rattachées, les contraintes et les limites."
          : "Open the dossier to inspect directly matched evidence, constraints, and limitations."
        : hasContext
          ? locale === "fr"
            ? "Confirmez le lot cadastral et les règlements municipaux avant d'utiliser ces signaux de proximité."
            : "Confirm the cadastral lot and municipal rules before using these nearby signals."
        : locale === "fr"
          ? "Vérifiez la couverture et la source officielle de la municipalité avant de vous fier à cette adresse."
          : "Check coverage and the official municipality source before relying on this address.",
    });
  }

  const [permits, tenders, companies, rbqLicenses, suppliers] = await Promise.all([
    prisma.permit.findMany({
      where: {
        OR: [
          { address: { contains: q } },
          { permitType: { contains: q } },
          { permitNumber: { contains: q } },
          { applicantName: { contains: q } },
          { city: { contains: q } },
        ],
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
    prisma.tender.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { organization: { contains: q } },
          { region: { contains: q } },
          { category: { contains: q } },
        ],
      },
      orderBy: [{ closesAt: "asc" }, { publishedAt: "desc" }],
      take: 4,
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { rbqNumber: { contains: q } },
          { city: { contains: q } },
          { sector: { contains: q } },
        ],
      },
      take: 4,
    }),
    prisma.rbqLicense.findMany({
      where: {
        OR: [
          { licenseNumber: { contains: q } },
          { holderName: { contains: q } },
          { subclass: { contains: q } },
        ],
      },
      take: 4,
    }),
    prisma.municipalSupplier.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { neq: { contains: q } },
          { borough: { contains: q } },
        ],
      },
      take: 4,
    }),
  ]);

  for (const municipality of COVERAGE_CITIES.filter((name) => textMatch(name, q)).slice(0, 5)) {
    const coverage = getPermitCoverageStatusForCity(municipality);
    const indexedPermitCount = await prisma.permit.count({ where: { city: municipality } });
    results.push({
      id: `municipality_${municipality}`,
      kind: "municipality",
      title: municipality,
      subtitle:
        locale === "fr"
          ? "Profil de couverture municipale"
          : "Municipality intelligence profile",
      href: `/coverage?city=${encodeURIComponent(municipality)}`,
      confidence: indexedPermitCount > 0 ? 0.7 : 0.25,
      coverageStatus: coverage.status,
      freshness:
        indexedPermitCount > 0
          ? locale === "fr"
            ? "compte de la base indexée"
            : "indexed database count"
          : locale === "fr"
            ? "aucun permis indexé"
            : "no indexed permits",
      source: {
        title: coverage.label,
        url: coverage.sourceUrl ?? "/coverage",
      },
      signals:
        locale === "fr"
          ? [
              `${indexedPermitCount} enregistrement(s) de permis indexé(s)`,
              `État de la source de permis : ${coverage.label}`,
            ]
          : [
              `${indexedPermitCount} indexed permit record(s)`,
              `Permit source status: ${coverage.label}`,
            ],
      limitations: [
        coverage.note ??
          (locale === "fr"
            ? "Les champs et la fréquence de mise à jour varient selon la source officielle."
            : "Municipal fields and update frequency vary by official source."),
      ],
      recommendedNextAction:
        locale === "fr"
          ? "Ouvrez la couverture pour vérifier les sources indexées, périmées, documentaires ou manquantes."
          : "Open coverage to inspect live, stale, document-only and missing municipal sources.",
    });
  }

  for (const p of permits) {
    results.push({
      id: `permit_${p.id}`,
      kind: "permit",
      title: p.permitType,
      subtitle: `${p.address} · ${p.city}${p.estimatedCost ? ` · ${p.estimatedCost.toLocaleString("fr-CA")} $` : ""}`,
      href: `/feed?permit=${encodeURIComponent(p.id)}`,
      confidence: p.sourceUrl ? 0.78 : 0.42,
      coverageStatus: p.sourceUrl ? "authoritative" : "partial",
      freshness: freshness(p.issueDate ?? p.createdAt, locale),
      source: { title: "Municipal permit registry", url: p.sourceUrl },
      signals: [
        p.applicantName ? `Applicant: ${p.applicantName}` : "Applicant not normalized",
        p.requiredRbqClasses ? "RBQ class hints available" : "RBQ class hints missing",
        p.estimatedCost ? "Comparable value available" : "Estimated value missing",
      ],
      limitations: ["Permit fields vary by municipality and must be reviewed at the official source."],
      recommendedNextAction: "Open the opportunity and verify scope, applicant, RBQ fit and source document.",
    });
  }

  for (const t of tenders) {
    results.push({
      id: `tender_${t.id}`,
      kind: "tender",
      title: t.title,
      subtitle: `${t.organization ?? "Public buyer"} · ${t.region ?? "Quebec"}${t.closesAt ? ` · closes ${t.closesAt.toLocaleDateString("fr-CA")}` : ""}`,
      href: `/feed?tender=${encodeURIComponent(t.id)}`,
      confidence: t.sourceUrl ? 0.82 : 0.45,
      coverageStatus: "authoritative",
      freshness: freshness(t.publishedAt ?? t.createdAt, locale),
      source: { title: "SEAO tender", url: t.sourceUrl },
      signals: [
        t.closesAt ? "Deadline available" : "Deadline missing",
        t.requiresAmp ? "AMP review likely required" : "AMP requirement not flagged",
        t.estimatedValue ? "Estimated value available" : "Estimated value missing",
      ],
      limitations: ["Official SEAO documents and addenda must be reviewed before bidding."],
      recommendedNextAction: "Review official SEAO documents, deadline, addenda and bid/no-bid fit.",
    });
  }

  for (const c of companies) {
    results.push({
      id: `company_${c.id}`,
      kind: "company",
      title: c.name,
      subtitle: `${c.city ?? c.region ?? "Quebec"}${c.rbqNumber ? ` · RBQ ${c.rbqNumber}` : ""}`,
      href: `/partenaires-ca?company=${encodeURIComponent(c.id)}`,
      confidence: c.sourceUrl ? 0.7 : 0.48,
      coverageStatus: "partial",
      freshness: "profile indexed",
      source: { title: "Company / supplier registry", url: c.sourceUrl ?? "/coverage" },
      signals: [
        c.sector ? `Sector: ${c.sector}` : "Sector missing",
        c.certifications ? "Certifications available" : "Certifications missing",
        c.rbqNumber ? "RBQ number attached" : "RBQ number missing",
      ],
      limitations: ["Company enrichment depends on public registry availability and may be incomplete."],
      recommendedNextAction: "Open the company profile and verify RBQ, public contracts and contact evidence.",
    });
  }

  for (const rbq of rbqLicenses) {
    results.push({
      id: `rbq_${rbq.id}`,
      kind: "company",
      title: rbq.holderName ?? rbq.licenseNumber,
      subtitle: `RBQ ${rbq.licenseNumber}${rbq.subclass ? ` · ${rbq.subclass}` : ""}`,
      href: `/partenaires-ca?rbq=${encodeURIComponent(rbq.licenseNumber)}`,
      confidence: 0.82,
      coverageStatus: "authoritative",
      freshness: freshness(rbq.sourceFetchedAt, locale),
      source: { title: "RBQ active licences", url: rbq.sourceUrl },
      signals: [`Status: ${rbq.status}`, rbq.expiryDate ? `Expiry: ${rbq.expiryDate.toLocaleDateString("fr-CA")}` : "Expiry missing"],
      limitations: ["Licence status must be verified at the official RBQ source before contractual use."],
      recommendedNextAction: "Open company intelligence and compare licence class against the opportunity scope.",
    });
  }

  for (const s of suppliers) {
    results.push({
      id: `supplier_${s.id}`,
      kind: "company",
      title: s.name,
      subtitle: `${s.borough ?? "Municipal supplier"}${s.neq ? ` · NEQ ${s.neq}` : ""}`,
      href: `/partenaires-ca?supplier=${encodeURIComponent(s.id)}`,
      confidence: s.sourceUrl ? 0.7 : 0.45,
      coverageStatus: "partial",
      freshness: freshness(s.sourceFetchedAt, locale),
      source: { title: "Municipal supplier source", url: s.sourceUrl },
      signals: [s.phone ? "Phone available" : "Phone missing", s.address ? "Address available" : "Address missing"],
      limitations: ["Supplier records vary by municipality and may not include full contact history."],
      recommendedNextAction: "Open company intelligence and inspect municipal supplier evidence.",
    });
  }

  for (const id of getRegisteredDatasetIds().filter((id) => textMatch(DATASETS[id].label, q) || textMatch(id, q)).slice(0, 5)) {
    const dataset = DATASETS[id];
    const status = getDatasetCoverageStatus(id);
    results.push({
      id: `dataset_${id}`,
      kind: "dataset",
      title: dataset.label,
      subtitle: `${status} · ${dataset.syncEnabled === false ? "document-only" : "sync candidate"}`,
      href: `/coverage?source=${encodeURIComponent(id)}`,
      confidence: dataset.syncEnabled === false ? 0.5 : 0.75,
      coverageStatus: status,
      freshness: dataset.syncEnabled === false ? "not indexed" : "registry checked live",
      source: { title: dataset.label, url: dataset.sourceUrl },
      signals: [dataset.preferredFormat.toString(), dataset.tier, dataset.city ? `City: ${dataset.city}` : "Quebec-wide or multi-region"],
      limitations: [dataset.coverageNote ?? "Dataset status is registered but not fully validated."],
      recommendedNextAction: "Open coverage to inspect source status, sync state and limitations.",
    });
  }

  const unique = new Map<string, IntelligenceSearchResult>();
  for (const result of results) unique.set(`${result.kind}:${result.id}`, result);

  return NextResponse.json({
    version: "v2",
    query: q,
    resultCount: unique.size,
    results: [...unique.values()].slice(0, 12),
  });
}
