"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  PageHeader,
  Input,
  FieldLabel,
  Button,
  Card,
  useToast,
  FadeIn,
} from "@/components/ui";

type Record = {
  id: string;
  contactName: string;
  contactEmail?: string | null;
  sourceType: string;
  sourceUrl: string;
  sourceFetchedAt: string;
  lawfulBasis: string;
};

export default function ComplianceClient({ entitled }: { entitled: boolean }) {
  const t = useTranslations("compliance");
  const { success, error: toastError } = useToast();
  const [records, setRecords] = useState<Record[]>([]);
  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    sourceType: "permit",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
  });

  const load = () =>
    fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]));

  useEffect(() => {
    if (entitled) load();
  }, [entitled]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      toastError(d.error ?? "Error");
      return;
    }
    success(t("create"));
    load();
    setForm({ ...form, contactName: "", contactEmail: "", contactPhone: "" });
  };

  const downloadPdf = (id: string) => {
    window.open(`/api/compliance?id=${id}`, "_blank");
  };

  if (!entitled) {
    return (
      <FadeIn className="mx-auto max-w-4xl px-4 py-10">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="relative mt-8 overflow-hidden rounded-xl border border-slate-800">
          <div className="pointer-events-none select-none blur-sm">
            <div className="space-y-4 bg-slate-900/40 p-6">
              <div className="h-10 rounded-lg bg-slate-800" />
              <div className="h-10 rounded-lg bg-slate-800" />
              <div className="h-10 rounded-lg bg-slate-800" />
              <div className="h-16 rounded-lg bg-slate-800/80" />
            </div>
            <div className="space-y-3 p-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-900/30" />
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 p-6">
            <Card className="max-w-md text-center">
              <h2 className="text-lg font-semibold text-white">{t("upgradeTitle")}</h2>
              <p className="mt-2 text-sm text-slate-400">{t("upgradeDesc")}</p>
              <Link href="/pricing" className="mt-4 inline-block">
                <Button>{t("upgradeCta")}</Button>
              </Link>
            </Card>
          </div>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <form onSubmit={create} className="mt-8 space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-white">{t("newCert")}</h2>
        <div>
          <FieldLabel htmlFor="contactName" required>
            {t("contactName")}
          </FieldLabel>
          <Input
            id="contactName"
            required
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel htmlFor="contactEmail">{t("contactEmail")}</FieldLabel>
          <Input
            id="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel htmlFor="sourceUrl">{t("sourceUrl")}</FieldLabel>
          <Input
            id="sourceUrl"
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
          />
        </div>
        <p className="text-xs text-slate-500">{t("lawfulBasis")}</p>
        <Button type="submit">{t("create")}</Button>
      </form>

      <div className="mt-8 space-y-3">
        {records.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 p-4"
          >
            <div>
              <p className="font-medium text-white">{r.contactName}</p>
              <p className="text-sm text-slate-400">
                {r.sourceType} · {new Date(r.sourceFetchedAt).toLocaleDateString("fr-CA")}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => downloadPdf(r.id)}>
              {t("download")}
            </Button>
          </div>
        ))}
      </div>
    </FadeIn>
  );
}
