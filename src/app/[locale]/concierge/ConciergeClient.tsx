"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { PageHeader, Card, EmptyState, FadeIn } from "@/components/ui";

type Request = {
  status: string;
  opportunities?: string | null;
  notes?: string | null;
};

export default function ConciergeClient() {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    fetch("/api/concierge")
      .then((r) => r.json())
      .then((d) => setReq(d.request))
      .catch(() => {});
  }, []);

  const opportunities = req?.opportunities
    ? (JSON.parse(req.opportunities) as { type: string; title: string }[])
    : [];

  return (
    <FadeIn className="mx-auto max-w-3xl px-4 py-16">
      <PageHeader
        title="Concierge ZONNING"
        subtitle="Onboarding personnalisé + 50 opportunités qualifiées à la main."
      />

      {!req ? (
        <EmptyState
          title="Aucune demande active"
          action={
            <Link href="/pricing" className="text-sky-400 hover:text-sky-300">
              Réserver le Concierge ($2,500) →
            </Link>
          }
        />
      ) : (
        <div className="mt-10 space-y-4">
          <p className="text-sm text-slate-500">
            Statut: <span className="text-sky-300">{req.status}</span>
          </p>
          {req.notes && <p className="text-slate-400">{req.notes}</p>}
          {opportunities.length > 0 && (
            <ul className="space-y-2">
              {opportunities.map((o, i) => (
                <Card key={i} className="p-3 text-sm">
                  <span className="text-slate-500">{o.type}</span> — {o.title}
                </Card>
              ))}
            </ul>
          )}
          {req.status === "pending" && (
            <p className="text-sm text-amber-300">
              Notre équipe prépare vos 50 premières opportunités (24–48h).
            </p>
          )}
        </div>
      )}
    </FadeIn>
  );
}
