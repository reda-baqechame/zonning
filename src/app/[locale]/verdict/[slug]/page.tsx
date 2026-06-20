import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import IntelligenceLayerBadges from "@/components/IntelligenceLayerBadges";
import VerdictStamp from "@/components/VerdictStamp";
import { Link } from "@/i18n/navigation";
import type { PropertyIntelligence } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import { computeVerdictTier, type VerdictTier } from "@/lib/verdict/compute-verdict";
import VerdictShareTracker from "./VerdictShareTracker";
import ZoningExpertPanel from "@/components/ZoningExpertPanel";
import { buildZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";

const TIER_LABELS: Record<string, { fr: string; en: string }> = {
  insufficient_data: { fr: "Données insuffisantes", en: "Insufficient data" },
  eleve: { fr: "Potentiel élevé", en: "High potential" },
  moyen: { fr: "Potentiel moyen", en: "Moderate potential" },
  faible: { fr: "Potentiel faible", en: "Low potential" },
  bloque: { fr: "Bloqué / risque élevé", en: "Blocked / high risk" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = await prisma.verdictReport.findUnique({ where: { shareSlug: slug } });
  if (!report) return { title: "ZONNING" };

  const intel = report.inputsJson
    ? (JSON.parse(report.inputsJson) as PropertyIntelligence)
    : ({} as PropertyIntelligence);
  const currentVerdict = computeVerdictTier(intel);
  const label = TIER_LABELS[currentVerdict.tier]?.fr ?? "ZONNING";
  const ogParams = new URLSearchParams({
    tier: currentVerdict.tier,
    label,
    address: report.address.slice(0, 80),
  });

  return {
    title: `ZONNING — ${label}`,
    description: `Verdict de potentiel pour ${report.address}`,
    openGraph: {
      title: `ZONNING — ${label}`,
      description: report.address,
      images: [`/api/og/verdict?${ogParams.toString()}`],
    },
    twitter: {
      card: "summary_large_image",
      title: `ZONNING — ${label}`,
      images: [`/api/og/verdict?${ogParams.toString()}`],
    },
  };
}

export default async function VerdictSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ utm_source?: string }>;
}) {
  const { slug } = await params;
  const { utm_source: utmSource } = await searchParams;
  const locale = await getLocale();
  const report = await prisma.verdictReport.findUnique({ where: { shareSlug: slug } });
  if (!report) notFound();

  const intel = report.inputsJson
    ? (JSON.parse(report.inputsJson) as PropertyIntelligence)
    : ({} as PropertyIntelligence);
  const verdict = computeVerdictTier(intel);
  const zoningAnalysis = buildZoningExpertAnalysis(intel);
  const label = locale === "fr" ? verdict.labelFr : verdict.labelEn;
  const summary = locale === "fr" ? report.summaryFr : report.summaryEn;
  const reasons = locale === "fr" ? verdict.reasonsFr : verdict.reasonsEn;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-ink">
      <VerdictShareTracker slug={slug} utmSource={utmSource} />
      <VerdictStamp
        tier={verdict.tier as VerdictTier}
        label={label}
        address={report.address}
      />
      {summary && <p className="mt-6 text-muted">{summary}</p>}
      <IntelligenceLayerBadges intel={intel} locale={locale} />
      {reasons.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-subtle">
          {reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      )}
      <div className="mt-8 border-t border-line pt-6">
        <ZoningExpertPanel analysis={zoningAnalysis} />
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/verdict" className="font-semibold text-brand hover:underline">
          {locale === "fr" ? "Nouvelle adresse" : "New address"} →
        </Link>
        <Link href="/register" className="font-semibold text-success hover:underline">
          ZONNING Pro →
        </Link>
      </div>
    </div>
  );
}
