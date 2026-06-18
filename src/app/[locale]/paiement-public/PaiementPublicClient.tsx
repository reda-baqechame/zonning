"use client";

import { useEffect, useState } from "react";

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
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-white">Paiement public</h1>
      <p className="mt-3 text-slate-400">
        Suivi léger des échéances de paiement — règlement québécois sur le paiement rapide (2025).
      </p>
      <form onSubmit={add} className="mt-8 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du contrat public"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2"
          required
        />
        <select
          value={selectedAwardId}
          onChange={(e) => {
            setSelectedAwardId(e.target.value);
            const award = recentAwards.find((a) => a.id === e.target.value);
            if (award?.title) setTitle(award.title);
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
        >
          <option value="">Lier à une attribution SEAO (optionnel)</option>
          {recentAwards.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title ?? a.winnerName ?? a.id}
              {a.awardAmount ? ` — ${a.awardAmount.toLocaleString("fr-CA")} $` : ""}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium">
          Ajouter
        </button>
      </form>
      <ul className="mt-8 space-y-3">
        {contracts.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-800 p-4">
            <p className="font-medium text-white">{c.title}</p>
            {c.deadlines?.invoiceDue && (
              <p className="mt-1 text-sm text-slate-400">
                Facture due:{" "}
                {new Date(c.deadlines.invoiceDue).toLocaleDateString("fr-CA")}
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
          </li>
        ))}
      </ul>
    </div>
  );
}
