"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input, FieldLabel, Button, PageHeader, FadeIn, useToast } from "@/components/ui";

export default function DigestClient() {
  const t = useTranslations("digest");
  const { error: toastError } = useToast();
  const [email, setEmail] = useState("");
  const [borough, setBorough] = useState("");
  const [trade, setTrade] = useState("");
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState<{
    permitsWeek: number;
    tendersOpen: number;
    companies: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((d) => setStats(d.digest ?? null))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/digest/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, borough, trade }),
    });
    if (res.ok) setDone(true);
    else toastError(t("error"));
  };

  return (
    <FadeIn className="mx-auto max-w-lg px-4 py-20">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xl font-bold text-brand tabular-nums">{stats.permitsWeek}</p>
            <p className="text-muted">{t("statPermits")}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xl font-bold text-brand tabular-nums">{stats.tendersOpen}</p>
            <p className="text-muted">{t("statTenders")}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xl font-bold text-brand tabular-nums">{stats.companies}</p>
            <p className="text-muted">{t("statCompanies")}</p>
          </div>
        </div>
      )}
      {done ? (
        <p className="mt-8 text-success-ink">{t("confirmed")}</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <FieldLabel htmlFor="email" required>
              {t("email")}
            </FieldLabel>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="borough">{t("borough")}</FieldLabel>
            <Input
              id="borough"
              value={borough}
              onChange={(e) => setBorough(e.target.value)}
              placeholder="Ville-Marie"
            />
          </div>
          <div>
            <FieldLabel htmlFor="trade">{t("trade")}</FieldLabel>
            <Input
              id="trade"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              placeholder="électricité"
            />
          </div>
          <Button type="submit" className="w-full">
            {t("subscribe")}
          </Button>
        </form>
      )}
    </FadeIn>
  );
}
