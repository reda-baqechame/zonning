"use client";

import { useEffect, useState } from "react";

type Request = {
  id: string;
  userId: string;
  status: string;
  user: { email: string; name?: string | null };
};

export default function AdminConciergePanel() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [payload, setPayload] = useState(
    '[{"type":"permit","title":"Exemple permis toiture Laval"}]'
  );

  useEffect(() => {
    fetch("/api/admin/concierge")
      .then((r) => r.json())
      .then((d) => {
        setRequests(d.requests ?? []);
        if (d.requests?.[0]) setSelected(d.requests[0].userId);
      });
  }, []);

  const deliver = async () => {
    const opportunities = JSON.parse(payload);
    const res = await fetch("/api/admin/concierge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selected,
        opportunities,
        status: "delivered",
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
      return;
    }
    alert("Livré");
  };

  if (requests.length === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-violet-500/30 bg-violet-950/20 p-6">
      <h2 className="text-lg font-semibold text-violet-200">Admin · Concierge</h2>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      >
        {requests.map((r) => (
          <option key={r.id} value={r.userId}>
            {r.user.email} — {r.status}
          </option>
        ))}
      </select>
      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={5}
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
      />
      <button
        onClick={deliver}
        className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white"
      >
        Livrer opportunités
      </button>
    </section>
  );
}
