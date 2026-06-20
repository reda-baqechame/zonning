import { escapeHtml, safeEmailHref } from "@/lib/email/html";

type Locale = "fr" | "en";

function t(locale: Locale, fr: string, en: string) {
  return locale === "fr" ? fr : en;
}

function layout(locale: Locale, title: string, body: string) {
  const disclaimer = t(
    locale,
    "Renseignement opérationnel seulement. Ceci n'est pas une autorisation municipale, un avis juridique ou un dépôt officiel.",
    "Operational intelligence only. This is not municipal authorization, legal advice, or an official filing."
  );
  const appUrl = safeEmailHref(process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.vercel.app");

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:IBM Plex Sans,Segoe UI,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0b3d91;padding:20px 24px;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">ZONNING</p>
          <p style="margin:6px 0 0;color:#bfdbfe;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Quebec construction intelligence</p>
        </td></tr>
        <tr><td style="padding:24px;">${body}</td></tr>
        <tr><td style="padding:0 24px 24px;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:#64748b;">${disclaimer}</p>
          <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;"><a href="${appUrl}" style="color:#2563eb;">${appUrl}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type SnapshotEmailInput = {
  locale: Locale;
  query: string;
  title: string;
  subtitle: string;
  confidence: number;
  freshness: string;
  sourceTitle: string;
  sourceUrl: string;
  signals: string[];
  limitations: string[];
  recommendedNextAction: string;
  dossierHref: string;
};

export function intelligenceSnapshotEmail(input: SnapshotEmailInput) {
  const locale = input.locale;
  const subject = t(
    locale,
    `ZONNING — Aperçu intelligence: ${input.title}`,
    `ZONNING — Intelligence snapshot: ${input.title}`
  );

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">${escapeHtml(input.title)}</h1>
    <p style="margin:0 0 16px;color:#475569;">${escapeHtml(input.subtitle)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">
      ${t(locale, "Recherche", "Search")}: <strong>${escapeHtml(input.query)}</strong><br/>
      ${t(locale, "Confiance", "Confidence")}: ${Math.round(input.confidence * 100)}% ·
      ${t(locale, "Fraîcheur", "Freshness")}: ${escapeHtml(input.freshness)}
    </p>
    <h2 style="margin:0 0 8px;font-size:14px;color:#0f172a;">${t(locale, "Signaux", "Signals")}</h2>
    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;font-size:14px;">
      ${input.signals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
    </ul>
    <h2 style="margin:0 0 8px;font-size:14px;color:#0f172a;">${t(locale, "Source", "Source")}</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;">
      <a href="${safeEmailHref(input.sourceUrl)}" style="color:#2563eb;">${escapeHtml(input.sourceTitle)}</a>
    </p>
    <h2 style="margin:0 0 8px;font-size:14px;color:#0f172a;">${t(locale, "Prochaine action", "Next action")}</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#334155;">${escapeHtml(input.recommendedNextAction)}</p>
    ${
      input.limitations.length
        ? `<h2 style="margin:0 0 8px;font-size:14px;color:#0f172a;">${t(locale, "Limites", "Limitations")}</h2>
           <ul style="margin:0 0 16px;padding-left:20px;color:#64748b;font-size:12px;">
             ${input.limitations.slice(0, 4).map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
           </ul>`
        : ""
    }
    <p style="margin:0;">
      <a href="${safeEmailHref(input.dossierHref)}" style="display:inline-block;background:#0b3d91;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
        ${t(locale, "Ouvrir le dossier complet", "Open full dossier")}
      </a>
    </p>`;

  return { subject, html: layout(locale, subject, body) };
}

export function digestWelcomeEmail(opts: {
  locale: Locale;
  email: string;
  borough?: string | null;
  trade?: string | null;
}) {
  const locale = opts.locale;
  const subject = t(
    locale,
    "Bienvenue au digest ZONNING",
    "Welcome to the ZONNING digest"
  );
  const appUrl = safeEmailHref(process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.vercel.app");

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;">${subject}</h1>
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      ${t(
        locale,
        "Vous recevrez un résumé hebdomadaire des permis et signaux publics au Québec.",
        "You will receive a weekly summary of permits and public signals across Quebec."
      )}
    </p>
    ${
      opts.borough || opts.trade
        ? `<ul style="margin:0 0 16px;padding-left:20px;color:#475569;font-size:14px;">
             ${opts.borough ? `<li>${t(locale, "Secteur", "Area")}: ${escapeHtml(opts.borough)}</li>` : ""}
             ${opts.trade ? `<li>${t(locale, "Métier", "Trade")}: ${escapeHtml(opts.trade)}</li>` : ""}
           </ul>`
        : ""
    }
    <p style="margin:0;">
      <a href="${appUrl}/${locale}/coverage" style="display:inline-block;background:#0b3d91;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
        ${t(locale, "Voir la couverture Québec", "View Quebec coverage")}
      </a>
    </p>`;

  return { subject, html: layout(locale, subject, body) };
}

export function adminTestEmail(locale: Locale, adminEmail: string) {
  const subject = t(locale, "Test courriel ZONNING", "ZONNING email test");
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;">${subject}</h1>
    <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
      ${t(
        locale,
        `Resend est configuré. Ce message confirme l'envoi à ${escapeHtml(adminEmail)}.`,
        `Resend is configured. This message confirms delivery to ${escapeHtml(adminEmail)}.`
      )}
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
      ${new Date().toISOString()}
    </p>`;
  return { subject, html: layout(locale, subject, body) };
}

export function emailFromDomain(): string | undefined {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) return undefined;
  const match = from.match(/<([^>]+)>/);
  const addr = match?.[1] ?? from;
  return addr.split("@")[1];
}
