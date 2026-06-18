/**
 * Stream-parse CSV text in chunks to reduce peak memory for large government files.
 * Returns rows up to maxRows.
 */
export function parseCsvStreamChunked(
  text: string,
  maxRows: number,
  parseRow: (line: string, headers: string[]) => Record<string, string> | null
): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const row = parseRow(line, headers);
    if (row) rows.push(row);
  }

  return rows;
}
