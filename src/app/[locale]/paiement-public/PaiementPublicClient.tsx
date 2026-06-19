"use client";

import { useEffect, useState } from "react";
import {
  Input,
  Select,
  FieldLabel,
  Button,
  PageHeader,
  Card,
  FadeIn,
} from "@/components/ui";

type Award = {
  id: string;
  title: string | null;
  winnerName: string | null;
  awardAmount: number | null;
  awardDate: string | null;
  sourceUrl: string;
};

type Contract = {
  id: string;
  title: string;
  awardDate?: string | null;
  invoiceDate?: string | null;
  paymentDue?: string | null;
  amount?: number | null;
  notes?: string | null;
  tenderAwardId?: string | null;
  deadlines?: {
    invoiceDue?: Date | string;
    paymentDue?: Date | string;
    notesFr?: string;
  } | null;
  award?: {
    id: string;
    title: string | null;
    sourceUrl: string;
  } | null;
};

export default function PaiementPublicClient() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [recentAwards, setRecentAwards] = useState<Award[]>([]);
  const [title, setTitle] = useState("");
  const [selectedAwardId, setSelectedAwardId] = useState("");

  const load = () => {
    fetch("/api/paiement-public")
      .then((r) => r.json())
      .then((d) => {
        setContracts(d.contracts ?? []);
        setRecentAwards(d.recentAwards ?? []);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/paiement-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        tenderAwardId: selectedAwardId || undefined,
      }),
    });
    setTitle("");
    setSelectedAwardId("");
    load();
  };

  return (
    <FadeIn className="mx-auto max-w-3xl px-4 py-16">
      <PageHeader
        title="Paiement public"
        subtitle="Suivi léger des échéances de paiement — règlement québécois sur le paiement rapide (2025)."
      />
      <form onSubmit={add} className="mt-8 space-y-3">
        <div>
          <FieldLabel htmlFor="title" required>
            Titre du contrat public
          </FieldLabel>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <FieldLabel htmlFor="award">Attribution SEAO</FieldLabel>
          <Select
            id="award"
            value={selectedAwardId}
            onChange={(e) => {
              setSelectedAwardId(e.target.value);
              const award = recentAwards.find((a) => a.id === e.target.value);
              if (award?.title) setTitle(award.title);
            }}
          >
            <option value="">Lier à une attribution SEAO (optionnel)</option>
            {recentAwards.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title ?? a.winnerName ?? a.id}
                {a.awardAmount ? ` — ${a.awardAmount.toLocaleString("fr-CA")} $` : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Ajouter</Button>
      </form>
      <ul className="mt-8 space-y-3">
        {contracts.map((c) => (
          <Card key={c.id}>
            <p className="font-medium text-white">{c.title}</p>
            {c.deadlines?.invoiceDue && (
              <p className="mt-1 text-sm text-slate-400">
                Facture due: {new Date(c.deadlines.invoiceDue).toLocaleDateString("fr-CA")}
              </p>
            )}
            {(c.paymentDue || c.deadlines?.paymentDue) && (
              <p className="text-sm text-amber-300">
                Paiement due:{" "}
                {new Date(c.paymentDue ?? c.deadlines!.paymentDue!).toLocaleDateString("fr-CA")}
              </p>
            )}
            {c.notes && <p className="mt-1 text-xs text-slate-500">{c.notes}</p>}
            {c.award?.sourceUrl && (
              <a
                href={c.award.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-sky-400 hover:underline"
              >
                Voir attribution SEAO →
              </a>
            )}
          </Card>
        ))}
      </ul>
    </FadeIn>
  );
}
