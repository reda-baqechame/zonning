export function parseCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function splitCsvRecords(text: string, limit: number): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length && records.length < limit; i++) {
    const ch = text[i];
    if (ch === '"') {
      current += ch;
      if (inQuotes && text[i + 1] === '"') {
        current += text[++i];
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (current.trim()) records.push(current);
      current = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    current += ch;
  }

  if (current.trim() && records.length < limit) records.push(current);
  return records;
}

function detectDelimiter(header: string): string {
  const commaColumns = parseCsvLine(header, ",").length;
  const semicolonColumns = parseCsvLine(header, ";").length;
  return semicolonColumns > commaColumns ? ";" : ",";
}

export function parseCsvText(
  text: string,
  limit = 500
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = splitCsvRecords(text, limit + 1);
  if (lines.length < 2) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
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
  return parseCsvText(text, limit);
}

export function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v) return v;
  }
  return "";
}

export function parseMoney(value: string): number | undefined {
  const n = parseLocaleNumber(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseDate(value: string): Date | undefined {
  const clean = value.trim();
  if (!clean) return undefined;

  const dateOnly = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (dateOnly) return validatedUtcDate(+dateOnly[1], +dateOnly[2], +dateOnly[3]);

  const quebecDate = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (quebecDate) return validatedUtcDate(+quebecDate[3], +quebecDate[2], +quebecDate[1]);

  if (!/^\d{4}-\d{2}-\d{2}T/.test(clean)) return undefined;
  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function validatedUtcDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : undefined;
}

function parseLocaleNumber(value: string): number {
  const clean = value
    .replace(/[\s\u00a0\u202f']/g, "")
    .replace(/[^0-9.,-]/g, "");
  if (!clean || !/\d/.test(clean)) return Number.NaN;

  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  let normalized = clean;

  if (separator >= 0) {
    const decimals = clean.length - separator - 1;
    const decimalSeparator = decimals > 0 && decimals <= 2;
    const integer = clean.slice(0, separator).replace(/[.,]/g, "");
    const fraction = clean.slice(separator + 1).replace(/[.,]/g, "");
    normalized = decimalSeparator ? `${integer}.${fraction}` : `${integer}${fraction}`;
  }

  return Number(normalized);
}

export function parseIntSafe(value: string): number | undefined {
  const n = parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseFloatSafe(value: string): number | undefined {
  const n = parseLocaleNumber(value);
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
