export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) {
    if (process.env.NODE_ENV === "production") return [];
    return ["demo@zonning.ca"];
  }
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}
