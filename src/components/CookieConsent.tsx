"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

const CONSENT_KEY = "zonning_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      if (typeof window !== "undefined" && !localStorage.getItem(CONSENT_KEY)) {
        setVisible(true);
      }
    });
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "essential");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-line bg-white/95 p-4 shadow-[var(--shadow-pop)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          ZONNING utilise des témoins essentiels uniquement (session, préférences). Aucune
          publicité ni analytique tierce.{" "}
          <Link href="/privacy" className="text-brand hover:underline">
            Politique de confidentialité
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Compris
        </button>
      </div>
    </div>
  );
}
