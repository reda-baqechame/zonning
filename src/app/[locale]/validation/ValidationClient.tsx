"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Input,
  Textarea,
  FieldLabel,
  Button,
  Card,
  PageHeader,
  useToast,
  FadeIn,
} from "@/components/ui";

type Interview = {
  id: string;
  companyName: string;
  role: string;
  urgencyScore?: number | null;
  interviewedAt: string;
};

export default function ValidationClient({ isAdmin }: { isAdmin?: boolean }) {
  const t = useTranslations("validation");
  const c = useTranslations("common");
  const { success, error: toastError } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState({ total: 0, goCount: 0, goCriteriaMet: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    interviewerName: "",
    companyName: "",
    role: "",
    q1Pipeline: "",
  });

  const loadAdmin = useCallback(() => {
    if (!isAdmin) return;
    fetch("/api/validation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setInterviews(d.interviews ?? []);
        setStats({
          total: d.stats?.total ?? 0,
          goCount: d.stats?.goCount ?? 0,
          goCriteriaMet: d.stats?.goCriteriaMet ?? false,
        });
      });
  }, [isAdmin]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const submitDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/validation/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toastError(data.error ?? c("error"));
      return;
    }
    setSubmitted(true);
    success(t("success"));
    setForm({ interviewerName: "", companyName: "", role: "", q1Pipeline: "" });
  };

  return (
    <FadeIn className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title={isAdmin ? t("adminTitle") : t("title")}
        subtitle={isAdmin ? t("adminSubtitle") : t("subtitle")}
      />

      {isAdmin && (
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-400">{t("total")}</p>
            <p className="text-2xl font-bold text-white">{stats.total}/15</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-400">Urgence 4+</p>
            <p className="text-2xl font-bold text-white">{stats.goCount}</p>
          </Card>
          <Card className={stats.goCriteriaMet ? "border-emerald-500/40" : undefined}>
            <p className="text-sm text-slate-400">{t("goCriteria")}</p>
            <p className="text-2xl font-bold text-white">
              {stats.goCriteriaMet ? "GO" : "—"}
            </p>
          </Card>
        </div>
      )}

      {!isAdmin && (
        <Card className="mb-8">
          {submitted ? (
            <p className="text-center text-emerald-300">{t("success")}</p>
          ) : (
            <form onSubmit={submitDemo} className="space-y-4">
              <div>
                <FieldLabel htmlFor="name" required>
                  {t("name")}
                </FieldLabel>
                <Input
                  id="name"
                  required
                  value={form.interviewerName}
                  onChange={(e) => setForm({ ...form, interviewerName: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="company" required>
                  {t("company")}
                </FieldLabel>
                <Input
                  id="company"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="role" required>
                  {t("role")}
                </FieldLabel>
                <Input
                  id="role"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="message">{t("message")}</FieldLabel>
                <Textarea
                  id="message"
                  value={form.q1Pipeline}
                  onChange={(e) => setForm({ ...form, q1Pipeline: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? c("loading") : t("submit")}
              </Button>
            </form>
          )}
        </Card>
      )}

      {isAdmin && interviews.length > 0 && (
        <div className="space-y-2">
          {interviews.map((i) => (
            <Card key={i.id} className="py-3">
              <span className="font-medium text-white">{i.companyName}</span>
              <span className="text-slate-500"> — {i.role}</span>
              <span className="ml-2 text-sky-400">Urgence: {i.urgencyScore}/5</span>
            </Card>
          ))}
        </div>
      )}
    </FadeIn>
  );
}
