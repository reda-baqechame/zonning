"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  FileWarning,
  Flag,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  ThumbsDown,
  Wrench,
} from "lucide-react";
import { CockpitSidebar } from "@/components/CockpitSidebar";
import { Button } from "@/components/ui";
import { formatCad } from "@/lib/format-cad";
import type {
  BriefSection,
  CompanyFitProfile,
  QuebecOpportunityBrief,
  QualifiedBriefOpportunity,
} from "@/lib/quebec-qualification";
import type { RuntimeDataMode } from "@/lib/data-mode";

type InitialUser = {
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
  plan?: string;
} | null;

const SECTION_META: Record<BriefSection, { icon: typeof ArrowUpRight; label: string; description: string }> = {
  chase_now: {
    icon: ArrowUpRight,
    label: "Chase now",
    description: "High-fit items worth action this week.",
  },
  watch: {
    icon: Eye,
    label: "Watch",
    description: "Keep warm until source proof or timing improves.",
  },
  ignore: {
    icon: ThumbsDown,
    label: "Ignore / bad fit",
    description: "Do not waste estimating or sales time yet.",
  },
  new_permits: {
    icon: Building2,
    label: "New permits",
    description: "Early construction signals from municipal permit sources.",
  },
  closing_soon: {
    icon: Clock3,
    label: "Closing soon",
    description: "SEAO/public opportunities with time pressure.",
  },
  compliance_notes: {
    icon: ShieldCheck,
    label: "Compliance/license notes",
    description: "RBQ, AMP, RENA, Revenu Quebec and source-risk reminders.",
  },
  municipal_signals: {
    icon: Flag,
    label: "Municipal early signals",
    description: "Roadwork, capital-plan style, or pre-RFP municipal activity.",
  },
};

const SECTION_ORDER: BriefSection[] = [
  "chase_now",
  "watch",
  "ignore",
  "new_permits",
  "closing_soon",
  "compliance_notes",
  "municipal_signals",
];

function tagsToText(values: string[]) {
  return values.join(", ");
}

