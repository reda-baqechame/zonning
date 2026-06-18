import { prisma } from "@/lib/prisma";

export async function summarizePermit(permit: {
  id: string;
  permitType: string;
  workType?: string | null;
  borough?: string | null;
  estimatedCost?: number | null;
  address: string;
}): Promise<{ summaryFr: string; summaryEn: string }> {
  const fallback = buildFallback(permit);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const prompt = `Résume ce permis de construction en 1 ligne FR et 1 ligne EN (style lead B2B):
Type: ${permit.permitType}
Travaux: ${permit.workType ?? "N/A"}
Adresse: ${permit.address}
Arrondissement: ${permit.borough ?? "N/A"}
Coût estimé: ${permit.estimatedCost ? `${permit.estimatedCost.toLocaleString("fr-CA")} $` : "N/A"}

JSON: {"summaryFr":"...","summaryEn":"..."}`;

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
        max_tokens: 200,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(raw) as { summaryFr?: string; summaryEn?: string };
    return {
      summaryFr: json.summaryFr ?? fallback.summaryFr,
      summaryEn: json.summaryEn ?? fallback.summaryEn,
    };
  } catch {
    return fallback;
  }
}

function buildFallback(permit: {
  permitType: string;
  borough?: string | null;
  estimatedCost?: number | null;
}) {
  const cost = permit.estimatedCost
    ? `~${permit.estimatedCost.toLocaleString("fr-CA")} $`
    : "coût non divulgué";
  return {
    summaryFr: `Nouveau permis ${permit.permitType} · ${cost} · ${permit.borough ?? "Québec"}`,
    summaryEn: `New ${permit.permitType} permit · ${cost} · ${permit.borough ?? "Quebec"}`,
  };
}

export async function summarizeNewPermits(limit = 15): Promise<number> {
  const permits = await prisma.permit.findMany({
    where: { summaryFr: null },
    orderBy: { issueDate: "desc" },
    take: limit,
  });

  let count = 0;
  for (const p of permits) {
    const { summaryFr, summaryEn } = await summarizePermit(p);
    await prisma.permit.update({
      where: { id: p.id },
      data: { summaryFr, summaryEn, summaryGeneratedAt: new Date() },
    });
    count++;
  }
  return count;
}
