export type SmsResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "http_error"; status?: number; message?: string };

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM?.trim()
  );
}

/**
 * Send an SMS. Returns a structured result so callers can fall back to email
 * when SMS is unavailable — never a silent boolean failure.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[sms] Twilio not configured — would send:", body.slice(0, 80));
    }
    return { ok: false, reason: "not_configured" };
  }

  const normalized = to.replace(/\D/g, "");
  if (normalized.length < 10) {
    return { ok: false, reason: "http_error", message: "Numéro de téléphone invalide." };
  }
  const phone = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: from, Body: body.slice(0, 160) }),
      }
    );
    if (res.ok) return { ok: true };
    const errText = await res.text().catch(() => "");
    console.warn(`[sms] Twilio HTTP ${res.status}:`, errText.slice(0, 200));
    return { ok: false, reason: "http_error", status: res.status, message: errText.slice(0, 200) };
  } catch (err) {
    console.warn("[sms] fetch failed:", (err as Error).message);
    return { ok: false, reason: "http_error", message: (err as Error).message };
  }
}
