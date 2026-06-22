import type { VerdictResult } from "@/lib/verdict/compute-verdict";
import type { PropertyIntelligence } from "@/lib/intelligence";

export async function summarizeVerdict(
  address: string,
  borough: string | undefined,
  verdict: VerdictResult,
  intel: PropertyIntelligence
): Promise<{ summaryFr: string; summaryEn: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallbackFr = buildFallback(address, borough, verdict, intel, "fr");
  const fallbackEn = buildFallback(address, borough, verdict, intel, "en");

  if (!apiKey) {
    return { summaryFr: fallbackFr, summaryEn: fallbackEn };
  }

  const prompt = `Rédige 3 phrases courtes pour un rapport PERMIS.AI sur cette adresse au Québec.
Adresse: ${address}${borough ? `, ${borough}` : ""}
Verdict: ${verdict.labelFr} (${verdict.tier})
Raisons: ${verdict.reasonsFr.join("; ")}
Données: évaluation ${intel.assessment?.totalValue ?? "N/A"}; entrées environnementales à proximité ${intel.contamination?.count ?? 0} (correspondance à la parcelle non établie); entrées patrimoniales à proximité ${intel.heritage?.count ?? 0} (statut juridique de la parcelle non établi).
Limites: ${verdict.limitations.join("; ") || "aucune limite supplémentaire"}.
Ne déclare jamais le projet conforme, autorisé, contaminé, protégé ou bloqué lorsque la preuve est seulement indicative ou fondée sur la proximité. N'invente aucune règle de zonage, hauteur, usage ou marge.

Réponds en JSON: {"summaryFr":"...","summaryEn":"..."}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return { summaryFr: fallbackFr, summaryEn: fallbackEn };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(raw) as { summaryFr?: string; summaryEn?: string };
    return {
      summaryFr: json.summaryFr ?? fallbackFr,
      summaryEn: json.summaryEn ?? fallbackEn,
    };
  } catch {
    return { summaryFr: fallbackFr, summaryEn: fallbackEn };
  }
}

function buildFallback(
  address: string,
  borough: string | undefined,
  verdict: VerdictResult,
  intel: PropertyIntelligence,
  lang: "fr" | "en"
): string {
  if (lang === "fr") {
    return `${verdict.labelFr} pour ${address}${borough ? ` (${borough})` : ""}. ${verdict.reasonsFr.slice(0, 2).join(". ") || "Analyse basée sur les données publiques québécoises."}${intel.assessment?.totalValue ? ` Évaluation: ${intel.assessment.totalValue.toLocaleString("fr-CA")} $.` : ""}`;
  }
  return `${verdict.labelEn} for ${address}${borough ? ` (${borough})` : ""}. ${verdict.reasonsEn.slice(0, 2).join(". ") || "Analysis based on Quebec public data."}${intel.assessment?.totalValue ? ` Assessment: $${intel.assessment.totalValue.toLocaleString("en-CA")}.` : ""}`;
}
