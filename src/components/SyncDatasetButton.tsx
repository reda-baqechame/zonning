"use client";

import { useState } from "react";

type Props = {
  datasetId: string;
  label: string;
};

export default function SyncDatasetButton({ datasetId, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const trigger = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/sync?dataset=${datasetId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setMessage(`OK — ${data.processed ?? 0} enregistrements`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={trigger}
        disabled={loading}
        className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
      >
        {loading ? "Sync…" : `Resync ${label}`}
      </button>
      {message && <p className="mt-1 text-xs text-slate-500">{message}</p>}
    </div>
  );
}
