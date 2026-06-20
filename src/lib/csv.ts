export function escapeCsvCell(
  value: string | number | boolean | Date | null | undefined,
): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
