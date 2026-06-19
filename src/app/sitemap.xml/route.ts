import { NextResponse } from "next/server";

const LOCALES = ["fr", "en"] as const;

const PATHS = [
  "",
  "/verdict",
  "/chantier-radar",
  "/marches-qc",
  "/partenaires-ca",
  "/coverage",
  "/intelligence",
  "/developers",
  "/pricing",
  "/digest",
  "/build-log",
  "/login",
  "/register",
] as const;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.ca";
  const urls: string[] = [];

  for (const locale of LOCALES) {
    for (const path of PATHS) {
      const changefreq = path === "" || path === "/coverage" ? "daily" : "weekly";
      const priority =
        path === "" ? "1.0" : path === "/coverage" || path === "/verdict" ? "0.9" : "0.7";
      urls.push(
        `  <url><loc>${base}/${locale}${path}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
      );
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: { "Content-Type": "application/xml" },
  });
}
