import { isFreeTestMode } from "@/lib/free-test";

let adminWarningEmitted = false;

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      // Fail loudly once — a production deploy with no admin is a misconfig:
      // the dashboard, concierge queue, and sync admin are all unreachable.
      if (!adminWarningEmitted) {
        adminWarningEmitted = true;
        console.error(
          "[admin] ADMIN_EMAILS is not set in production — /dashboard, concierge, and sync admin are unreachable. Set ADMIN_EMAILS in Vercel."
        );
      }
      return [];
    }
    return ["demo@zonning.ca"];
  }
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  if (isFreeTestMode()) return true;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}
