"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";

type Props = {
  datasetId: string;
};

export default function FreshnessBadge({ datasetId }: Props) {
  const t = useTranslations("sync");
  const locale = useLocale();
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sync/status")
      .then((r) => r.json())
      .then((d) => {
        const state = (d.states as { datasetId: string; lastSuccessAt?: string }[])?.find(
          (s) => s.datasetId === datasetId
        );
        setLastSuccessAt(state?.lastSuccessAt ?? null);
      })
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/sync/status")
        .then((r) => r.json())
        .then((d) => {
          const state = (d.states as { datasetId: string; lastSuccessAt?: string }[])?.find(
            (s) => s.datasetId === datasetId
          );
          setLastSuccessAt(state?.lastSuccessAt ?? null);
        })
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [datasetId]);

  if (!lastSuccessAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        {t("pending")}
      </span>
    );
  }

  const ago = formatDistanceToNow(new Date(lastSuccessAt), {
    addSuffix: true,
    locale: locale === "fr" ? fr : enUS,
  });

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success-ink">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
      {t("live")} · {ago}
    </span>
  );
}
