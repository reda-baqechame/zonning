"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Lock,
  Upload,
  Loader2,
  Ban,
  CheckCircle2,
  CircleAlert,
  Trash2,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button, Input, FadeIn } from "@/components/ui";
import type { VaultExtraction } from "@/lib/vault/extract";

type VaultDoc = {
  id: string;
  fileName: string;
  sourceUrl: string | null;
  extraction: string | null;
  extractedWithAi: boolean;
  createdAt: string;
};

export default function VaultClient() {
  const t = useTranslations("vault");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/vault")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .finally(() => setLoading(false));
  }, []);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (sourceUrl.trim()) form.append("sourceUrl", sourceUrl.trim());
      const res = await fetch("/api/vault", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? t("uploadFailed"));
        return;
      }
      setDocs((d) => [
        {
          id: data.id,
          fileName: data.fileName,
          sourceUrl: sourceUrl.trim() || null,
          extraction: JSON.stringify(data.extraction),
          extractedWithAi: data.extraction?.extractedWithAi ?? false,
          createdAt: new Date().toISOString(),
        },
        ...d,
      ]);
      setFile(null);
      setSourceUrl("");
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setErr(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
    if (res.ok) setDocs((d) => d.filter((x) => x.id !== id));
  };

  return (
    <FadeIn className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
          <Lock className="h-6 w-6 text-brand" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle">
          <Lock className="h-3 w-3" /> {t("privacy")}
        </p>
      </header>

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-brand-ink hover:file:bg-brand-hover"
          />
          <Button onClick={upload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1">{t("analyze")}</span>
          </Button>
        </div>
        <div className="mt-2">
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder={t("sourcePlaceholder")}
            aria-label={t("sourcePlaceholder")}
          />
        </div>
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-sm text-muted">{t("loading")}</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-subtle">{t("empty")}</p>
        ) : (
          docs.map((doc) => {
            const ex = safeParse(doc.extraction);
            return (
              <article key={doc.id} className="rounded-lg border border-line bg-white p-4">
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <FileText className="h-4 w-4 shrink-0 text-brand" />
                      <span className="truncate">{doc.fileName}</span>
                      {doc.extractedWithAi ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
                          <Sparkles className="h-3 w-3" /> AI
                        </span>
                      ) : null}
                    </p>
                    {doc.sourceUrl ? (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 block truncate text-xs text-brand hover:underline"
                      >
                        {doc.sourceUrl}
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(doc.id)}
                    className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-danger"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </header>

                {ex ? (
                  <>
                    <div className="mt-3 rounded-md border border-line bg-surface-2 p-3">
                      <p className="text-sm font-semibold text-ink">
                        {t("taskSummary", { total: ex.tasks.length, blockers: ex.blockerCount })}
                      </p>
                      <p className="text-xs text-muted">{t("taskSummaryDetail")}</p>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {ex.tasks.map((task) => (
                        <li
                          key={task.id}
                          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                            task.blocker
                              ? "border-danger/30 bg-danger/5"
                              : "border-line"
                          }`}
                        >
                          {task.blocker ? (
                            <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                          ) : (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                          )}
                          <span>
                            <span className="font-medium text-ink">{task.title}</span>
                            <span className="block text-xs text-muted">{task.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>

                    {(ex.rejectionRisks.length > 0 || ex.requiredDocuments.length > 0) && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {ex.rejectionRisks.length > 0 ? (
                          <div>
                            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-danger">
                              <CircleAlert className="h-3 w-3" /> {t("rejectionRisks")}
                            </p>
                            <ul className="mt-1 space-y-0.5 text-xs text-muted">
                              {ex.rejectionRisks.map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {ex.requiredDocuments.length > 0 ? (
                          <div>
                            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-subtle">
                              <FileText className="h-3 w-3" /> {t("requiredDocs")}
                            </p>
                            <ul className="mt-1 space-y-0.5 text-xs text-muted">
                              {ex.requiredDocuments.map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-xs text-subtle">{t("noExtraction")}</p>
                )}
              </article>
            );
          })
        )}
      </div>
    </FadeIn>
  );
}

function safeParse(s: string | null): VaultExtraction | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as VaultExtraction;
  } catch {
    return null;
  }
}
