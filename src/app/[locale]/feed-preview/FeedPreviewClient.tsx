"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { LeadCard } from "@/components/LeadCard";
import { Button, EmptyState, SkeletonList } from "@/components/ui";
import type { LeadSignal } from "@/lib/lead-signals";

type PermitItem = {
  id: string;
  pipelineScore?: number;
  rbqFit?: { eligible: boolean; score: number };
  signals?: LeadSignal[];
  permitType: string;
  address: string;
  borough?: string | null;
  estimatedCost?: number | null;
  sourceUrl?: string;
  applicantName?: string | null;
};
type TenderItem = {
  id: string;
  score?: number;
  matchScore?: number;
  signals?: LeadSignal[];
  title: string;
  organization?: string | null;
  daysLeft?: number | null;
  isThursday?: boolean;
  urgent?: boolean;
  requiresAmp?: boolean;
  plainSummary?: string;
  sourceUrl: string;
};

const SAMPLE_LIMIT = 10;
const CONSTRUCTION_TERMS = [
  "construction",
  "renovation",
  "rénovation",
  "refection",
  "réfection",
  "travaux",
  "toiture",
  "batiment",
  "bâtiment",
  "ecole",
  "école",
  "aqueduc",
  "route",
  "pavage",
  "parc",
  "electric",
  "électri",
  "plomberie",
  "mecanique",
  "mécanique",
];
const SUMMARY_CONSTRUCTION_TERMS = CONSTRUCTION_TERMS.filter(
  (term) => term !== "construction",
);

function isConstructionTender(tender: TenderItem) {
  const titleAndBuyer = [tender.title, tender.organization]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const summary = (tender.plainSummary ?? "").toLowerCase();
  return (
    CONSTRUCTION_TERMS.some((term) => titleAndBuyer.includes(term)) ||
    SUMMARY_CONSTRUCTION_TERMS.some((term) => summary.includes(term))
  );
}

export default function FeedPreviewClient({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("feedPreview");
  const locale = useLocale();
  const [permits, setPermits] = useState<PermitItem[]>([]);
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/permits?days=180").then((r) => r.json()).catch(() => ({})),
      fetch("/api/tenders").then((r) => r.json()).catch(() => ({})),
    ]).then(([p, t]) => {
      setPermits((p.permits ?? []).slice(0, SAMPLE_LIMIT));
      setTenders((t.tenders ?? []).filter(isConstructionTender).slice(0, SAMPLE_LIMIT));
      setLoading(false);
    });
  }, []);

  const empty = !loading && permits.length === 0 && tenders.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
          <p className="mt-2 text-muted">{t("subtitle")}</p>
        </div>
        <Link href={signedIn ? "/feed" : "/register"}>
          <Button>{signedIn ? t("openFeed") : t("signUp")}</Button>
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-lg border border-brand-border bg-brand-soft px-4 py-2 text-sm text-brand">
        <Lock className="h-4 w-4 shrink-0" />
        <span>{t("notice")}</span>
      </div>

      <div className="mt-8 space-y-3">
        {loading ? (
          <SkeletonList count={4} />
        ) : empty ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDesc")} />
        ) : (
          <>
            {tenders.map((t) => (
              <LeadCard
                key={t.id}
                locale={locale}
                item={{
                  kind: "tender",
                  id: t.id,
                  score: t.score ?? t.matchScore ?? 50,
                  signals: t.signals ?? [],
                  title: t.title,
                  organization: t.organization,
                  daysLeft: t.daysLeft,
                  isThursday: t.isThursday,
                  urgent: t.urgent,
                  requiresAmp: t.requiresAmp,
                  plainSummary: t.plainSummary,
                  sourceUrl: t.sourceUrl,
                }}
              />
            ))}
            {permits.map((p) => (
              <LeadCard
                key={p.id}
                locale={locale}
                item={{
                  kind: "permit",
                  id: p.id,
                  score: p.pipelineScore ?? p.rbqFit?.score ?? 50,
                  signals: p.signals ?? [],
                  permitType: p.permitType,
                  address: p.address,
                  borough: p.borough,
                  estimatedCost: p.estimatedCost,
                  rbqFit: p.rbqFit,
                  sourceUrl: p.sourceUrl,
                  applicantName: p.applicantName,
                }}
              />
            ))}
          </>
        )}
      </div>

      <div className="mt-10 rounded-xl border border-line bg-white p-6 text-center">
        <p className="text-muted">{t("ctaTitle")}</p>
        <Link href={signedIn ? "/feed" : "/register"}>
          <Button className="mt-4">{signedIn ? t("openFeed") : t("signUp")}</Button>
        </Link>
      </div>
    </div>
  );
}
