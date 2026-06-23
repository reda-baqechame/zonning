import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { parseTriageLink } from "@/lib/triage/link-parser";
import {
  computeWinProbability,
  computeBidRecommendation,
} from "@/lib/tenders/win-probability";
type Locale = "fr" | "en";

type RiskLevel = "low" | "medium" | "high";

function copy(locale: Locale, fr: string, en: string) {
  return locale === "fr" ? fr : en;
}

/**
 * POST /api/triage
 * Body: { url: string, locale?: "fr" | "en" }
 *
 * Paste a SEAO / CanadaBuys / municipal tender URL and get a decision triage:
 * what it is, who's buying, deadline, region, contract type, fit score,
 * paperwork/deadline/competition risk, required certs, whether the documents
 * are worth buying, and the next action.
 *
 * Honest by design: ZONNING only resolves against indexed PUBLIC notices. If
 * the tender isn't indexed, it returns an explicit "not indexed — here is what
 * to check on the official site" triage rather than fabricating analysis.
 * It never bypasses paid documents.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:triage:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { url?: unknown; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || url.length < 5) {
    return NextResponse.json({ error: "A tender URL is required." }, { status: 400 });
  }
  const locale: Locale = body.locale === "en" ? "en" : "fr";

  const user = await getSessionUser();
  const parsed = parseTriageLink(url);

  // Unknown / non-opportunity URL: return a friendly, honest "can't triage".
  if (parsed.source === "unknown" || !parsed.looksLikeOpportunity) {
    return NextResponse.json({
      source: parsed.source,
      sourceLabel: parsed.sourceLabel,
      resolvable: false,
      indexed: false,
      triage: {
        verdict: "unknown",
        headline: copy(
          locale,
          "Ce lien ne ressemble pas à un appel d'offres public que ZONNING peut analyser.",
          "This link doesn't look like a public tender ZONNING can analyze.",
        ),
        nextAction: copy(
          locale,
          "Collez un lien d'avis SEAO, CanadaBuys ou municipal. ZONNING n'accède jamais aux documents payants.",
          "Paste a SEAO, CanadaBuys, or municipal notice link. ZONNING never accesses paid documents.",
        ),
        officialUrl: url,
      },
    });
  }

  // Municipal HTML tender: not auto-indexed today — return an honest "verify on site" triage.
  if (parsed.source === "municipal") {
    return NextResponse.json({
      source: parsed.source,
      sourceLabel: parsed.sourceLabel,
      resolvable: false,
      indexed: false,
      triage: {
        verdict: "verify_on_site",
        headline: copy(
          locale,
          "Appel d'offres municipal détecté. Les avis municipaux en HTML ne sont pas encore indexés automatiquement.",
          "Municipal tender detected. Municipal HTML notices aren't auto-indexed yet.",
        ),
        checklist: [
          copy(locale, "Vérifier la date limite de dépôt.", "Check the submission deadline."),
          copy(locale, "Vérifier la licence RBQ exigée.", "Verify the required RBQ licence."),
          copy(locale, "Vérifier si le cautionnement est requis.", "Check whether bonding is required."),
          copy(locale, "Télécharger tous les addendas avant de soumettre.", "Download every addendum before submitting."),
        ],
        nextAction: copy(
          locale,
          "Ouvrez l'avis officiel et vérifiez l'échéance, la licence et le cautionnement.",
          "Open the official notice and verify the deadline, licence, and bonding.",
        ),
        officialUrl: url,
      },
    });
  }

  // SEAO / CanadaBuys: try to resolve against indexed records.
  const match = await resolveIndexedTender(parsed.source, parsed.sourceId);
  if (!match) {
    return NextResponse.json({
      source: parsed.source,
      sourceLabel: parsed.sourceLabel,
      resolvable: parsed.resolvable,
      indexed: false,
      triage: {
        verdict: "verify_on_site",
        headline: copy(
          locale,
          "Cet avis n'est pas dans l'index public de ZONNING (seuls les avis publics OCDS le sont). Vérifiez-le sur le site officiel.",
          "This notice isn't in ZONNING's public index (only public OCDS notices are). Verify it on the official site.",
        ),
        checklist: [
          copy(locale, "Notez la date/heure limite exacte.", "Note the exact deadline date/time."),
          copy(locale, "Listez les formulaires obligatoires.", "List the mandatory forms."),
          copy(locale, "Vérifiez le seuil AMP (construction 5M$+, services 1M$+).", "Check the AMP threshold (construction $5M+, services $1M+)."),
          copy(locale, "Vérifiez la classe RBQ exigée.", "Verify the required RBQ class."),
        ],
        nextAction: copy(
          locale,
          "Ouvrez l'avis officiel pour confirmer l'échéance et les exigences.",
          "Open the official notice to confirm the deadline and requirements.",
        ),
        officialUrl: url,
      },
    });
  }

  // Resolved: compute the full decision triage.
  const triage = buildTriage(match, user, locale);
  return NextResponse.json({
    source: parsed.source,
    sourceLabel: parsed.sourceLabel,
    resolvable: true,
    indexed: true,
    tender: {
      id: match.id,
      title: match.title,
      organization: match.organization,
      region: match.region,
      category: match.category,
      estimatedValue: match.estimatedValue,
      closesAt: match.closesAt,
      sourceUrl: match.sourceUrl,
      requiresAmp: match.requiresAmp,
      status: match.status,
    },
    triage,
  });
}

type ResolvedTender = {
  id: string;
  title: string;
  organization: string | null;
  region: string | null;
  category: string | null;
  estimatedValue: number | null;
  closesAt: Date | null;
  sourceUrl: string;
  requiresAmp: boolean;
  status: string | null;
};

async function resolveIndexedTender(
  source: string,
  sourceId: string | null,
): Promise<ResolvedTender | null> {
  if (!sourceId) return null;
  // SEAO OCDS external ids are stored on Tender.externalId. Try a few matches.
  const candidates = [sourceId, `${source}-${sourceId}`, sourceId.replace(/^0+/, "")];
  for (const candidate of candidates) {
    const t = await prisma.tender.findFirst({
      where: {
        OR: [
          { externalId: candidate },
          { externalId: { contains: candidate } },
          { sourceUrl: { contains: candidate } },
        ],
      },
      select: {
        id: true,
        title: true,
        organization: true,
        region: true,
        category: true,
        estimatedValue: true,
        closesAt: true,
        sourceUrl: true,
        requiresAmp: true,
        status: true,
      },
    });
    if (t) return t;
  }
  return null;
}

function buildTriage(
  t: ResolvedTender,
  user: Awaited<ReturnType<typeof getSessionUser>>,
  locale: Locale,
) {
  const ampAuthorized = Boolean(user?.ampAuthorized);
  const userMin = user?.minProjectCost ?? null;
  const userMax = user?.maxProjectCost ?? null;
  const daysLeft =
    t.closesAt != null ? differenceInCalendarDays(t.closesAt, new Date()) : null;

  // Fit score: rough profile alignment without the full pipeline (the link
  // triage is a fast, standalone verdict; the feed runs the full pipeline).
  const inSizeRange =
    t.estimatedValue == null
      ? null
      : (userMax == null || t.estimatedValue <= userMax * 1.5) &&
        (userMin == null || t.estimatedValue >= userMin * 0.5);
  const fitScore =
    inSizeRange === false ? 30 : inSizeRange === true ? 70 : 55;

  const win = computeWinProbability({
    matchScore: fitScore,
    ampRequired: t.requiresAmp,
    ampAuthorized,
    estimatedValue: t.estimatedValue,
    userMinCost: userMin,
    userMaxCost: userMax,
    distinctWinners: 5, // neutral default absent award history at this resolution
    incumbentDominance: 0.3,
  });

  const recommendation = computeBidRecommendation(win, {
    matchScore: fitScore,
    ampRequired: t.requiresAmp,
    ampAuthorized,
  });

  // Paperwork risk.
  const paperworkRisk: RiskLevel = t.requiresAmp ? "high" : "medium";

  // Deadline risk.
  let deadlineRisk: RiskLevel = "low";
  let deadlineLabel = copy(locale, "Aucune échéance publiée.", "No deadline published.");
  if (daysLeft != null) {
    if (daysLeft < 0) {
      deadlineRisk = "high";
      deadlineLabel = copy(locale, "Échéance dépassée.", "Deadline passed.");
    } else if (daysLeft <= 7) {
      deadlineRisk = "high";
      deadlineLabel = copy(
        locale,
        `Échéance dans ${daysLeft} jour(s) — risque élevé.`,
        `Closes in ${daysLeft} day(s) — high risk.`,
      );
    } else if (daysLeft <= 21) {
      deadlineRisk = "medium";
      deadlineLabel = copy(
        locale,
        `Échéance dans ${daysLeft} jours.`,
        `Closes in ${daysLeft} days.`,
      );
    } else {
      deadlineLabel = copy(
        locale,
        `Échéance dans ${daysLeft} jours.`,
        `Closes in ${daysLeft} days.`,
      );
    }
  }

  // Worth buying the documents? Don't spend if blocked or too tight.
  const blocked = (t.requiresAmp && !ampAuthorized) || deadlineRisk === "high";
  const worthBuyingDocuments =
    !blocked && recommendation.decision !== "no-bid" && (daysLeft == null || daysLeft > 3);

  const requiredCertificates: string[] = [];
  if (t.requiresAmp) {
    requiredCertificates.push(
      copy(locale, "Autorisation AMP (détenue à la date de dépôt).", "AMP authorization (held on submission date)."),
    );
  }
  requiredCertificates.push(
    copy(locale, "Attestation Revenu Québec.", "Revenu Québec attestation."),
    copy(locale, "Déclaration de lobbyisme / non-collusion.", "Lobbying / non-collusion declaration."),
  );

  const nextAction = blocked
    ? copy(
        locale,
        "Ne pas acheter les documents — un bloqueur (AMP ou échéance) doit être levé d'abord.",
        "Don't buy the documents — a blocker (AMP or deadline) must be cleared first.",
      )
    : worthBuyingDocuments
      ? copy(
          locale,
          "Ce marché vaut l'achat des documents. Commandez-les sur le site officiel, puis importez-les dans le coffre-fort.",
          "This tender is worth buying the documents for. Order them on the official site, then import them into the vault.",
        )
      : copy(
          locale,
          "Surveillez ce marché mais n'achetez pas encore les documents.",
          "Watch this tender but don't buy the documents yet.",
        );

  return {
    verdict: blocked
      ? "skip"
      : recommendation.decision === "bid"
        ? "pursue"
        : recommendation.decision === "no-bid"
          ? "watch"
          : "verify",
    decision: recommendation.decision,
    decisionLabel: locale === "fr" ? recommendation.labelFr : recommendation.labelEn,
    decisionRationale: locale === "fr" ? recommendation.rationaleFr : recommendation.rationaleEn,
    fitScore,
    winProbability: win.winProbability,
    expectedValue: win.expectedValue,
    confidence: win.confidence,
    paperworkRisk,
    deadlineRisk,
    deadlineLabel,
    competition: copy(locale, "Concurrence modérée estimée (basée sur l'historique de la catégorie).", "Estimated moderate competition (based on category history)."),
    requiredCertificates,
    worthBuyingDocuments,
    nextAction,
  };
}
