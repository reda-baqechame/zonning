import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/alerts/sms";

export interface DispatchResult {
  email: boolean;
  sms: boolean;
  /** When SMS was requested but unavailable, an email fallback was attempted. */
  smsFallbackEmail: boolean;
  /** Diagnostic messages for failed channels. */
  warnings: string[];
}

/**
 * Dispatch an alert across configured channels. Production-grade: never fails
 * silently — when SMS is requested but unavailable, falls back to email and
 * records a warning so the operator knows the SMS channel is down.
 */
export async function dispatchAlert(opts: {
  email?: string | null;
  phone?: string | null;
  smsEnabled?: boolean;
  subject: string;
  html: string;
  smsBody: string;
}): Promise<DispatchResult> {
  const result: DispatchResult = { email: false, sms: false, smsFallbackEmail: false, warnings: [] };

  if (opts.email) {
    try {
      const res = await sendEmail({ to: opts.email, subject: opts.subject, html: opts.html });
      result.email = res.ok;
      if (!res.ok) result.warnings.push(`Email non délivré: ${res.error ?? "erreur inconnue"}`);
    } catch (err) {
      result.warnings.push(`Email exception: ${(err as Error).message}`);
    }
  }

  if (opts.smsEnabled && opts.phone) {
    const sms = await sendSms(opts.phone, opts.smsBody);
    if (sms.ok) {
      result.sms = true;
    } else if (sms.reason === "not_configured") {
      // Fall back to email so the alert isn't lost — only if we have an address
      // and haven't already sent the same subject.
      result.warnings.push("SMS indisponible (Twilio non configuré) — alerte courriel de secours envoyée.");
      if (opts.email && !result.email) {
        try {
          const fb = await sendEmail({
            to: opts.email,
            subject: `[SMS indisponible] ${opts.subject}`,
            html: `<p>Alerte SMS non délivrée (Twilio non configuré). Contenu :</p><blockquote>${opts.smsBody}</blockquote>`,
          });
          result.smsFallbackEmail = fb.ok;
          result.email = fb.ok;
        } catch (err) {
          result.warnings.push(`Fallback email exception: ${(err as Error).message}`);
        }
      }
    } else {
      result.warnings.push(`SMS HTTP ${sms.status ?? ""}: ${sms.message ?? "erreur"}`);
    }
  }

  return result;
}
