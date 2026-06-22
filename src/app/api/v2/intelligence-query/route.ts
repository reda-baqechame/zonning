import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { answerQuestion } from "@/lib/ai/query-runner";
import { isLlmConfigured } from "@/lib/ai/client";

const schema = z.object({
  question: z.string().trim().min(4).max(600),
  locale: z.enum(["fr", "en"]).default("fr"),
});

/**
 * POST /api/v2/intelligence-query
 *
 * Natural-language intelligence query over the Quebec ontology. Returns a
 * grounded answer with cited results (each carrying matricule/record + source
 * so the UI can open the investigation canvas).
 *
 * Works with or without an LLM key: the deterministic parser handles common
 * patterns; the LLM only improves intent extraction.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:iq:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "question (4–600 chars) required", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const answer = await answerQuestion(parsed.data.question, parsed.data.locale);
    return NextResponse.json(
      { ...answer, llmEnabled: isLlmConfigured() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[intelligence-query] failed", err);
    return NextResponse.json({ error: "Échec de la requête d'intelligence." }, { status: 500 });
  }
}
