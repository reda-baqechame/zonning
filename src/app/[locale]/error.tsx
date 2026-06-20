"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("[locale-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center text-ink">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("description")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover"
      >
        {t("retry")}
      </button>
    </div>
  );
}
