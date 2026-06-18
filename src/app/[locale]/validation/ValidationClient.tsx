"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

type Interview = {
  id: string;
  companyName: string;
  role: string;
  urgencyScore?: number | null;
  wouldPayAmount?: number | null;
  interviewedAt: string;
};

export default function ValidationClient() {
  const t = useTranslations("validation");
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState({ total: 0, goCount: 0, payCount: 0, goCriteriaMet: false });
  const [form, setForm] = useState({
    interviewerName: "",
    companyName: "",
    role: "",
    q1Pipeline: "",
    q2RbqPain: "",
    q3SeaoHours: "",
    q4WouldPay: "",
    wouldPayAmount: 199,
    urgencyScore: 3,
    notes: "",
  });

  const load = useCallback(
    () =>
      fetch("/api/validation")
        .then((r) => r.json())
        .then((d) => {
          setInterviews(d.interviews ?? []);
          setStats(d.stats ?? { total: 0, goCount: 0, payCount: 0, goCriteriaMet: false });
        }),
    []
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    load();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-slate-400">{t("subtitle")}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("total")}</p>
          <p className="text-2xl font-bold">{stats.total}/15</p>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="text-sm text-slate-400">Urgence 4+</p>
          <p className="text-2xl font-bold">{stats.goCount}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            stats.goCriteriaMet ? "border-green-500/50" : "border-slate-800"
          }`}
        >
          <p className="text-sm text-slate-400">{t("goCriteria")}</p>
          <p className="text-2xl font-bold">
            {stats.goCriteriaMet ? "GO ✓" : "En cours"}
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="mt-8 space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-6"
      >
        <h2 className="font-semibold">{t("add")}</h2>
        <input
          required
          placeholder="Votre nom"
          value={form.interviewerName}
          onChange={(e) => setForm({ ...form, interviewerName: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Entreprise interviewée"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Rôle"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Pipeline actuel (Q1)"
          value={form.q1Pipeline}
          onChange={(e) => setForm({ ...form, q1Pipeline: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Douleur RBQ (Q2)"
          value={form.q2RbqPain}
          onChange={(e) => setForm({ ...form, q2RbqPain: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          max={5}
          placeholder="Urgence 1-5"
          value={form.urgencyScore}
          onChange={(e) =>
            setForm({ ...form, urgencyScore: parseInt(e.target.value, 10) })
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium"
        >
          Enregistrer
        </button>
      </form>

      <div className="mt-8 space-y-2">
        {interviews.map((i) => (
          <div
            key={i.id}
            className="rounded-lg border border-slate-800 px-4 py-3 text-sm"
          >
            <span className="font-medium text-white">{i.companyName}</span>
            <span className="text-slate-500"> — {i.role}</span>
            <span className="ml-2 text-sky-400">Urgence: {i.urgencyScore}/5</span>
          </div>
        ))}
      </div>
    </div>
  );
}
