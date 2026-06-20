import { prisma } from "@/lib/prisma";

const RESEND_API = "https://api.resend.com/emails";

function defaultReplyTo(): string | undefined {
  const admins = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean);
  return admins?.[0];
}

function isValidFrom(from: string): boolean {
  return /^.+<[^@\s]+@[^@\s]+\.[^@\s]+>$/.test(from) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  userId?: string;
  type?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ZONNING <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  if (!isValidFrom(from)) {
    return { ok: false, error: "EMAIL_FROM invalid — use Name <email@domain.com>" };
  }

  const payload: Record<string, unknown> = {
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };

  const replyTo = opts.replyTo ?? defaultReplyTo();
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500) };
  }

  const data = (await res.json()) as { id?: string };

  if (opts.type) {
    try {
      await prisma.emailLog.create({
        data: {
          userId: opts.userId ?? null,
          email: opts.to,
          subject: opts.subject,
          type: opts.type,
        },
      });
    } catch {
      /* non-blocking */
    }
  }

  return { ok: true, id: data.id };
}
