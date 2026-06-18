"use client";

import { useEffect } from "react";

export default function VerdictShareTracker({
  slug,
  utmSource,
}: {
  slug: string;
  utmSource?: string;
}) {
  useEffect(() => {
    const params = new URLSearchParams({ slug });
    if (utmSource) params.set("utm_source", utmSource);
    void fetch(`/api/verdict?${params.toString()}`);
  }, [slug, utmSource]);

  return null;
}
