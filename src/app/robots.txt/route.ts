import { NextResponse } from "next/server";

export function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.ca";
  return new NextResponse(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/admin/",
      "Disallow: /api/sync/",
      "Disallow: /api/cron/",
      `Sitemap: ${base}/sitemap.xml`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
