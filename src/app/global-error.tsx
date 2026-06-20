"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-bg text-ink">
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-bold">Une erreur est survenue</h1>
          <p className="mt-3 text-muted">ZONNING a rencontré un problème inattendu.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
