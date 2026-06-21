/**
 * Shared LLM client — one production-grade place to call the model.
 *
 * Supports OPENAI_API_KEY (primary, matching existing ai/* usage) and
 * ANTHROPIC_API_KEY. Returns null when no key is configured so callers can
 * fall back to deterministic logic — the app never pretends to be intelligent
 * when it isn't.
 *
 * Default model preference follows Anthropic's latest guidance for
 * AI-application builds, but the provider is chosen by which key is present
 * (OpenAI first, for backward compatibility with existing summaries).
 */

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export interface LlmOptions {
  /** Max output tokens. */
  maxTokens?: number;
  /** 0–1. */
  temperature?: number;
  /** Override model id. */
  model?: string;
  /** Abort signal for request cancellation. */
  signal?: AbortSignal;
}

export interface LlmResult {
  text: string;
  provider: "openai" | "anthropic";
  model: string;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
}

export function llmProvider(): "openai" | "anthropic" | null {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return null;
}

/**
 * Call the configured LLM. Returns null if no key is configured or the call
 * fails — callers must handle null with a deterministic fallback.
 */
export async function complete(
  messages: LlmMessage[],
  opts: LlmOptions = {}
): Promise<LlmResult | null> {
  const provider = llmProvider();
  if (!provider) return null;

  try {
    if (provider === "openai") {
      const model = opts.model ?? "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens ?? 600,
          temperature: opts.temperature ?? 0.3,
        }),
        signal: opts.signal,
      });
      if (!res.ok) {
        console.warn(`[llm] openai HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text ? { text, provider: "openai", model } : null;
    }

    // Anthropic
    const model = opts.model ?? "claude-haiku-4-5-20251001";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.3,
        system: messages.find((m) => m.role === "system")?.content,
        messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      console.warn(`[llm] anthropic HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    return text ? { text, provider: "anthropic", model } : null;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg !== "This operation was aborted") {
      console.warn("[llm] call failed:", msg);
    }
    return null;
  }
}

/**
 * Ask the LLM for a JSON object. Retries once with a repair prompt if the
 * first response isn't valid JSON. Returns null if unavailable / unparseable.
 */
export async function completeJson<T = unknown>(
  messages: LlmMessage[],
  opts: LlmOptions = {}
): Promise<(T & { __provider?: string }) | null> {
  const result = await complete(messages, opts);
  if (!result) return null;
  const parsed = tryParse<T>(result.text);
  if (parsed) return { ...parsed, __provider: result.provider };
  // One repair attempt.
  const repair = await complete(
    [
      ...messages,
      { role: "assistant", content: result.text },
      {
        role: "user",
        content:
          "Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown. Corrige le JSON précédent.",
      },
    ],
    { ...opts, maxTokens: (opts.maxTokens ?? 600) + 200 }
  );
  if (!repair) return null;
  const repaired = tryParse<T>(repair.text);
  return repaired ? { ...repaired, __provider: repair.provider } : null;
}

function tryParse<T>(text: string): T | null {
  let candidate = text.trim();
  // Strip markdown fences if present.
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidate = fence[1].trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
