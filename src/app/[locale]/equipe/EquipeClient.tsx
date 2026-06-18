"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

type Member = {
  id: string;
  role: string;
  user: { email: string; name?: string | null };
};

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
};

type Webhook = {
  id: string;
  url: string;
  events: string;
  filters?: string | null;
  active: boolean;
  createdAt: string;
};

const WEBHOOK_EVENTS = ["permit.created", "tender.created"] as const;

export default function EquipeClient() {
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [keyName, setKeyName] = useState("Production");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [webhookBoroughs, setWebhookBoroughs] = useState("");
  const [webhookCities, setWebhookCities] = useState("");
  const [webhookMinCost, setWebhookMinCost] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setOrg(d);
        setMembers(d.members ?? []);
        setApiKeys(d.apiKeys ?? []);
        setWebhooks(d.webhooks ?? []);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", email: inviteEmail }),
    });
    const d = await res.json();
    if (!res.ok) {
      alert(d.error);
      return;
    }
    setInviteEmail("");
    load();
  };

  const createKey = async () => {
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_api_key", name: keyName }),
    });
    const d = await res.json();
    if (!res.ok) {
      alert(d.error);
      return;
    }
    setNewKey(d.key);
    load();
  };

  const createWebhook = async () => {
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_webhook",
        url: webhookUrl,
        events: webhookEvents.join(","),
        filters: {
          boroughs: webhookBoroughs
            ? webhookBoroughs.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          cities: webhookCities
            ? webhookCities.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          minCost: webhookMinCost ? parseFloat(webhookMinCost) : undefined,
        },
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      alert(d.error);
      return;
    }
    setNewWebhookSecret(d.secret);
    setWebhookUrl("");
    load();
  };

  const deleteWebhook = async (webhookId: string) => {
    await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_webhook", webhookId }),
    });
    load();
  };

  const toggleEvent = (event: string) => {
    setWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-400">{error}</p>
        <Link href="/pricing" className="mt-4 inline-block text-sky-400">
          Passer au plan Équipe →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">Équipe ZONNING</h1>
      <p className="mt-2 text-slate-400">
        {org?.name ?? "Organisation"} · 5 sièges max · API v1 · Webhooks
      </p>

      <section className="mt-10 rounded-xl border border-slate-800 p-6">
        <h2 className="font-semibold text-white">Membres ({members.length}/5)</h2>
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex justify-between text-sm text-slate-300">
              <span>{m.user.name ?? m.user.email}</span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@entreprise.ca"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button onClick={invite} className="rounded-lg bg-sky-500 px-4 py-2 text-sm">
            Inviter
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-800 p-6">
        <h2 className="font-semibold text-white">Clés API</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          {apiKeys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2">
              <span>
                {k.name} · <code className="text-sky-300">{k.keyPrefix}…</code>
              </span>
              <button
                type="button"
                onClick={() =>
                  fetch("/api/org", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "revoke_api_key", keyId: k.id }),
                  }).then(load)
                }
                className="text-xs text-red-400 hover:text-red-300"
              >
                Révoquer
              </button>
            </li>
          ))}
        </ul>
        {newKey && (
          <p className="mt-3 rounded bg-amber-950/50 p-3 text-xs text-amber-200">
            Copiez cette clé maintenant: <code>{newKey}</code>
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button onClick={createKey} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
            Créer clé
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-800 p-6">
        <h2 className="font-semibold text-white">Webhooks</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          {webhooks.map((w) => (
            <li key={w.id} className="flex items-start justify-between gap-2 rounded border border-slate-800 p-3">
              <div>
                <p className="font-mono text-xs text-sky-300 break-all">{w.url}</p>
                <p className="mt-1 text-xs text-slate-500">{w.events}</p>
                {w.filters && (
                  <p className="mt-1 text-xs text-slate-600">Filtres: {w.filters}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteWebhook(w.id)}
                className="shrink-0 text-xs text-red-400 hover:text-red-300"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        {newWebhookSecret && (
          <p className="mt-3 rounded bg-amber-950/50 p-3 text-xs text-amber-200">
            Secret webhook (une fois): <code>{newWebhookSecret}</code>
          </p>
        )}
        <div className="mt-4 space-y-3">
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://votre-crm.ca/webhooks/zonning"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={webhookBoroughs}
            onChange={(e) => setWebhookBoroughs(e.target.value)}
            placeholder="Arrondissements (ex: Ville-Marie, Plateau)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={webhookCities}
            onChange={(e) => setWebhookCities(e.target.value)}
            placeholder="Villes (ex: Montréal, Laval)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={webhookMinCost}
            onChange={(e) => setWebhookMinCost(e.target.value)}
            type="number"
            placeholder="Coût min. permis ($)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={webhookEvents.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                />
                {ev}
              </label>
            ))}
          </div>
          <button
            onClick={createWebhook}
            disabled={!webhookUrl || webhookEvents.length === 0}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            Créer webhook
          </button>
        </div>
      </section>

      <p className="mt-8 text-sm text-slate-500">
        Documentation API: <code className="text-sky-300">docs/API.md</code>
      </p>
    </div>
  );
}
