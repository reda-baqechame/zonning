"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ClipboardPaste,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  CircleAlert,
  CheckCircle2,
  ExternalLink,
  FileText,
  Ban,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button, Input, FadeIn } from "@/components/ui";

type TriageResponse = {
  source?: string;
  sourceLabel?: string;
  resolvable?: boolean;
  indexed?: boolean;
  tender?: {
    id: string;
    title: string;
    organization: string | null;
    region: string | null;
    category: string | null;
    estimatedValue: number | null;
    closesAt: string | null;
    sourceUrl: string;
    requiresAmp: boolean;
    status: string | null;
  } | null;
  triage?: {
    verdict: string;
    headline?: string;
    decision?: string;
    decisionLabel?: string;
    decisionRationale?: string;
    fitScore?: number;
    winProbability?: number;
    expectedValue?: number | null;
    confidence?: string;
    paperworkRisk?: string;
    deadlineRisk?: string;
    deadlineLabel?: string;
    competition?: string;
    requiredCertificates?: string[];
    worthBuyingDocuments?: boolean;
    nextAction?: string;
    checklist?: string[];
    officialUrl?: string;
  } | null;
  error?: string;
};

const riskColor = (level?: string) =>
  level === "high"
    ? "text-danger"
    : level === "medium"
      ? "text-warning"
      : "text-success";

const verdictTone = (verdict?: string) =>
  verdict === "pursue"
    ? { color: "text-success", Icon: CheckCircle2 }
    : verdict === "skip"
      ? { color: "text-danger", Icon: Ban }
      : verdict === "verify" || verdict === "verify_on_site"
        ? { color: "text-warning", Icon: ShieldAlert }
        : { color: "text-muted", Icon: CircleAlert };

function money(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

export default function TriageClient() {
  const t = useTranslations("triage");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TriageResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const locale = window.location.pathname.includes("/en") ? "en" : "fr";
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, locale }),
      });
      const json: TriageResponse = await res.json();
      if (!res.ok) {
        setErr(json.error ?? t("error"));
      } else {
        setData(json);
      }
    } catch {
      setErr(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const tri = data?.triage;
  const tone = verdictTone(tri?.verdict);

  return (
    <FadeIn className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
          <ClipboardPaste className="h-6 w-6 text-brand" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </header>

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") analyze();
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
          />
          <Button onClick={analyze} disabled={loading || !url.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("analyze")}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-subtle">{t("legalNote")}</p>
      </div>

      {err ? <p className="mt-4 text-sm text-danger">{err}</p> : null}

      {tri ? (
        <section className="mt-6 space-y-4">
          {/* Verdict header */}
          <div className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <tone.Icon className={`h-5 w-5 ${tone.color}`} />
                <div>
                  <p className={`text-sm font-semibold ${tone.color}`}>
                    {t(`verdict.${tri.verdict}`, { defaultValue: tri.decisionLabel ?? tri.verdict })}
                  </p>
                  {tri.headline ? <p className="mt-1 text-sm text-muted">{tri.headline}</p> : null}
                  {tri.decisionRationale ? (
                    <p className="mt-1 text-xs text-subtle">{tri.decisionRationale}</p>
                  ) : null}
                </div>
              </div>
              {typeof tri.fitScore === "number" ? (
                <div className="shrink-0 text-right">
                  <p className="tabular-nums text-2xl font-bold text-ink">{tri.fitScore}%</p>
                  <p className="text-[11px] text-subtle">{t("fitScore")}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Tender facts */}
          {data?.tender ? (
            <div className="rounded-lg border border-line bg-white p-5">
              <p className="text-xs font-semibold uppercase text-subtle">{t("whatItIs")}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{data.tender.title}</p>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-subtle">{t("buyer")}</dt>
                  <dd className="text-ink">{data.tender.organization ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">{t("region")}</dt>
                  <dd className="text-ink">{data.tender.region ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">{t("contractType")}</dt>
                  <dd className="text-ink">{data.tender.category ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">{t("value")}</dt>
                  <dd className="text-ink">{money(data.tender.estimatedValue) ?? "—"}</dd>
                </div>
              </dl>
              <a
                href={data.tender.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                {t("openOfficial")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}

          {/* Risk grid */}
          {(tri.paperworkRisk || tri.deadlineLabel) ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-white p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-subtle">
                  <FileText className="h-3.5 w-3.5" /> {t("paperworkRisk")}
                </p>
                <p className={`mt-1 text-sm font-semibold ${riskColor(tri.paperworkRisk)}`}>
                  {tri.paperworkRisk ? t(`risk.${tri.paperworkRisk}`) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-white p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-subtle">
                  <Clock className="h-3.5 w-3.5" /> {t("deadlineRisk")}
                </p>
                <p className={`mt-1 text-sm font-semibold ${riskColor(tri.deadlineRisk)}`}>
                  {tri.deadlineLabel ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-white p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-subtle">
                  <TrendingUp className="h-3.5 w-3.5" /> {t("winProbability")}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {typeof tri.winProbability === "number" ? `${tri.winProbability}%` : "—"}
                </p>
              </div>
            </div>
          ) : null}

          {/* Worth buying */}
          {typeof tri.worthBuyingDocuments === "boolean" ? (
            <div
              className={`rounded-lg border p-4 ${
                tri.worthBuyingDocuments
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand" />
                {tri.worthBuyingDocuments ? t("worthBuyingYes") : t("worthBuyingNo")}
              </p>
              <p className="mt-1 text-xs text-muted">{tri.nextAction}</p>
            </div>
          ) : null}

          {/* Required certs */}
          {tri.requiredCertificates && tri.requiredCertificates.length > 0 ? (
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase text-subtle">{t("requiredCerts")}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {tri.requiredCertificates.map((c) => (
                  <li key={c} className="flex gap-2">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Checklist (for non-indexed) */}
          {tri.checklist && tri.checklist.length > 0 ? (
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase text-subtle">{t("checklist")}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {tri.checklist.map((c) => (
                  <li key={c} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tri.officialUrl ? (
            <a
              href={tri.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              {t("openOfficial")} <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </section>
      ) : null}
    </FadeIn>
  );
}
