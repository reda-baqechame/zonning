"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { Button, Input, FadeIn } from "@/components/ui";
import type {
  CapabilityStatement,
  PricingSkeleton,
  ProposalOutline,
} from "@/lib/proposals/build";
import type { OpportunityDecision } from "@/lib/opportunities/opportunity-decision";

type ProposalResponse = {
  tenderId: string;
  tenderTitle: string;
  decision: OpportunityDecision | null;
  capabilityStatement: CapabilityStatement;
  proposalOutline: ProposalOutline;
  pricingSkeleton: PricingSkeleton;
  error?: string;
};

function formatPack(pack: ProposalResponse): string {
  const lines: string[] = [pack.tenderTitle, ""];

  lines.push(`# ${pack.capabilityStatement.title}`);
  for (const section of pack.capabilityStatement.sections) {
    lines.push(`## ${section.heading}`, section.body, "");
  }

  lines.push(`# ${pack.proposalOutline.title}`);
  for (const section of pack.proposalOutline.sections) {
    lines.push(`## ${section.heading}`);
    for (const item of section.items) lines.push(`- ${item}`);
    lines.push("");
  }

  lines.push(`# ${pack.pricingSkeleton.title}`);
  lines.push(pack.pricingSkeleton.disclaimer);
  for (const item of pack.pricingSkeleton.lineItems) {
    lines.push(`- ${item.label}: ${item.note}`);
  }

  return lines.join("\n");
}

export default function ProposalsClient({ initialTenderId }: { initialTenderId: string }) {
  const t = useTranslations("proposals");
  const [tenderId, setTenderId] = useState(initialTenderId);
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<ProposalResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!tenderId.trim()) return;
    setLoading(true);
    setErr(null);
    setPack(null);
    try {
      const locale = window.location.pathname.includes("/en") ? "en" : "fr";
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId: tenderId.trim(), locale }),
      });
      const json: ProposalResponse = await res.json();
      if (!res.ok) {
        setErr(json.error ?? t("error"));
        return;
      }
      setPack(json);
    } catch {
      setErr(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!pack) return;
    await navigator.clipboard.writeText(formatPack(pack));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FadeIn className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
          <FileText className="h-6 w-6 text-brand" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </header>

      <div className="rounded-lg border border-line bg-white p-4">
        <label className="text-xs font-semibold uppercase text-subtle">{t("tenderIdLabel")}</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            value={tenderId}
            onChange={(e) => setTenderId(e.target.value)}
            placeholder={t("tenderIdPlaceholder")}
            aria-label={t("tenderIdLabel")}
          />
          <Button onClick={generate} disabled={loading || !tenderId.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("generate")}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-subtle">{t("hint")}</p>
      </div>

      {err ? <p className="mt-4 text-sm text-danger">{err}</p> : null}

      {pack ? (
        <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{pack.tenderTitle}</p>
              {pack.decision ? (
                <p className="mt-1 text-xs text-muted">{pack.decision.headline}</p>
              ) : null}
            </div>
            <Button variant="secondary" size="sm" onClick={copyAll}>
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> {t("copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> {t("copyAll")}
                </>
              )}
            </Button>
          </div>

          <article className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">{pack.capabilityStatement.title}</h2>
            <div className="mt-3 space-y-3">
              {pack.capabilityStatement.sections.map((section) => (
                <div key={section.heading}>
                  <p className="text-xs font-semibold uppercase text-subtle">{section.heading}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{section.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">{pack.proposalOutline.title}</h2>
            <div className="mt-3 space-y-4">
              {pack.proposalOutline.sections.map((section) => (
                <div key={section.heading}>
                  <p className="text-xs font-semibold text-ink">
                    {section.heading}
                    {section.mandatory ? (
                      <span className="ml-2 text-[10px] uppercase text-warning">({t("mandatory")})</span>
                    ) : null}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-muted">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">{pack.pricingSkeleton.title}</h2>
            <p className="mt-1 text-xs text-warning">{pack.pricingSkeleton.disclaimer}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {pack.pricingSkeleton.lineItems.map((item) => (
                <li key={item.label}>
                  <span className="font-semibold text-ink">{item.label}</span> — {item.note}
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </FadeIn>
  );
}
