import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import VerdictStamp from "@/components/VerdictStamp";
import { computeVerdictTier } from "@/lib/verdict/compute-verdict";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { VerdictTier } from "@/lib/verdict/compute-verdict";
import { Link } from "@/i18n/navigation";
import VerdictShareTracker from "./VerdictShareTracker";
import IntelligenceLayerBadges from "@/components/IntelligenceLayerBadges";

const TIER_LABELS: Record<string, { fr: string; en: string }> = {
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
  if (!report) return { title: "PERMIS.AI" };

  const label = TIER_LABELS[report.tier]?.fr ?? "PERMIS.AI";
  const ogParams = new URLSearchParams({
    tier: report.tier,
    label,
    address: report.address.slice(0, 80),
  });

  return {
    title: `PERMIS.AI — ${label}`,
    description: `Verdict de potentiel pour ${report.address}`,
    openGraph: {
      title: `PERMIS.AI — ${label}`,
      description: report.address,
      images: [`/api/og/verdict?${ogParams.toString()}`],
    },
    twitter: {
      card: "summary_large_image",
      title: `PERMIS.AI — ${label}`,
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
  const label = locale === "fr" ? verdict.labelFr : verdict.labelEn;
  const summary = locale === "fr" ? report.summaryFr : report.summaryEn;
  const reasons = locale === "fr" ? verdict.reasonsFr : verdict.reasonsEn;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <VerdictShareTracker slug={slug} utmSource={utmSource} />
      <VerdictStamp
        tier={report.tier as VerdictTier}
        label={label}
        address={report.address}
      />
      {summary && <p className="mt-6 text-slate-300">{summary}</p>}
      <IntelligenceLayerBadges intel={intel} locale={locale} />
      {reasons.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-slate-500">
          {reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      )}
      <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/verdict" className="text-sky-400 hover:text-sky-300">
          {locale === "fr" ? "Nouvelle adresse" : "New address"} →
        </Link>
        <Link href="/register" className="text-emerald-400 hover:text-emerald-300">
          ZONNING Pro →
        </Link>
      </div>
    </div>
  );
}
