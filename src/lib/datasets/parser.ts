import { parseCsvStreamChunked } from "./stream-csv";

export function parseCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === delimiter || ch === ";") && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseCsvText(
  text: string,
  limit = 500
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter).map((h) =>
    h.replace(/^\uFEFF/, "").toLowerCase().trim()
  );
  const rows: Record<string, string>[] = [];
  const maxLine = Math.min(lines.length, limit + 1);

  for (let li = 1; li < maxLine; li++) {
    const line = lines[li];
    const cols = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i]?.trim() ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/** Memory-friendly CSV parse for large government files (>8 MB). */
export function parseCsvTextLarge(
  text: string,
  limit = 500
): { headers: string[]; rows: Record<string, string>[] } {
  if (text.length < 8_000_000) return parseCsvText(text, limit);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter).map((h) =>
    h.replace(/^\uFEFF/, "").toLowerCase().trim()
  );
  const rows = parseCsvStreamChunked(text, limit, (line, hdrs) => {
    const cols = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    hdrs.forEach((h, i) => {
      row[h] = cols[i]?.trim() ?? "";
    });
    return row;
  });
  return { headers, rows };
}

export function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v) return v;
  }
  return "";
}

export function parseMoney(value: string): number | undefined {
  const n = parseFloat(value.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseIntSafe(value: string): number | undefined {
  const n = parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseFloatSafe(value: string): number | undefined {
  const n = parseFloat(value.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