function textToTags(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreTone(score: number) {
  if (score >= 75) return "text-success-ink";
  if (score >= 50) return "text-brand";
  return "text-warning-ink";
}

function confidenceLabel(score: number) {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ProfileEditor({
  profile,
  saving,
  disabled,
  onSave,
}: {
  profile: CompanyFitProfile;
  saving: boolean;
  disabled: boolean;
  onSave: (profile: Partial<CompanyFitProfile>) => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState(profile.companyName ?? "");
  const [trades, setTrades] = useState(tagsToText(profile.trades.length ? profile.trades : profile.productsOrServices));
  const [regions, setRegions] = useState(tagsToText(profile.regions.length ? profile.regions : profile.municipalities));
  const [rbqLicenseNumber, setRbqLicenseNumber] = useState(profile.rbqLicenseNumber ?? "");
  const [rbqLicenseClasses, setRbqLicenseClasses] = useState(tagsToText(profile.rbqLicenseClasses));
  const [minJobValue, setMinJobValue] = useState(profile.minJobValue?.toString() ?? "");
  const [maxJobValue, setMaxJobValue] = useState(profile.maxJobValue?.toString() ?? "");
  const [ampAuthorized, setAmpAuthorized] = useState(Boolean(profile.ampAuthorized));

  return (
    <form
      className="border border-line bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          companyName,
          trades: textToTags(trades),
          productsOrServices: textToTags(trades),
          regions: textToTags(regions),
          municipalities: textToTags(regions),
          rbqLicenseNumber,
          rbqLicenseClasses: textToTags(rbqLicenseClasses),
          minJobValue: minJobValue ? Number(minJobValue) : null,
          maxJobValue: maxJobValue ? Number(maxJobValue) : null,
          ampAuthorized,
        });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Company fit profile</h2>
          <p className="mt-1 text-xs text-muted">Trade, territory, license and job-size fit drive every go/no-go decision.</p>
        </div>
        <Button size="sm" disabled={saving || disabled}>
          <Save className="h-4 w-4" />
          {saving ? "Saving" : "Save"}
        </Button>
      </div>
      {disabled ? (
        <p className="mt-3 border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          Sign in to save this profile. The brief still uses public/default matching for testing.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium text-muted">
          Company
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-medium text-muted">
          Trades/products
          <input value={trades} onChange={(event) => setTrades(event.target.value)} placeholder="excavation, HVAC, concrete" className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-medium text-muted">
          Regions/municipalities
          <input value={regions} onChange={(event) => setRegions(event.target.value)} placeholder="Montreal, Laval, Quebec" className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-medium text-muted">
          RBQ license
          <input value={rbqLicenseNumber} onChange={(event) => setRbqLicenseNumber(event.target.value)} className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-medium text-muted">
          RBQ classes
          <input value={rbqLicenseClasses} onChange={(event) => setRbqLicenseClasses(event.target.value)} className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-medium text-muted">
          Min job value
          <input value={minJobValue} onChange={(event) => setMinJobValue(event.target.value)} inputMode="numeric" className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-medium text-muted">
          Max job value
          <input value={maxJobValue} onChange={(event) => setMaxJobValue(event.target.value)} inputMode="numeric" className="mt-1 h-10 w-full border border-line px-3 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs font-medium text-muted">
          <input type="checkbox" checked={ampAuthorized} onChange={(event) => setAmpAuthorized(event.target.checked)} />
          AMP authorized
        </label>
      </div>
    </form>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-surface px-2 py-1">
      <p className="text-[10px] uppercase text-subtle">{label}</p>
      <p className={`tabular-nums text-sm font-semibold ${scoreTone(value)}`}>{value}</p>
    </div>
  );
}

function OpportunityCard({
  item,
  locale,
  onFeedback,
}: {
  item: QualifiedBriefOpportunity;
  locale: string;
  onFeedback: (item: QualifiedBriefOpportunity, action: string) => Promise<void>;
}) {
  return (
    <article className="border border-line bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-subtle">
            <span>{item.sourceType}</span>
            <span>{item.coverageStatus}</span>
            <span>{item.sourceFreshness}</span>
          </div>
          <h3 className="mt-1 text-base font-semibold leading-6 text-ink">{item.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="h-3.5 w-3.5" />
            {item.location || "Quebec"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:min-w-64">
          <ScorePill label="Fit" value={item.fitScore} />
          <ScorePill label="Risk" value={item.riskScore} />
          <ScorePill label="Proof" value={item.confidenceScore} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase text-subtle">Why chase</p>
          <p className="mt-1 text-sm leading-5 text-ink">{item.reasonToChase}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-subtle">Risk / watch</p>
          <p className="mt-1 text-sm leading-5 text-ink">{item.reasonToWatch}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-subtle">Next action</p>
          <p className="mt-1 text-sm leading-5 text-ink">{item.recommendedAction}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-6">
        <ScorePill label="Trade" value={item.tradeFit} />
        <ScorePill label="Area" value={item.territoryFit} />
        <ScorePill label="Value" value={item.jobSizeFit} />
        <ScorePill label="Timing" value={item.timingFit} />
        <ScorePill label="Source" value={item.sourceTrustFit} />
        <ScorePill label="License" value={item.complianceFit} />
      </div>

      <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1 text-xs text-muted">
          <p>
            <span className="font-semibold text-ink">Source:</span> {item.sourceAuthority}
          </p>
          <p>
            <span className="font-semibold text-ink">Stage:</span> {item.deadlineOrStage}
            {item.value ? ` - ${formatCad(item.value, locale)}` : ""}
          </p>
          <p>
            <span className="font-semibold text-ink">Proof level:</span> {confidenceLabel(item.confidenceScore)}
          </p>
          {item.complianceNotes.slice(0, 2).map((note) => (
            <p key={note} className="text-warning-ink">{note}</p>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 border border-brand px-3 text-xs font-semibold text-brand hover:bg-brand-soft">
            Source
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <button onClick={() => void onFeedback(item, "chase")} className="h-9 border border-success/40 px-3 text-xs font-semibold text-success-ink hover:bg-success-soft">Chase</button>
          <button onClick={() => void onFeedback(item, "watch")} className="h-9 border border-brand/40 px-3 text-xs font-semibold text-brand hover:bg-brand-soft">Watch</button>
          <button onClick={() => void onFeedback(item, "bad_match")} className="h-9 border border-line px-3 text-xs font-semibold text-muted hover:bg-surface-hover">Bad match</button>
        </div>
      </div>
    </article>
  );
}

export default function OpportunityBriefClient({
  locale,
  initialUser,
  dataMode,
}: {
  locale: "fr" | "en";
  initialUser: InitialUser;
  dataMode: RuntimeDataMode;
}) {
  const [brief, setBrief] = useState<QuebecOpportunityBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<BriefSection>("chase_now");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v2/opportunity-briefs/current?locale=${locale}`);
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not load brief.");
        return;
      }
      setBrief(data.brief);
    } catch {
      setMessage("Could not load brief.");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const saveProfile = async (profile: Partial<CompanyFitProfile>) => {
    setSavingProfile(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v2/company-profile?locale=${locale}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not save profile.");
        return;
      }
      setMessage("Profile saved. Rebuilding brief.");
      await load();
    } catch {
      setMessage("Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const sendFeedback = async (item: QualifiedBriefOpportunity, action: string) => {
    setMessage(null);
    const response = await fetch("/api/v2/opportunity-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordKind: item.recordKind,
        recordId: item.recordId,
        action,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Sign in to save feedback.");
      return;
    }
    setMessage(action === "chase" ? "Saved as pursuing." : action === "watch" ? "Saved as researching." : "Feedback saved.");
  };

  const counts = useMemo(() => {
    if (!brief) return null;
    return {
      chase: brief.sections.chase_now.length,
      watch: brief.sections.watch.length + brief.sections.municipal_signals.length,
      permits: brief.sections.new_permits.length,
      compliance: brief.sections.compliance_notes.length,
    };
  }, [brief]);

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-ink lg:flex">
      <CockpitSidebar plan={initialUser?.plan ?? "FREE"} user={initialUser} />
      <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">
        <header className="border-b border-line pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-brand">Quebec Opportunity Qualification</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-ink">This week for your company</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Quebec Qualified Opportunity Briefs combine permits, SEAO/public opportunities, RBQ/AMP/RENA fit, municipal signals, and site context into chase, watch, and ignore decisions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Rebuild
              </Button>
            </div>
          </div>
          {dataMode === "local" ? (
            <p className="mt-3 border-l-2 border-warning bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              Local/test data mode. Verify official source links before business action.
            </p>
          ) : null}
        </header>

        {message ? (
          <div className="mt-4 border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand">{message}</div>
        ) : null}

        {loading || !brief ? (
          <div className="mt-5 grid gap-4">
            <div className="h-48 animate-pulse border border-line bg-white" />
            <div className="h-64 animate-pulse border border-line bg-white" />
          </div>
        ) : (
          <>
            <section className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="border border-line bg-white p-4">
                <ArrowUpRight className="h-5 w-5 text-success" />
                <p className="mt-3 tabular-nums text-2xl font-semibold text-ink">{counts?.chase}</p>
                <p className="text-xs text-muted">Chase now</p>
              </div>
              <div className="border border-line bg-white p-4">
                <Eye className="h-5 w-5 text-brand" />
                <p className="mt-3 tabular-nums text-2xl font-semibold text-ink">{counts?.watch}</p>
                <p className="text-xs text-muted">Watch / early signals</p>
              </div>
              <div className="border border-line bg-white p-4">
                <Wrench className="h-5 w-5 text-warning" />
                <p className="mt-3 tabular-nums text-2xl font-semibold text-ink">{counts?.permits}</p>
                <p className="text-xs text-muted">Permit-to-lead items</p>
              </div>
              <div className="border border-line bg-white p-4">
                <ShieldCheck className="h-5 w-5 text-success" />
                <p className="mt-3 tabular-nums text-2xl font-semibold text-ink">{counts?.compliance}</p>
                <p className="text-xs text-muted">Compliance notes</p>
              </div>
            </section>

            <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <ProfileEditor
                  key={[
                    brief.profile.companyName,
                    brief.profile.trades.join("|"),
                    brief.profile.regions.join("|"),
                    brief.profile.rbqLicenseNumber,
                    brief.profile.rbqLicenseClasses.join("|"),
                    brief.profile.minJobValue,
                    brief.profile.maxJobValue,
                    brief.profile.ampAuthorized,
                  ].join(":")}
                  profile={brief.profile}
                  saving={savingProfile}
                  disabled={!initialUser}
                  onSave={saveProfile}
                />

                <div className="border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {SECTION_ORDER.map((section) => {
                      const meta = SECTION_META[section];
                      const Icon = meta.icon;
                      const count = brief.sections[section].length;
                      return (
                        <button
                          key={section}
                          type="button"
                          onClick={() => setActiveSection(section)}
                          className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold ${
                            activeSection === section
                              ? "border-brand bg-brand-soft text-brand"
                              : "border-line text-muted hover:bg-surface-hover"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                          <span className="tabular-nums">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <section className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{SECTION_META[activeSection].label}</h2>
                    <p className="text-sm text-muted">{SECTION_META[activeSection].description}</p>
                  </div>
                  {brief.sections[activeSection].length ? (
                    brief.sections[activeSection].map((item) => (
                      <OpportunityCard key={`${activeSection}:${item.id}`} item={item} locale={locale} onFeedback={sendFeedback} />
                    ))
                  ) : (
                    <div className="grid min-h-40 place-items-center border border-line bg-white p-8 text-center">
                      <div>
                        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                        <p className="mt-2 text-sm font-semibold text-ink">No items in this section.</p>
                        <p className="mt-1 text-xs text-muted">The brief is source-backed and will not fabricate missing opportunities.</p>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-4">
                <div className="border border-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <BriefcaseBusiness className="mt-0.5 h-5 w-5 text-brand" />
                    <div>
                      <h2 className="text-sm font-semibold text-ink">Brief summary</h2>
                      <p className="mt-2 text-sm leading-6 text-muted">{brief.summary}</p>
                      <p className="mt-3 text-xs text-subtle">Generated {formatDate(brief.generatedAt, locale)}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 h-5 w-5 text-warning" />
                    <div>
                      <h2 className="text-sm font-semibold text-ink">Coverage honesty</h2>
                      <div className="mt-3 space-y-2 text-sm text-muted">
                        <p>{brief.sourceCoverageSummary.indexedSources} indexed source-backed items in this brief.</p>
                        <p>{brief.sourceCoverageSummary.hiddenClaimWarning}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                    <div>
                      <h2 className="text-sm font-semibold text-ink">Validation warnings</h2>
                      <ul className="mt-3 space-y-2 text-sm text-muted">
                        {brief.validationWarnings.map((warning) => (
                          <li key={warning}>- {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
