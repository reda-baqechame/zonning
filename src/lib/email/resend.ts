const RESEND_API = "https://api.resend.com/emails";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ZONNING <alerts@zonning.ca>";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[email demo]", opts.to, opts.subject);
      return { ok: true, id: "demo" };
    }
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err };
  }

  const data = (await res.json()) as { id?: string };
  return { ok: true, id: data.id };
}
