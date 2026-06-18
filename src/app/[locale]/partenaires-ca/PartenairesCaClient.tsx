"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import FreshnessBadge from "@/components/FreshnessBadge";

type Company = {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
  sector?: string | null;
  certifications?: string | null;
  capabilities?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceUrl?: string | null;
  seaoAwards?: {
    title?: string | null;
    awardAmount?: number | null;
    awardDate?: string | null;
  }[];
};

type Supplier = {
  id: string;
  name: string;
  neq?: string | null;
  borough?: string | null;
  phone?: string | null;
  sourceUrl: string;
};

const CERT_CHIPS = ["COR", "ISO 9001", "ISO 14001", "BNQ", "CCQ"];

export default function PartenairesCaClient() {
  const t = useTranslations("partenaires");
  const [tab, setTab] = useState<"registre" | "suppliers">("registre");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [region, setRegion] = useState("");
  const [cert, setCert] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sector) params.set("sector", sector);
    if (region) params.set("region", region);
    if (cert) params.set("certification", cert);
    if (tab === "suppliers") params.set("suppliers", "true");
    const res = await fetch(`/api/companies?${params}`);
    const data = await res.json();
    setCompanies(data.companies ?? []);
    setSuppliers(data.suppliers ?? []);
  }, [q, sector, region, cert, tab]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const list = tab === "suppliers" ? suppliers : companies;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-slate-400">{t("subtitle")}</p>
      <div className="mt-2">
        <FreshnessBadge datasetId={tab === "suppliers" ? "suppliers" : "registre"} />
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab("registre")}
          className={`rounded-lg px-4 py-2 text-sm ${
            tab === "registre"
              ? "bg-sky-500 text-white"
              : "bg-slate-800 text-slate-300"
          }`}
        >
          {t("tabRegistre")}
        </button>
        <button
          onClick={() => setTab("suppliers")}
          className={`rounded-lg px-4 py-2 text-sm ${
            tab === "suppliers"
              ? "bg-sky-500 text-white"
              : "bg-slate-800 text-slate-300"
          }`}
        >
          {t("tabSuppliers")}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CERT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setCert(cert === chip ? "" : chip)}
            className={`rounded-full px-3 py-1 text-xs ${
              cert === chip ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder={t("sector")}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder={t("region")}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <button
          onClick={load}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
        >
          {t("searchBtn")}
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {tab === "registre" &&
          companies.map((c) => {
            const certs = c.certifications
              ? (JSON.parse(c.certifications) as string[])
              : [];
            const caps = c.capabilities
              ? (JSON.parse(c.capabilities) as string[])
              : [];

            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <h2 className="text-lg font-semibold text-white">{c.name}</h2>
                <p className="text-sm text-slate-400">
                  {c.sector} · {c.city}, {c.region}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {certs.map((certName) => (
                    <span
                      key={certName}
                      className="rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300"
                    >
                      {certName}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-500">{caps.join(" · ")}</p>
                {c.seaoAwards && c.seaoAwards.length > 0 && (
                  <div className="mt-3 rounded border border-slate-700/50 p-2 text-xs text-slate-500">
                    <p className="font-medium text-slate-400">{t("seaoAwards")}</p>
                    {c.seaoAwards.map((a, i) => (
                      <p key={i}>
                        {a.title} —{" "}
                        {a.awardAmount ? `${a.awardAmount.toLocaleString("fr-CA")} $` : ""}
                      </p>
                    ))}
                  </div>
                )}
                {c.email && (
                  <p className="mt-2 text-sm text-slate-300">{c.email}</p>
                )}
              </div>
            );
          })}

        {tab === "suppliers" &&
          suppliers.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <h2 className="text-lg font-semibold text-white">{s.name}</h2>
              <p className="text-sm text-slate-400">
                {s.borough} {s.neq ? `· NEQ ${s.neq}` : ""}
              </p>
              {s.phone && (
                <p className="mt-2 text-sm text-slate-300">{s.phone}</p>
              )}
            </div>
          ))}

        {list.length === 0 && (
          <p className="text-slate-400">{t("noResults")}</p>
        )}
      </div>
    </div>
  );
}
