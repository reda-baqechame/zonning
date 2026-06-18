import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/alerts/sms";

export async function dispatchAlert(opts: {
  email?: string | null;
  phone?: string | null;
  smsEnabled?: boolean;
  subject: string;
  html: string;
  smsBody: string;
}): Promise<{ email: boolean; sms: boolean }> {
  const results = { email: false, sms: false };

  if (opts.email) {
    const res = await sendEmail({
      to: opts.email,
      subject: opts.subject,
      html: opts.html,
    });
    results.email = res.ok;
  }

  if (opts.smsEnabled && opts.phone) {
    results.sms = await sendSms(opts.phone, opts.smsBody);
  }

  return results;
}
