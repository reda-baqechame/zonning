"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function AdminEmailTestButton({ locale }: { locale: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const send = async () => {
    setStatus("loading");
    setDetail(null);
    try {
      const res = await fetch("/api/admin/email/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setDetail(data.error ?? "Failed");
        return;
      }
      setStatus("ok");
      setDetail(data.messageId ?? "sent");
    } catch {
      setStatus("error");
      setDetail("Network error");
    }
  };

  const label =
    locale === "fr"
      ? status === "loading"
        ? "Envoi…"
        : "Envoyer courriel test"
      : status === "loading"
        ? "Sending…"
        : "Send test email";

  return (
    <div className="mt-3">
      <Button type="button" variant="secondary" size="sm" onClick={() => void send()} disabled={status === "loading"}>
        {label}
      </Button>
      {status === "ok" && (
        <p className="mt-2 text-xs text-emerald-400">
          {locale === "fr" ? "Courriel envoyé" : "Email sent"} · {detail}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-xs text-red-400">{detail}</p>
      )}
    </div>
  );
}
