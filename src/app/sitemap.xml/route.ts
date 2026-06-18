import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.ca";
  const paths = [
    "",
    "/fr/chantier-radar",
    "/fr/marches-qc",
    "/fr/partenaires-ca",
    "/fr/compliance",
    "/fr/pricing",
    "/fr/digest",
    "/fr/build-log",
    "/fr/thermopompe",
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (p) => `  <url><loc>${base}/fr${p}</loc><changefreq>weekly</changefreq></url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: { "Content-Type": "application/xml" },
  });
}
