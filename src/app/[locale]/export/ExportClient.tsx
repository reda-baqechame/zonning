"use client";

import { PageHeader, Card, CardTitle, CardDescription, FadeIn } from "@/components/ui";

export default function ExportClient() {
  const download = (type: string, eligibleOnly = false) => {
    const params = new URLSearchParams({ type });
    if (eligibleOnly) params.set("eligibleOnly", "true");
    window.location.href = `/api/export?${params}`;
  };

  return (
    <FadeIn className="mx-auto max-w-2xl px-4 py-16">
      <PageHeader
        title="Export CRM"
        subtitle="Téléchargez vos permis et appels d'offres filtrés (Essentiel+)."
      />
      <div className="mt-8 flex flex-col gap-4">
        <button type="button" onClick={() => download("permits")} className="text-left">
          <Card hover>
            <CardTitle>Permis CSV</CardTitle>
            <CardDescription>90 derniers jours + score RBQ-Fit</CardDescription>
          </Card>
        </button>
        <button type="button" onClick={() => download("tenders")} className="text-left">
          <Card hover>
            <CardTitle>Appels SEAO CSV</CardTitle>
            <CardDescription>Marchés ouverts</CardDescription>
          </Card>
        </button>
        <button type="button" onClick={() => download("permits", true)} className="text-left">
          <Card hover>
            <CardTitle>Permis éligibles RBQ seulement</CardTitle>
            <CardDescription>Filtre automatique sur l&apos;éligibilité RBQ-Fit</CardDescription>
          </Card>
        </button>
      </div>
    </FadeIn>
  );
}
