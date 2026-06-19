"use client";

import { useEffect, useState } from "react";
import { Select, Textarea, Button, useToast } from "@/components/ui";

type Request = {
  id: string;
  userId: string;
  status: string;
  user: { email: string; name?: string | null };
};

export default function AdminConciergePanel() {
  const { error: toastError, success } = useToast();
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
      toastError(d.error);
      return;
    }
    success("Livré");
  };

  if (requests.length === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-violet-500/30 bg-violet-950/20 p-6">
      <h2 className="text-lg font-semibold text-violet-200">Admin · Concierge</h2>
      <Select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-4"
      >
        {requests.map((r) => (
          <option key={r.id} value={r.userId}>
            {r.user.email} — {r.status}
          </option>
        ))}
      </Select>
      <Textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={5}
        className="mt-3 font-mono text-xs"
      />
      <Button onClick={deliver} className="mt-3">
        Livrer opportunités
      </Button>
    </section>
  );
}
