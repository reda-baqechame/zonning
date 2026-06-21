import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildSiteDossier } from "@/lib/api/v2";
import { sendEmail } from "@/lib/email/resend";
import { intelligenceSnapshotEmail } from "@/lib/email/templates";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { appUrl as resolveAppUrl } from "@/lib/app-url";

const schema = z.object({
  email: z.string().email(),
  query: z.string().min(2).max(300),
  locale: z.enum(["fr", "en"]).optional(),
  city: z.string().optional(),
  borough: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:v2:reports:email:${ip}`, 5, 60 * 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = schema.parse(await req.json());
    const locale = body.locale ?? "fr";
    const appUrl = resolveAppUrl();

    const emailLimited = await rateLimitAsync(
      `api:v2:reports:email:addr:${body.email.toLowerCase()}`,
      5,
      60 * 60_000
    );
    if (!emailLimited.ok) return rateLimitResponse(emailLimited.retryAfterSec);

    const dossier = await buildSiteDossier({
      address: body.query,
      city: body.city,
      borough: body.borough,
    });

    if (dossier.signals.length === 0 && dossier.permits.length === 0) {
      return NextResponse.json(
        { error: "No verified evidence matched this query, so no report was sent." },
        { status: 422 }
      );
    }

    const evidenceCount = dossier.signals.length + dossier.permits.length;
    const confidence = evidenceCount
      ? Math.min(0.9, 0.45 + evidenceCount * 0.08)
      : 0.25;

    const signals = [
      `${dossier.signals.length} sourced signal(s)`,
      `${dossier.permits.length} address-matched permit event(s)`,
      `${dossier.constraints.length} constraint layer(s)`,
      `Verdict: ${dossier.verdict}`,
    ];

    const dossierHref = `${appUrl}/${locale}/verdict?query=${encodeURIComponent(body.query)}`;
    const { subject, html } = intelligenceSnapshotEmail({
      locale,
      query: body.query,
      title: dossier.address,
      subtitle: `${dossier.municipality ?? body.city ?? "Quebec"} · ${dossier.verdict}`,
      confidence,
      freshness: "computed live",
      sourceTitle: dossier.signals[0]?.source.title ?? "ZONNING public evidence graph",
      sourceUrl: dossier.signals[0]?.source.url ?? `${appUrl}/${locale}/coverage`,
      signals,
      limitations: dossier.limitations,
      recommendedNextAction:
        dossier.verdict === "insufficient_data"
          ? "Review missing sources before making a planning decision."
          : "Inspect source evidence, constraints, and nearby permits in the dossier.",
      dossierHref,
    });

    const result = await sendEmail({
      to: body.email,
      subject,
      html,
      type: "intelligence_snapshot",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Email delivery failed" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.id,
      emailSent: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
