import { prisma } from "@/lib/prisma";

export async function summarizeTender(tender: {
  id: string;
  title: string;
  organization?: string | null;
  category?: string | null;
  estimatedValue?: number | null;
  description?: string | null;
  summary?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildFallbackSummary(tender);
  }

  const prompt = `Résume cet appel d'offres SEAO en français, 3 puces courtes:
- Ce qu'ils veulent
- Budget indicatif
- Documents clés

Titre: ${tender.title}
Organisme: ${tender.organization ?? "N/A"}
Catégorie: ${tender.category ?? "N/A"}
Valeur estimée: ${tender.estimatedValue ? `$${tender.estimatedValue.toLocaleString("fr-CA")}` : "N/A"}
Description: ${(tender.description ?? tender.summary ?? "").slice(0, 2000)}`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });
      if (!res.ok) return buildFallbackSummary(tender);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content?.trim() ?? buildFallbackSummary(tender);
    }
  } catch {
    return buildFallbackSummary(tender);
  }

  return buildFallbackSummary(tender);
}

function buildFallbackSummary(tender: {
  title: string;
  category?: string | null;
  estimatedValue?: number | null;
}): string {
  const budget = tender.estimatedValue
    ? `Budget indicatif: ~${tender.estimatedValue.toLocaleString("fr-CA")} $`
    : "Budget: voir documents SEAO";
  return `• Ce qu'ils veulent: ${tender.title.slice(0, 120)}\n• ${budget}\n• Documents clés: avis SEAO + annexes techniques`;
}

export async function summarizeNewTenders(limit = 20): Promise<number> {
  const tenders = await prisma.tender.findMany({
    where: {
      closesAt: { gte: new Date() },
      OR: [{ aiSummary: null }, { summaryGeneratedAt: null }],
    },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });

  let count = 0;
  for (const t of tenders) {
    const aiSummary = await summarizeTender(t);
    if (!aiSummary) continue;
    await prisma.tender.update({
      where: { id: t.id },
      data: { aiSummary, summaryGeneratedAt: new Date() },
    });
    count++;
  }
  return count;
}
