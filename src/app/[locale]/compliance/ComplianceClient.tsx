"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

type Record = {
  id: string;
  contactName: string;
  contactEmail?: string | null;
  sourceType: string;
  sourceUrl: string;
  sourceFetchedAt: string;
  lawfulBasis: string;
};

export default function ComplianceClient() {
  const t = useTranslations("compliance");
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
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    load();
    setForm({ ...form, contactName: "", contactEmail: "", contactPhone: "" });
  };

  const downloadPdf = (id: string) => {
    window.open(`/api/compliance?id=${id}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-slate-400">{t("subtitle")}</p>

      <form
        onSubmit={create}
        className="mt-8 space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6"
      >
        <h2 className="font-semibold text-white">Nouveau certificat</h2>
        <input
          required
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          placeholder="Nom du contact"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          placeholder="Courriel"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={form.sourceUrl}
          onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
          placeholder="URL source publique"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <p className="text-xs text-slate-500">{t("lawfulBasis")}</p>
        <button
          type="submit"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium hover:bg-sky-400"
        >
          Créer l&apos;enregistrement
        </button>
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
            <button
              onClick={() => downloadPdf(r.id)}
              className="rounded-lg border border-sky-500/50 px-3 py-1.5 text-sm text-sky-300 hover:bg-sky-500/10"
            >
              {t("download")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
